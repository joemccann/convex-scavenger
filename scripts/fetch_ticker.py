#!/usr/bin/env python3
"""
Ticker validation using Unusual Whales API with local caching.
Validates ticker exists by checking for dark pool activity.
Caches company names locally to reduce API calls.

Requires UW_TOKEN environment variable.

API Reference: docs/unusual_whales_api.md
Full Spec: docs/unusual_whales_api_spec.yaml

Key endpoints used:
  - GET /api/darkpool/{ticker} - Validates ticker and returns activity
  - GET /api/stock/{ticker}/info - Company info (if needed)
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

from clients.uw_client import UWClient, UWNotFoundError, UWAPIError
from utils.market_calendar import get_last_n_trading_days, load_holidays, _is_trading_day

CACHE_FILE = Path(__file__).parent.parent / "data" / "ticker_cache.json"

# Keep for backward compatibility with existing tests
MARKET_HOLIDAYS_2026 = load_holidays(2026)


def load_cache() -> dict:
    """Load ticker cache from disk."""
    if CACHE_FILE.exists():
        try:
            with open(CACHE_FILE, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass
    return {"last_updated": None, "tickers": {}}


def save_cache(cache: dict) -> None:
    """Save ticker cache to disk."""
    cache["last_updated"] = datetime.now().strftime("%Y-%m-%d")
    try:
        with open(CACHE_FILE, "w") as f:
            json.dump(cache, f, indent=2)
    except IOError as e:
        print(f"Warning: Could not save cache: {e}", file=sys.stderr)


def get_cached_ticker(ticker: str):
    """Get ticker info from cache if available."""
    cache = load_cache()
    return cache.get("tickers", {}).get(ticker.upper())


def cache_ticker(ticker: str, company_name: str, sector: str = None) -> None:
    """Add or update a ticker in the cache."""
    cache = load_cache()
    cache["tickers"][ticker.upper()] = {
        "company_name": company_name,
        "sector": sector
    }
    save_cache(cache)


def is_market_open(date: datetime) -> bool:
    """Check if the market is open on a given date (date-only, no time check).

    Backward-compatible wrapper used by existing tests.
    """
    return _is_trading_day(date)


def fetch_ticker_info(ticker: str) -> dict:
    """
    Validate ticker exists using Unusual Whales dark pool data.
    Checks local cache first for company name/sector.
    If we get DP prints, the ticker is valid and actively traded.
    """
    ticker = ticker.upper().strip()
    now = datetime.now()

    # Check cache first
    cached = get_cached_ticker(ticker)

    result = {
        "ticker": ticker,
        "fetched_at": now.isoformat(),
        "verified": False,
        "validation_method": "dark_pool_activity",
        "from_cache": cached is not None,
        "company_name": cached.get("company_name") if cached else None,
        "sector": cached.get("sector") if cached else None,
        "industry": None,
        "market_cap": None,
        "avg_volume": None,
        "current_price": None,
        "options_available": False,
        "error": None
    }

    # Get last 1 trading day for validation (faster)
    # If ticker has activity today/yesterday, it's valid
    trading_days = get_last_n_trading_days(1, now)
    result["trading_days_checked"] = trading_days

    if not trading_days:
        result["error"] = "Could not determine recent trading days"
        return result

    # Check dark pool data for those trading days
    total_prints = 0
    total_volume = 0
    total_premium = 0.0
    latest_price = None

    with UWClient() as client:
        for date in trading_days:
            try:
                resp = client.get_darkpool_flow(ticker, date=date)
            except UWNotFoundError:
                result["error"] = f"Ticker '{ticker}' not found"
                return result
            except UWAPIError:
                # Other errors - continue trying
                continue

            data = resp.get("data", [])
            if isinstance(data, list):
                total_prints += len(data)
                for t in data:
                    if not t.get("canceled"):
                        total_volume += int(t.get("size", 0))
                        total_premium += float(t.get("premium", 0))
                        if latest_price is None:
                            latest_price = float(t.get("price", 0))

        if total_prints == 0:
            result["error"] = f"No dark pool activity found for '{ticker}' (may be invalid or illiquid)"
            return result

        # Ticker is valid - we have DP data
        result["verified"] = True
        result["current_price"] = latest_price
        result["dp_prints_3d"] = total_prints
        result["dp_volume_3d"] = total_volume
        result["dp_premium_3d"] = round(total_premium, 2)

        # Check options availability via flow alerts
        try:
            options_resp = client.get_flow_alerts(ticker=ticker, limit=10)
            alerts = options_resp.get("data", [])
            result["options_available"] = len(alerts) > 0 if isinstance(alerts, list) else False
            if result["options_available"] and alerts:
                result["recent_options_activity"] = True
        except UWAPIError:
            pass

    # Liquidity assessment based on DP volume
    num_days = len(trading_days)
    avg_daily_volume = total_volume / num_days if num_days > 0 else 0
    if avg_daily_volume < 10000:
        result["liquidity_warning"] = "LOW - Avg DP volume <10k/day"
    elif avg_daily_volume < 100000:
        result["liquidity_warning"] = "MODERATE"
    else:
        result["liquidity_warning"] = None
        result["liquidity_note"] = "HIGH - Active dark pool trading"

    return result


def main():
    parser = argparse.ArgumentParser(
        description="Validate tickers via Unusual Whales dark pool data with local caching."
    )
    parser.add_argument("ticker", help="Ticker symbol to validate")
    parser.add_argument(
        "--add-cache",
        nargs="+",
        metavar=("NAME", "SECTOR"),
        help="Cache a ticker with company name and optional sector",
    )

    args = parser.parse_args()
    ticker = args.ticker

    if args.add_cache:
        company_name = args.add_cache[0]
        sector = args.add_cache[1] if len(args.add_cache) > 1 else None
        cache_ticker(ticker, company_name, sector)
        print(json.dumps({"status": "cached", "ticker": ticker, "company_name": company_name, "sector": sector}, indent=2))
        sys.exit(0)

    result = fetch_ticker_info(ticker)
    print(json.dumps(result, indent=2))

    # Exit with error code if not verified
    if not result["verified"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
