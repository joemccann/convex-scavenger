#!/usr/bin/env python3
"""Reconstruct a YTD portfolio equity curve and compute institutional metrics.

Methodology:
- Preferred execution ledger: Interactive Brokers Flex Query
- Preferred stock/ETF prices: Interactive Brokers historical bars
- Preferred option prices: Unusual Whales option contract historic endpoint
- Benchmark: SPY daily closes

The curve is reconstructed from trade cash flows plus marked positions and then
anchored to the current account net liquidation value. This assumes no external
cash flows (deposits/withdrawals) within the observed window unless they are
already reflected in the starting cash balance.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Optional
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import numpy as np
import pandas as pd
from ib_insync import Stock

sys.path.insert(0, str(Path(__file__).resolve().parent))

from clients.ib_client import IBClient  # noqa: E402
from clients.uw_client import UWClient  # noqa: E402


ROOT = Path(__file__).resolve().parent.parent
PORTFOLIO_PATH = ROOT / "data" / "portfolio.json"
BLOTTER_CACHE_PATH = ROOT / "data" / "blotter.json"
TRADING_DAYS = 252
OPTION_DESC_RE = re.compile(
    r"^(?P<symbol>[A-Z.]+)\s+(?P<day>\d{1,2})(?P<mon>[A-Z]{3})(?P<year>\d{2})\s+(?P<strike>[\d.]+)\s+(?P<right>[CP])$"
)
MONTHS = {
    "JAN": 1,
    "FEB": 2,
    "MAR": 3,
    "APR": 4,
    "MAY": 5,
    "JUN": 6,
    "JUL": 7,
    "AUG": 8,
    "SEP": 9,
    "OCT": 10,
    "NOV": 11,
    "DEC": 12,
}


@dataclass(frozen=True)
class TradeFill:
    trade_date: str
    contract_key: str
    quantity: float
    net_cash: float
    multiplier: float
    security_type: str = "STK"
    symbol: Optional[str] = None
    option_id: Optional[str] = None
    expiry: Optional[str] = None


def safe_float(value: Any, default: float = 0.0) -> float:
    if value in (None, "", "nan", "NaN"):
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def normalize_expiry(expiry: str) -> str:
    digits = re.sub(r"\D", "", expiry or "")
    if len(digits) != 8:
        raise ValueError(f"Unsupported expiry format: {expiry!r}")
    return digits


def normalize_trade_date(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return ""

    match = re.match(r"^(?P<year>\d{4})[-/](?P<month>\d{2})[-/](?P<day>\d{2})", text)
    if match:
        return f"{match.group('year')}-{match.group('month')}-{match.group('day')}"

    digits = re.sub(r"\D", "", text)
    if len(digits) >= 8:
        return f"{digits[:4]}-{digits[4:6]}-{digits[6:8]}"

    return text[:10]


def build_option_id(symbol: str, expiry: str, right: str, strike: float) -> str:
    expiry_digits = normalize_expiry(expiry)
    strike_int = int(round(float(strike) * 1000))
    return f"{symbol.upper()}{expiry_digits[2:]}{right.upper()[0]}{strike_int:08d}"


def select_option_mark(row: Mapping[str, Any]) -> Optional[float]:
    bid = safe_float(row.get("nbbo_bid"), default=0.0)
    ask = safe_float(row.get("nbbo_ask"), default=0.0)
    if bid > 0 and ask > 0:
        return (bid + ask) / 2.0

    for key in ("avg_price", "last_price", "close_price", "high_price", "low_price", "open_price"):
        value = safe_float(row.get(key), default=float("nan"))
        if math.isfinite(value) and value > 0:
            return value
    return None


def load_portfolio_snapshot(path: Path = PORTFOLIO_PATH) -> dict:
    try:
        from utils.atomic_io import verified_load
        return verified_load(str(path))
    except (ValueError, ImportError):
        return json.loads(path.read_text())


def parse_flex_trade_rows(df: pd.DataFrame) -> List[TradeFill]:
    fills: List[TradeFill] = []
    for row in df.to_dict(orient="records"):
        asset = str(row.get("assetCategory") or "").upper()
        if asset not in {"STK", "OPT"}:
            continue
        trade_date = normalize_trade_date(row.get("tradeDate") or row.get("reportDate") or "")
        if not trade_date:
            continue
        qty = safe_float(row.get("quantity"))
        if qty == 0:
            continue

        if asset == "OPT":
            underlying = str(row.get("underlyingSymbol") or row.get("symbol") or "").strip().split(" ")[0].upper()
            expiry = normalize_expiry(str(row.get("expiry") or ""))
            right = str(row.get("putCall") or "").upper()[:1]
            strike = safe_float(row.get("strike"))
            option_id = build_option_id(underlying, expiry, right, strike)
            contract_key = option_id
            symbol = underlying
        else:
            symbol = str(row.get("symbol") or "").strip().upper()
            contract_key = f"STK:{symbol}"
            option_id = None
            expiry = None

        fills.append(
            TradeFill(
                trade_date=trade_date,
                contract_key=contract_key,
                quantity=qty,
                net_cash=safe_float(row.get("netCash")),
                multiplier=safe_float(row.get("multiplier"), default=100.0 if asset == "OPT" else 1.0) or (100.0 if asset == "OPT" else 1.0),
                security_type=asset,
                symbol=symbol,
                option_id=option_id,
                expiry=expiry,
            )
        )
    fills.sort(key=lambda item: (item.trade_date, item.contract_key, item.quantity))
    return fills


def _parse_blotter_contract_desc(desc: str) -> tuple[str, Optional[str], Optional[str], Optional[float]]:
    match = OPTION_DESC_RE.match(desc.strip().upper())
    if not match:
        return desc.strip().upper(), None, None, None
    month = MONTHS[match.group("mon")]
    expiry = date(
        year=2000 + int(match.group("year")),
        month=month,
        day=int(match.group("day")),
    ).strftime("%Y%m%d")
    return (
        match.group("symbol"),
        expiry,
        match.group("right"),
        float(match.group("strike")),
    )


def load_blotter_fallback(path: Path = BLOTTER_CACHE_PATH) -> List[TradeFill]:
    if not path.exists():
        return []
    raw = json.loads(path.read_text())
    fills: List[TradeFill] = []
    for trade in raw.get("open_trades", []) + raw.get("closed_trades", []):
        desc = str(trade.get("contract_desc") or trade.get("symbol") or "")
        symbol, expiry, right, strike = _parse_blotter_contract_desc(desc)
        contract_key = build_option_id(symbol, expiry, right, strike) if expiry and right and strike is not None else f"STK:{symbol}"
        security_type = "OPT" if expiry and right else "STK"
        multiplier = 100.0 if security_type == "OPT" else 1.0

        for execution in trade.get("executions", []):
            side = str(execution.get("side") or "").upper()
            qty = abs(safe_float(execution.get("quantity")))
            signed_qty = qty if side == "BUY" else -qty
            fills.append(
                TradeFill(
                    trade_date=normalize_trade_date(execution.get("time") or ""),
                    contract_key=contract_key,
                    quantity=signed_qty,
                    net_cash=safe_float(execution.get("net_cash_flow")),
                    multiplier=multiplier,
                    security_type=security_type,
                    symbol=symbol,
                    option_id=contract_key if security_type == "OPT" else None,
                    expiry=expiry,
                )
            )
    fills.sort(key=lambda item: (item.trade_date, item.contract_key, item.quantity))
    return fills


def fetch_flex_trade_fills() -> tuple[List[TradeFill], str]:
    token = os.environ.get("IB_FLEX_TOKEN")
    query_id = os.environ.get("IB_FLEX_QUERY_ID")
    if not token or not query_id:
        raise RuntimeError("IB_FLEX_TOKEN and IB_FLEX_QUERY_ID are required for live performance reconstruction")
    client = IBClient()
    report = client.run_flex_query(query_id=int(query_id), token=token)
    trades_df = report.df("Trade")
    return parse_flex_trade_rows(trades_df), "ib_flex"


def _fetch_yahoo_chart(symbol: str, days: int = 400) -> List[tuple[str, float]]:
    params = urlencode({
        "period1": int((datetime.utcnow().timestamp()) - days * 86400),
        "period2": int(datetime.utcnow().timestamp()) + 86400,
        "interval": "1d",
        "includePrePost": "false",
        "events": "div,splits",
    })
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?{params}"
    request = Request(url, headers={"User-Agent": "radon/2.0"})
    with urlopen(request, timeout=15) as response:
        payload = json.loads(response.read().decode("utf-8"))
    result = payload["chart"]["result"][0]
    timestamps = result.get("timestamp") or []
    closes = result["indicators"]["quote"][0].get("close") or []
    bars: List[tuple[str, float]] = []
    for ts, close in zip(timestamps, closes):
        if close is None:
            continue
        bars.append((datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d"), float(close)))
    return bars


def fetch_stock_history(symbol: str, start_date: str, end_date: str, ib_client: Optional[IBClient], uw_client: Optional[UWClient]) -> Dict[str, float]:
    parsed: Dict[str, float] = {}
    if ib_client is not None:
        try:
            bars = ib_client.get_historical_data(
                Stock(symbol, "SMART", "USD"),
                duration="1 Y",
                bar_size="1 day",
                what_to_show="TRADES",
            )
            parsed = {
                str(bar.date)[:10]: float(bar.close)
                for bar in bars
                if str(bar.date)[:10] >= start_date and str(bar.date)[:10] <= end_date
            }
            if parsed:
                return parsed
        except Exception:
            parsed = {}

    if uw_client is not None:
        try:
            data = uw_client.get_stock_ohlc(symbol, candle_size="1d")
            for bar in data.get("data", []):
                dt = str(bar.get("date") or "")[:10]
                close = safe_float(bar.get("close"), default=float("nan"))
                if dt and math.isfinite(close) and start_date <= dt <= end_date:
                    parsed[dt] = close
            if parsed:
                return parsed
        except Exception:
            parsed = {}

    for dt, close in _fetch_yahoo_chart(symbol):
        if start_date <= dt <= end_date:
            parsed[dt] = close
    return parsed


def fetch_option_history(option_id: str, start_date: str, end_date: str, uw_client: Optional[UWClient]) -> Dict[str, float]:
    if uw_client is None:
        return {}
    data = uw_client.get_option_contract_historic(option_id)
    parsed: Dict[str, float] = {}
    for row in data.get("chains", []):
        dt = str(row.get("date") or "")[:10]
        if not dt or dt < start_date or dt > end_date:
            continue
        mark = select_option_mark(row)
        if mark is not None:
            parsed[dt] = mark
    return parsed


def align_mark_series(calendar: Iterable[str], raw_marks: Mapping[str, float], expiry: Optional[str] = None) -> pd.Series:
    series = pd.Series(raw_marks, dtype=float)
    if series.empty:
        aligned = pd.Series(0.0, index=list(calendar), dtype=float)
    else:
        aligned = series.reindex(list(calendar)).ffill().bfill().fillna(0.0)
    if expiry:
        expiry_date = f"{expiry[:4]}-{expiry[4:6]}-{expiry[6:]}"
        aligned.loc[aligned.index > expiry_date] = 0.0
    return aligned.astype(float)


def reconstruct_equity_curve(
    trades: List[TradeFill],
    calendar: Iterable[str],
    marks_by_contract: Mapping[str, Mapping[str, float]],
    final_equity: float,
) -> pd.DataFrame:
    calendar_list = [str(day) for day in calendar]
    if not calendar_list:
        raise ValueError("calendar must not be empty")

    multipliers: Dict[str, float] = {}
    expiries: Dict[str, Optional[str]] = {}
    final_holdings: Dict[str, float] = {}
    total_net_cash = 0.0
    for trade in trades:
        multipliers[trade.contract_key] = trade.multiplier
        expiries[trade.contract_key] = trade.expiry
        final_holdings[trade.contract_key] = final_holdings.get(trade.contract_key, 0.0) + trade.quantity
        total_net_cash += trade.net_cash

    aligned_marks: Dict[str, pd.Series] = {
        key: align_mark_series(calendar_list, marks_by_contract.get(key, {}), expiries.get(key))
        for key in final_holdings
    }
    final_holdings_value = 0.0
    last_date = calendar_list[-1]
    for key, qty in final_holdings.items():
        mark = float(aligned_marks.get(key, pd.Series(dtype=float)).get(last_date, 0.0))
        final_holdings_value += qty * multipliers.get(key, 1.0) * mark

    initial_cash = final_equity - total_net_cash - final_holdings_value

    trade_map: Dict[str, List[TradeFill]] = {}
    first_date = calendar_list[0]
    calendar_set = set(calendar_list)
    holdings: Dict[str, float] = {}
    cash = initial_cash
    for trade in trades:
        trade_date = normalize_trade_date(trade.trade_date)
        if trade_date < first_date:
            holdings[trade.contract_key] = holdings.get(trade.contract_key, 0.0) + trade.quantity
            cash += trade.net_cash
        else:
            # Snap weekend/holiday trade dates to the next valid calendar day
            effective_date = trade_date
            if effective_date not in calendar_set:
                for cal_day in calendar_list:
                    if cal_day >= effective_date:
                        effective_date = cal_day
                        break
                else:
                    # Trade after last calendar day — attach to last day
                    effective_date = calendar_list[-1]
            trade_map.setdefault(effective_date, []).append(trade)

    rows: List[dict] = []
    previous_equity: Optional[float] = None
    for day in calendar_list:
        for trade in trade_map.get(day, []):
            holdings[trade.contract_key] = holdings.get(trade.contract_key, 0.0) + trade.quantity
            cash += trade.net_cash

        holdings_value = 0.0
        for key, qty in holdings.items():
            if qty == 0:
                continue
            mark = float(aligned_marks.get(key, pd.Series(dtype=float)).get(day, 0.0))
            holdings_value += qty * multipliers.get(key, 1.0) * mark
        equity = cash + holdings_value
        daily_return = None if previous_equity in (None, 0) else (equity / previous_equity) - 1.0
        rows.append({
            "date": day,
            "cash": cash,
            "holdings_value": holdings_value,
            "equity": equity,
            "daily_return": daily_return,
        })
        previous_equity = equity

    curve = pd.DataFrame(rows).set_index("date")
    drawdown = curve["equity"] / curve["equity"].cummax() - 1.0
    curve["drawdown"] = drawdown
    return curve


def _compute_drawdown_duration(drawdown: pd.Series) -> int:
    max_duration = 0
    current = 0
    for value in drawdown:
        if value < 0:
            current += 1
            max_duration = max(max_duration, current)
        else:
            current = 0
    return int(max_duration)


def _capture_ratio(portfolio_returns: pd.Series, benchmark_returns: pd.Series, positive: bool) -> float:
    mask = benchmark_returns > 0 if positive else benchmark_returns < 0
    if mask.sum() == 0:
        return 0.0
    port = portfolio_returns[mask]
    bench = benchmark_returns[mask]
    port_total = float(np.prod(1.0 + port.values) - 1.0)
    bench_total = float(np.prod(1.0 + bench.values) - 1.0)
    if bench_total == 0:
        return 0.0
    return port_total / bench_total


def compute_performance_metrics(equity: pd.Series, benchmark: pd.Series) -> Dict[str, float]:
    portfolio_returns = equity.pct_change().dropna()
    benchmark_returns = benchmark.pct_change().dropna()
    common_index = portfolio_returns.index.intersection(benchmark_returns.index)
    portfolio_returns = portfolio_returns.loc[common_index]
    benchmark_returns = benchmark_returns.loc[common_index]

    total_return = float((equity.iloc[-1] / equity.iloc[0]) - 1.0) if len(equity) > 1 else 0.0
    annualized_return = float((1.0 + total_return) ** (TRADING_DAYS / max(len(portfolio_returns), 1)) - 1.0) if len(equity) > 1 else 0.0

    volatility = float(portfolio_returns.std(ddof=1) * math.sqrt(TRADING_DAYS)) if len(portfolio_returns) > 1 else 0.0
    downside_rms = float(np.sqrt(np.mean(np.square(np.minimum(portfolio_returns.values, 0.0))))) if len(portfolio_returns) > 0 else 0.0
    downside_deviation = downside_rms * math.sqrt(TRADING_DAYS)
    sharpe_ratio = float((portfolio_returns.mean() / portfolio_returns.std(ddof=1)) * math.sqrt(TRADING_DAYS)) if len(portfolio_returns) > 1 and portfolio_returns.std(ddof=1) > 0 else 0.0
    sortino_ratio = float((portfolio_returns.mean() / downside_rms) * math.sqrt(TRADING_DAYS)) if downside_rms > 0 else 0.0

    drawdown = equity / equity.cummax() - 1.0
    max_drawdown = float(drawdown.min()) if not drawdown.empty else 0.0
    current_drawdown = float(drawdown.iloc[-1]) if not drawdown.empty else 0.0
    calmar_ratio = float(annualized_return / abs(max_drawdown)) if max_drawdown < 0 else 0.0

    beta = 0.0
    alpha = 0.0
    correlation = 0.0
    r_squared = 0.0
    tracking_error = 0.0
    information_ratio = 0.0
    treynor_ratio = 0.0
    upside_capture = 0.0
    downside_capture = 0.0
    if len(portfolio_returns) > 1 and len(benchmark_returns) > 1:
        bench_variance = float(np.var(benchmark_returns.values, ddof=1))
        if bench_variance > 0:
            beta = float(np.cov(portfolio_returns.values, benchmark_returns.values, ddof=1)[0, 1] / bench_variance)
            treynor_ratio = float(annualized_return / beta) if beta != 0 else 0.0
        correlation = float(np.corrcoef(portfolio_returns.values, benchmark_returns.values)[0, 1]) if len(portfolio_returns) > 1 else 0.0
        r_squared = correlation ** 2
        alpha = float((portfolio_returns.mean() - beta * benchmark_returns.mean()) * TRADING_DAYS)
        active_returns = portfolio_returns - benchmark_returns
        active_vol = float(active_returns.std(ddof=1))
        tracking_error = active_vol * math.sqrt(TRADING_DAYS) if active_vol > 0 else 0.0
        information_ratio = float((active_returns.mean() / active_vol) * math.sqrt(TRADING_DAYS)) if active_vol > 0 else 0.0
        upside_capture = _capture_ratio(portfolio_returns, benchmark_returns, positive=True)
        downside_capture = _capture_ratio(portfolio_returns, benchmark_returns, positive=False)

    positive_days = int((portfolio_returns > 0).sum())
    negative_days = int((portfolio_returns < 0).sum())
    flat_days = int((portfolio_returns == 0).sum())
    hit_rate = float(positive_days / len(portfolio_returns)) if len(portfolio_returns) else 0.0
    best_day = float(portfolio_returns.max()) if len(portfolio_returns) else 0.0
    worst_day = float(portfolio_returns.min()) if len(portfolio_returns) else 0.0
    avg_up_day = float(portfolio_returns[portfolio_returns > 0].mean()) if positive_days else 0.0
    avg_down_day = float(portfolio_returns[portfolio_returns < 0].mean()) if negative_days else 0.0
    win_loss_ratio = float(abs(avg_up_day / avg_down_day)) if avg_down_day != 0 else 0.0

    var_95 = float(np.quantile(portfolio_returns.values, 0.05)) if len(portfolio_returns) else 0.0
    cvar_95 = float(portfolio_returns[portfolio_returns <= var_95].mean()) if len(portfolio_returns) else 0.0
    q95 = float(np.quantile(portfolio_returns.values, 0.95)) if len(portfolio_returns) else 0.0
    tail_ratio = float(abs(q95 / var_95)) if var_95 != 0 else 0.0
    ulcer_index = float(np.sqrt(np.mean(np.square(drawdown[drawdown < 0])))) if (drawdown < 0).any() else 0.0
    skew = float(portfolio_returns.skew()) if len(portfolio_returns) > 2 else 0.0
    kurtosis = float(portfolio_returns.kurt()) if len(portfolio_returns) > 3 else 0.0

    return {
        "total_return": total_return,
        "annualized_return": annualized_return,
        "annualized_volatility": volatility,
        "downside_deviation": downside_deviation,
        "sharpe_ratio": sharpe_ratio,
        "sortino_ratio": sortino_ratio,
        "calmar_ratio": calmar_ratio,
        "max_drawdown": max_drawdown,
        "current_drawdown": current_drawdown,
        "max_drawdown_duration_days": _compute_drawdown_duration(drawdown),
        "beta": beta,
        "alpha": alpha,
        "correlation": correlation,
        "r_squared": r_squared,
        "tracking_error": tracking_error,
        "information_ratio": information_ratio,
        "treynor_ratio": treynor_ratio,
        "upside_capture": upside_capture,
        "downside_capture": downside_capture,
        "var_95": var_95,
        "cvar_95": cvar_95,
        "tail_ratio": tail_ratio,
        "ulcer_index": ulcer_index,
        "skew": skew,
        "kurtosis": kurtosis,
        "hit_rate": hit_rate,
        "positive_days": positive_days,
        "negative_days": negative_days,
        "flat_days": flat_days,
        "best_day": best_day,
        "worst_day": worst_day,
        "average_up_day": avg_up_day,
        "average_down_day": avg_down_day,
        "win_loss_ratio": win_loss_ratio,
    }


def build_payload(benchmark_symbol: str = "SPY") -> dict:
    portfolio = load_portfolio_snapshot()
    account = portfolio.get("account_summary") or {}
    current_net_liq = safe_float(account.get("net_liquidation"), default=safe_float(portfolio.get("bankroll")))
    last_sync = str(portfolio.get("last_sync") or "")

    warnings: List[str] = [
        "Reconstructed YTD equity curve anchored to current net liquidation. External cash flows are assumed to be zero unless already embedded in the starting cash balance.",
    ]

    try:
        trades, trades_source = fetch_flex_trade_fills()
    except Exception as exc:
        trades = load_blotter_fallback()
        trades_source = "blotter_cache"
        warnings.append(f"Live IB Flex Query unavailable. Falling back to cached blotter data: {exc}")

    if not trades:
        raise RuntimeError("No trades available to reconstruct portfolio performance")

    end_date = last_sync[:10] if last_sync else datetime.now().strftime("%Y-%m-%d")
    start_date = f"{end_date[:4]}-01-01"

    ib_client: Optional[IBClient] = None
    try:
        ib_client = IBClient()
        ib_client.connect(port=4001, client_id=98, timeout=5)
    except Exception as exc:
        warnings.append(f"IB historical bars unavailable. Using fallbacks where needed: {exc}")
        ib_client = None

    uw_client: Optional[UWClient] = None
    try:
        uw_client = UWClient()
    except Exception as exc:
        warnings.append(f"Unusual Whales unavailable for option history: {exc}")
        uw_client = None

    benchmark_history = fetch_stock_history(benchmark_symbol, start_date, end_date, ib_client, uw_client)
    if not benchmark_history:
        raise RuntimeError(f"Could not fetch benchmark history for {benchmark_symbol}")
    calendar = sorted(benchmark_history.keys())
    benchmark_series = pd.Series({dt: benchmark_history[dt] for dt in calendar}, dtype=float)

    marks_by_contract: Dict[str, Dict[str, float]] = {}
    missing_contracts: List[str] = []

    stock_symbols = sorted({trade.symbol for trade in trades if trade.security_type == "STK" and trade.symbol})
    for symbol in stock_symbols:
        history = fetch_stock_history(symbol, start_date, end_date, ib_client, uw_client)
        contract_key = f"STK:{symbol}"
        if history:
            marks_by_contract[contract_key] = history
        else:
            missing_contracts.append(contract_key)

    option_ids = sorted({trade.option_id for trade in trades if trade.security_type == "OPT" and trade.option_id})
    for option_id in option_ids:
        try:
            history = fetch_option_history(option_id, start_date, end_date, uw_client)
        except Exception as exc:
            warnings.append(f"Option history unavailable for {option_id}: {exc}")
            history = {}
        if history:
            marks_by_contract[option_id] = history
        else:
            missing_contracts.append(option_id)

    if ib_client is not None:
        ib_client.disconnect()
    if uw_client is not None:
        uw_client.close()

    if missing_contracts:
        warnings.append(
            f"Missing historical marks for {len(missing_contracts)} contract(s). Those contracts are valued at zero where no price history is available."
        )

    curve = reconstruct_equity_curve(
        trades=trades,
        calendar=calendar,
        marks_by_contract=marks_by_contract,
        final_equity=current_net_liq,
    )
    metrics = compute_performance_metrics(curve["equity"], benchmark_series)
    benchmark_total_return = float((benchmark_series.iloc[-1] / benchmark_series.iloc[0]) - 1.0) if len(benchmark_series) > 1 else 0.0

    series = []
    bench_returns = benchmark_series.pct_change().fillna(0.0)
    for dt in calendar:
        series.append({
            "date": dt,
            "equity": round(float(curve.loc[dt, "equity"]), 4),
            "daily_return": None if pd.isna(curve.loc[dt, "daily_return"]) else round(float(curve.loc[dt, "daily_return"]), 8),
            "drawdown": round(float(curve.loc[dt, "drawdown"]), 8),
            "benchmark_close": round(float(benchmark_series.loc[dt]), 4),
            "benchmark_return": round(float(bench_returns.loc[dt]), 8),
        })

    return {
        "as_of": end_date,
        "last_sync": last_sync,
        "period_start": start_date,
        "period_end": end_date,
        "period_label": "YTD",
        "benchmark": benchmark_symbol,
        "benchmark_total_return": benchmark_total_return,
        "trades_source": trades_source,
        "price_sources": {
            "stocks": "ib_with_uw_yahoo_fallback",
            "options": "unusual_whales_option_contract_historic",
        },
        "methodology": {
            "curve_type": "reconstructed_net_liquidation",
            "return_basis": "daily_close_to_close",
            "risk_free_rate": 0.0,
            "library_strategy": "in_repo_formulas_aligned_to_empyrical_quantstats_conventions",
        },
        "summary": {
            "starting_equity": round(float(curve["equity"].iloc[0]), 4),
            "ending_equity": round(float(curve["equity"].iloc[-1]), 4),
            "pnl": round(float(curve["equity"].iloc[-1] - curve["equity"].iloc[0]), 4),
            "trading_days": int(len(curve.index)),
            **{key: round(float(value), 8) if isinstance(value, (float, np.floating)) else value for key, value in metrics.items()},
        },
        "warnings": warnings,
        "contracts_missing_history": missing_contracts,
        "series": series,
    }


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Generate YTD portfolio performance metrics")
    parser.add_argument("--json", action="store_true", help="Emit JSON payload")
    parser.add_argument("--benchmark", default="SPY", help="Benchmark symbol (default: SPY)")
    args = parser.parse_args(argv)

    payload = build_payload(benchmark_symbol=args.benchmark.upper())
    if args.json:
        print(json.dumps(payload, indent=2))
    else:
        summary = payload["summary"]
        print(f"Portfolio Performance ({payload['period_label']}) — as of {payload['as_of']}")
        print(f"Benchmark: {payload['benchmark']} ({summary['trading_days']} trading days)")
        print(f"Return: {summary['total_return'] * 100:.2f}%")
        print(f"Sharpe: {summary['sharpe_ratio']:.2f} | Sortino: {summary['sortino_ratio']:.2f} | Max DD: {summary['max_drawdown'] * 100:.2f}%")
        if payload["warnings"]:
            print("\nWarnings:")
            for warning in payload["warnings"]:
                print(f"- {warning}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
