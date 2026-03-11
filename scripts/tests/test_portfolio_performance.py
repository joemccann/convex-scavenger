"""Tests for reconstructed portfolio performance analytics."""

from __future__ import annotations

import math

import numpy as np
import pandas as pd
import pytest

from portfolio_performance import (
    TradeFill,
    build_option_id,
    build_payload,
    compute_performance_metrics,
    parse_flex_trade_rows,
    reconstruct_equity_curve,
    select_option_mark,
)


def test_build_option_id_formats_occ_style_identifier():
    assert build_option_id("BRZE", "20260320", "C", 25.0) == "BRZE260320C00025000"
    assert build_option_id("SPY", "2026-03-20", "p", 572.5) == "SPY260320P00572500"


def test_select_option_mark_prefers_nbbo_mid_then_avg_then_last():
    assert select_option_mark({
        "nbbo_bid": "1.00",
        "nbbo_ask": "1.40",
        "avg_price": "1.35",
        "last_price": "1.20",
    }) == pytest.approx(1.20)

    assert select_option_mark({
        "nbbo_bid": "0",
        "nbbo_ask": "0",
        "avg_price": "1.35",
        "last_price": "1.20",
    }) == pytest.approx(1.35)

    assert select_option_mark({
        "nbbo_bid": None,
        "nbbo_ask": None,
        "avg_price": None,
        "last_price": "1.20",
    }) == pytest.approx(1.20)

    assert select_option_mark({
        "nbbo_bid": None,
        "nbbo_ask": None,
        "avg_price": None,
        "last_price": None,
    }) is None


def test_reconstruct_equity_curve_calibrates_cash_to_final_equity():
    calendar = pd.Index(["2026-01-02", "2026-01-05", "2026-01-06"], name="date")
    trades = [
        TradeFill(
            trade_date="2025-12-31",
            contract_key="STK:AAA",
            quantity=10,
            net_cash=-1000,
            multiplier=1,
        ),
        TradeFill(
            trade_date="2026-01-05",
            contract_key="STK:BBB",
            quantity=5,
            net_cash=-250,
            multiplier=1,
        ),
    ]
    marks = {
        "STK:AAA": {"2026-01-02": 100.0, "2026-01-05": 110.0, "2026-01-06": 120.0},
        "STK:BBB": {"2026-01-05": 50.0, "2026-01-06": 60.0},
    }

    curve = reconstruct_equity_curve(
        calendar=calendar,
        trades=trades,
        marks_by_contract=marks,
        final_equity=2000.0,
    )

    assert list(curve.index.astype(str)) == list(calendar)
    assert curve.loc["2026-01-02", "cash"] == pytest.approx(750.0)
    assert curve.loc["2026-01-02", "equity"] == pytest.approx(1750.0)
    assert curve.loc["2026-01-05", "equity"] == pytest.approx(1850.0)
    assert curve.loc["2026-01-06", "equity"] == pytest.approx(2000.0)
    assert curve.loc["2026-01-06", "daily_return"] == pytest.approx((2000.0 / 1850.0) - 1.0)


def test_reconstruct_equity_curve_normalizes_compact_trade_dates():
    calendar = pd.Index(["2026-01-02", "2026-01-05", "2026-01-06"], name="date")
    trades = [
        TradeFill(
            trade_date="20251231",
            contract_key="STK:AAA",
            quantity=10,
            net_cash=-1000,
            multiplier=1,
        ),
        TradeFill(
            trade_date="20260105",
            contract_key="STK:BBB",
            quantity=5,
            net_cash=-250,
            multiplier=1,
        ),
    ]
    marks = {
        "STK:AAA": {"2026-01-02": 100.0, "2026-01-05": 110.0, "2026-01-06": 120.0},
        "STK:BBB": {"2026-01-05": 50.0, "2026-01-06": 60.0},
    }

    curve = reconstruct_equity_curve(
        calendar=calendar,
        trades=trades,
        marks_by_contract=marks,
        final_equity=2000.0,
    )

    assert curve.loc["2026-01-05", "equity"] == pytest.approx(1850.0)
    assert curve.loc["2026-01-06", "equity"] == pytest.approx(2000.0)


def test_parse_flex_trade_rows_normalizes_trade_dates_to_iso():
    df = pd.DataFrame([
        {
            "assetCategory": "STK",
            "tradeDate": "20260311",
            "symbol": "AAPL",
            "quantity": 5,
            "netCash": -1000,
            "multiplier": 1,
        }
    ])

    fills = parse_flex_trade_rows(df)

    assert fills[0].trade_date == "2026-03-11"


