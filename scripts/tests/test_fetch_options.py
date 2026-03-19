"""Tests for fetch_options.py — options chain + flow analysis."""
import pytest
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

from clients.uw_client import UWAPIError

from fetch_options import (
    fetch_uw_chain,
    fetch_uw_flow,
    fetch_options,
)


def _recent_alert_iso(hours_ago: int = 1) -> str:
    return (datetime.utcnow() - timedelta(hours=hours_ago)).strftime("%Y-%m-%dT%H:%M:%SZ")


# ── fetch_uw_chain ──────────────────────────────────────────────────

class TestFetchUwChain:
    @patch("fetch_options.UW_TOKEN", None)
    def test_no_token_returns_none(self):
        assert fetch_uw_chain("AAPL") is None

    @patch("fetch_options.UW_TOKEN", "test-token")
    def test_bullish_bias_low_pc_ratio(self):
        """Low put/call ratio -> BULLISH."""
        mock_client = MagicMock()
        mock_client.get_option_contracts.return_value = {"data": [
            {"option_symbol": "AAPL260320C00200000", "total_premium": "100000",
             "volume": "500", "open_interest": "1000", "bid_volume": "200",
             "ask_volume": "300", "implied_volatility": "0.30",
             "nbbo_bid": "5.00", "nbbo_ask": "5.50"},
            {"option_symbol": "AAPL260320P00180000", "total_premium": "30000",
             "volume": "100", "open_interest": "500", "bid_volume": "50",
             "ask_volume": "50", "implied_volatility": "0.35",
             "nbbo_bid": "3.00", "nbbo_ask": "3.50"},
        ]}
        result = fetch_uw_chain("AAPL", _client=mock_client)
        assert result is not None
        assert result["bias"] == "BULLISH"
        assert result["put_call_ratio"] < 0.5

    @patch("fetch_options.UW_TOKEN", "test-token")
    def test_bearish_bias_high_pc_ratio(self):
        """High put/call ratio -> BEARISH."""
        mock_client = MagicMock()
        mock_client.get_option_contracts.return_value = {"data": [
            {"option_symbol": "AAPL260320C00200000", "total_premium": "30000",
             "volume": "100", "open_interest": "500", "bid_volume": "50",
             "ask_volume": "50", "implied_volatility": "0.30",
             "nbbo_bid": "2.00", "nbbo_ask": "2.50"},
            {"option_symbol": "AAPL260320P00180000", "total_premium": "100000",
             "volume": "500", "open_interest": "1000", "bid_volume": "200",
             "ask_volume": "300", "implied_volatility": "0.35",
             "nbbo_bid": "5.00", "nbbo_ask": "5.50"},
        ]}
        result = fetch_uw_chain("AAPL", _client=mock_client)
        assert result is not None
        assert result["bias"] == "BEARISH"

    @patch("fetch_options.UW_TOKEN", "test-token")
    def test_iv_normalization_decimal(self):
        """IV < 5 treated as decimal and multiplied by 100."""
        mock_client = MagicMock()
        # Need both call + put to avoid division by zero in pc_ratio
        mock_client.get_option_contracts.return_value = {"data": [
            {"option_symbol": "AAPL260320C00200000", "total_premium": "50000",
             "volume": "500", "open_interest": "1000", "bid_volume": "200",
             "ask_volume": "300", "implied_volatility": "0.30",
             "nbbo_bid": "5.00", "nbbo_ask": "5.50"},
            {"option_symbol": "AAPL260320P00180000", "total_premium": "10000",
             "volume": "100", "open_interest": "500", "bid_volume": "50",
             "ask_volume": "50", "implied_volatility": "0.35",
             "nbbo_bid": "3.00", "nbbo_ask": "3.50"},
        ]}
        result = fetch_uw_chain("AAPL", _client=mock_client)
        # Verify call premium was tracked (IV normalization applied on contracts)
        assert result["call_premium"] == 50000
        # Check that IV was normalized from decimal (0.30 -> 30.0)
        call_contract = [c for c in result["top_contracts"] if c["type"] == "call"][0]
        assert call_contract["iv"] == 30.0

    @patch("fetch_options.UW_TOKEN", "test-token")
    def test_iv_normalization_percent(self):
        """IV >= 5 already in percent, keep as-is (round to 1 decimal)."""
        mock_client = MagicMock()
        mock_client.get_option_contracts.return_value = {"data": [
            {"option_symbol": "AAPL260320C00200000", "total_premium": "50000",
             "volume": "500", "open_interest": "1000", "bid_volume": "200",
             "ask_volume": "300", "implied_volatility": "30",
             "nbbo_bid": "5.00", "nbbo_ask": "5.50"},
            {"option_symbol": "AAPL260320P00180000", "total_premium": "10000",
             "volume": "100", "open_interest": "500", "bid_volume": "50",
             "ask_volume": "50", "implied_volatility": "35",
             "nbbo_bid": "3.00", "nbbo_ask": "3.50"},
        ]}
        result = fetch_uw_chain("AAPL", _client=mock_client)
        assert result["call_premium"] == 50000
        # IV=30 (already percent, >= 5) -> keep as 30.0
        call_contract = [c for c in result["top_contracts"] if c["type"] == "call"][0]
        assert call_contract["iv"] == 30.0

    @patch("fetch_options.UW_TOKEN", "test-token")
    def test_empty_chain_returns_error(self):
        mock_client = MagicMock()
        mock_client.get_option_contracts.return_value = {"data": []}
        result = fetch_uw_chain("FAKE", _client=mock_client)
        assert "error" in result


# ── fetch_uw_flow ───────────────────────────────────────────────────

class TestFetchUwFlow:
    @patch("fetch_options.UW_TOKEN", None)
    def test_no_token_returns_none(self):
        assert fetch_uw_flow("AAPL") is None

    @patch("fetch_options.UW_TOKEN", "test-token")
    def test_call_heavy_bullish(self):
        mock_client = MagicMock()
        mock_client.get_flow_alerts.return_value = {"data": [
            {"created_at": _recent_alert_iso(4), "total_premium": "500000",
             "total_bid_side_prem": "100000", "total_ask_side_prem": "400000",
             "type": "call", "has_sweep": True, "strike": "200",
             "expiry": "2026-03-20", "volume": "100", "open_interest": "500",
             "underlying_price": "195", "alert_rule": "unusual"},
            {"created_at": _recent_alert_iso(3), "total_premium": "100000",
             "total_bid_side_prem": "50000", "total_ask_side_prem": "50000",
             "type": "put", "has_sweep": False, "strike": "180",
             "expiry": "2026-03-20", "volume": "50", "open_interest": "200",
             "underlying_price": "195", "alert_rule": "unusual"},
        ]}
        result = fetch_uw_flow("AAPL", _client=mock_client)
        assert result["flow_bias"] == "BULLISH"

    @patch("fetch_options.UW_TOKEN", "test-token")
    def test_put_heavy_bearish(self):
        mock_client = MagicMock()
        mock_client.get_flow_alerts.return_value = {"data": [
            {"created_at": _recent_alert_iso(4), "total_premium": "100000",
             "total_bid_side_prem": "50000", "total_ask_side_prem": "50000",
             "type": "call", "has_sweep": False, "strike": "200",
             "expiry": "2026-03-20", "volume": "50", "open_interest": "200",
             "underlying_price": "195", "alert_rule": "unusual"},
            {"created_at": _recent_alert_iso(3), "total_premium": "500000",
             "total_bid_side_prem": "100000", "total_ask_side_prem": "400000",
             "type": "put", "has_sweep": True, "strike": "180",
             "expiry": "2026-03-20", "volume": "100", "open_interest": "500",
             "underlying_price": "195", "alert_rule": "unusual"},
        ]}
        result = fetch_uw_flow("AAPL", _client=mock_client)
        assert result["flow_bias"] == "BEARISH"

    @patch("fetch_options.UW_TOKEN", "test-token")
    def test_recent_bias_buying_calls(self):
        mock_client = MagicMock()
        mock_client.get_flow_alerts.return_value = {"data": [
            {"created_at": _recent_alert_iso(2), "total_premium": "300000",
             "total_bid_side_prem": "50000", "total_ask_side_prem": "250000",
             "type": "call", "has_sweep": False, "strike": "200",
             "expiry": "2026-03-20", "volume": "100", "open_interest": "500",
             "underlying_price": "195", "alert_rule": "unusual"},
        ]}
        result = fetch_uw_flow("AAPL", _client=mock_client)
        assert result["recent_bias"] == "BULLISH"

    @patch("fetch_options.UW_TOKEN", "test-token")
    def test_no_data(self):
        mock_client = MagicMock()
        mock_client.get_flow_alerts.return_value = {"data": []}
        result = fetch_uw_flow("FAKE", _client=mock_client)
        assert result["bias"] == "NO_DATA"