def test_compute_performance_metrics_matches_core_manual_statistics():
    index = pd.to_datetime(["2026-01-02", "2026-01-05", "2026-01-06", "2026-01-07"])
    equity = pd.Series([100.0, 110.0, 105.0, 120.0], index=index)
    benchmark = pd.Series([100.0, 105.0, 103.0, 108.0], index=index)

    metrics = compute_performance_metrics(equity, benchmark)

    portfolio_returns = np.array([0.10, (105.0 / 110.0) - 1.0, (120.0 / 105.0) - 1.0])
    benchmark_returns = np.array([0.05, (103.0 / 105.0) - 1.0, (108.0 / 103.0) - 1.0])
    expected_beta = float(np.cov(portfolio_returns, benchmark_returns, ddof=1)[0, 1] / np.var(benchmark_returns, ddof=1))
    expected_corr = float(np.corrcoef(portfolio_returns, benchmark_returns)[0, 1])
    expected_mdd = min(0.0, (105.0 / 110.0) - 1.0)

    assert metrics["hit_rate"] == pytest.approx(2 / 3)
    assert metrics["max_drawdown"] == pytest.approx(expected_mdd)
    assert metrics["beta"] == pytest.approx(expected_beta)
    assert metrics["correlation"] == pytest.approx(expected_corr)
    assert metrics["best_day"] == pytest.approx(max(portfolio_returns))
    assert metrics["worst_day"] == pytest.approx(min(portfolio_returns))
    assert "trading_days" not in metrics
    assert math.isfinite(metrics["sharpe_ratio"])
    assert math.isfinite(metrics["sortino_ratio"])


def test_build_payload_exposes_expected_top_level_contract(monkeypatch):
    trades = [
        TradeFill(
            trade_date="2025-12-31",
            contract_key="STK:AAA",
            quantity=10,
            net_cash=-1000,
            multiplier=1,
            security_type="STK",
            symbol="AAA",
        ),
        TradeFill(
            trade_date="2026-01-05",
            contract_key="STK:BBB",
            quantity=5,
            net_cash=-250,
            multiplier=1,
            security_type="STK",
            symbol="BBB",
        ),
    ]

    class DummyIBClient:
        def connect(self, **kwargs):
            return None

        def disconnect(self):
            return None

    class DummyUWClient:
        def close(self):
            return None

    def fake_stock_history(symbol, start_date, end_date, ib_client, uw_client):
        histories = {
            "SPY": {"2026-01-02": 100.0, "2026-01-05": 101.0, "2026-01-06": 102.0},
            "AAA": {"2026-01-02": 100.0, "2026-01-05": 110.0, "2026-01-06": 120.0},
            "BBB": {"2026-01-05": 50.0, "2026-01-06": 60.0},
        }
        return histories.get(symbol, {})

    monkeypatch.setattr("portfolio_performance.load_portfolio_snapshot", lambda: {
        "last_sync": "2026-01-06T16:00:00",
        "account_summary": {"net_liquidation": 2000.0},
        "bankroll": 2000.0,
    })
    monkeypatch.setattr("portfolio_performance.fetch_flex_trade_fills", lambda: (trades, "ib_flex"))
    monkeypatch.setattr("portfolio_performance.fetch_stock_history", fake_stock_history)
    monkeypatch.setattr("portfolio_performance.fetch_option_history", lambda option_id, start_date, end_date, uw_client: {})
    monkeypatch.setattr("portfolio_performance.IBClient", DummyIBClient)
    monkeypatch.setattr("portfolio_performance.UWClient", DummyUWClient)

    payload = build_payload()

    assert payload["period_label"] == "YTD"
    assert payload["benchmark"] == "SPY"
    assert payload["trades_source"] == "ib_flex"
    assert payload["price_sources"]["options"] == "unusual_whales_option_contract_historic"
    assert payload["summary"]["starting_equity"] == pytest.approx(1750.0)
    assert payload["summary"]["ending_equity"] == pytest.approx(2000.0)
    assert payload["summary"]["trading_days"] == 3
    assert len(payload["series"]) == 3
    assert payload["series"][0]["date"] == "2026-01-02"


def test_build_payload_warns_and_continues_when_option_history_is_rate_limited(monkeypatch):
    trades = [
        TradeFill(
            trade_date="2025-12-31",
            contract_key="SPY260320C00570000",
            quantity=1,
            net_cash=-1000,
            multiplier=100,
            security_type="OPT",
            symbol="SPY",
            option_id="SPY260320C00570000",
            expiry="20260320",
        ),
    ]

    class DummyIBClient:
        def connect(self, **kwargs):
            return None

        def disconnect(self):
            return None

    class DummyUWClient:
        def close(self):
            return None

    monkeypatch.setattr("portfolio_performance.load_portfolio_snapshot", lambda: {
        "last_sync": "2026-01-06T16:00:00",
        "account_summary": {"net_liquidation": 1000.0},
        "bankroll": 1000.0,
    })
    monkeypatch.setattr("portfolio_performance.fetch_flex_trade_fills", lambda: (trades, "ib_flex"))
    monkeypatch.setattr("portfolio_performance.fetch_stock_history", lambda symbol, start_date, end_date, ib_client, uw_client: {
        "2026-01-02": 100.0,
        "2026-01-05": 101.0,
        "2026-01-06": 102.0,
    })
    monkeypatch.setattr("portfolio_performance.fetch_option_history", lambda option_id, start_date, end_date, uw_client: (_ for _ in ()).throw(RuntimeError("rate limited")))
    monkeypatch.setattr("portfolio_performance.IBClient", DummyIBClient)
    monkeypatch.setattr("portfolio_performance.UWClient", DummyUWClient)

    payload = build_payload()

    assert payload["summary"]["ending_equity"] == pytest.approx(1000.0)
    assert payload["contracts_missing_history"] == ["SPY260320C00570000"]
    assert any("option history unavailable" in warning.lower() for warning in payload["warnings"])