# ── fetch_options combined analysis ─────────────────────────────────

class TestFetchOptionsCombined:
    @patch("fetch_options.UWClient")
    @patch("fetch_options.fetch_uw_flow")
    @patch("fetch_options.fetch_uw_chain")
    @patch("fetch_options.fetch_ib_options", return_value=None)
    @patch("fetch_options.UW_TOKEN", "test-token")
    def test_both_bullish_high_confidence(self, mock_ib, mock_chain, mock_flow, MockUWClient):
        mock_client = MagicMock()
        MockUWClient.return_value.__enter__ = MagicMock(return_value=mock_client)
        MockUWClient.return_value.__exit__ = MagicMock(return_value=False)
        mock_chain.return_value = {
            "source": "uw", "bias": "BULLISH", "put_call_ratio": 0.3,
            "call_premium": 100000, "put_premium": 30000, "total_premium": 130000,
        }
        mock_flow.return_value = {
            "source": "uw", "flow_bias": "BULLISH", "flow_strength": 70,
            "recent_bias": "BULLISH", "total_alerts": 5,
        }
        result = fetch_options("AAPL")
        analysis = result["analysis"]
        assert analysis["combined_bias"] == "BULLISH"
        assert analysis["confidence"] == "HIGH"

    @patch("fetch_options.UWClient")
    @patch("fetch_options.fetch_uw_flow")
    @patch("fetch_options.fetch_uw_chain")
    @patch("fetch_options.fetch_ib_options", return_value=None)
    @patch("fetch_options.UW_TOKEN", "test-token")
    def test_conflicting_signals_low_confidence(self, mock_ib, mock_chain, mock_flow, MockUWClient):
        mock_client = MagicMock()
        MockUWClient.return_value.__enter__ = MagicMock(return_value=mock_client)
        MockUWClient.return_value.__exit__ = MagicMock(return_value=False)
        mock_chain.return_value = {
            "source": "uw", "bias": "BULLISH", "put_call_ratio": 0.3,
            "call_premium": 100000, "put_premium": 30000, "total_premium": 130000,
        }
        mock_flow.return_value = {
            "source": "uw", "flow_bias": "BEARISH", "flow_strength": 60,
            "recent_bias": "BEARISH", "total_alerts": 5,
        }
        result = fetch_options("AAPL")
        analysis = result["analysis"]
        assert analysis["confidence"] == "LOW"

    @patch("fetch_options.UWClient")
    @patch("fetch_options.fetch_uw_flow", return_value=None)
    @patch("fetch_options.fetch_uw_chain")
    @patch("fetch_options.fetch_ib_options", return_value=None)
    @patch("fetch_options.UW_TOKEN", "test-token")
    def test_chain_only_low_confidence(self, mock_ib, mock_chain, mock_flow, MockUWClient):
        mock_client = MagicMock()
        MockUWClient.return_value.__enter__ = MagicMock(return_value=mock_client)
        MockUWClient.return_value.__exit__ = MagicMock(return_value=False)
        mock_chain.return_value = {
            "source": "uw", "bias": "BULLISH", "put_call_ratio": 0.3,
            "call_premium": 100000, "put_premium": 30000, "total_premium": 130000,
        }
        result = fetch_options("AAPL")
        analysis = result["analysis"]
        assert analysis["combined_bias"] == "BULLISH"
        assert analysis["confidence"] == "LOW"

    @patch("fetch_options.fetch_uw_flow", return_value=None)
    @patch("fetch_options.fetch_uw_chain", return_value=None)
    @patch("fetch_options.fetch_ib_options", return_value=None)
    @patch("fetch_options.UW_TOKEN", None)
    def test_no_token_skips_uw(self, mock_ib, mock_chain, mock_flow):
        result = fetch_options("AAPL", source="uw")
        assert result["chain"] is None
        assert result["flow"] is None
