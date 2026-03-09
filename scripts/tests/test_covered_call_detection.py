"""
TDD tests for covered call detection in ib_sync.py and portfolio_report.py.

Bug: A short call + long stock in the same ticker was classified as "undefined risk"
because positions were grouped by (symbol, expiry) — stock has no expiry, so the
short call ended up in its own group and was flagged as naked/undefined.

Fix: After initial grouping, merge any standalone short call group into a same-ticker
stock group if the stock shares >= short call contracts * 100, creating a "Covered Call".
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest


# ═══════════════════════════════════════════════════════════════════════════
# ib_sync.py tests
# ═══════════════════════════════════════════════════════════════════════════

class TestCoveredCallDetection_IBSync:
    """Tests for detect_structure_type and collapse_positions in ib_sync.py"""

    def test_short_call_alone_is_undefined(self):
        """A standalone short call with no stock is still undefined risk."""
        from ib_sync import detect_structure_type
        legs = [{'secType': 'OPT', 'right': 'C', 'position': -40, 'strike': 60.0}]
        structure, risk = detect_structure_type(legs)
        assert structure == "Short Call"
        assert risk == "undefined"

    def test_long_stock_plus_short_call_is_covered_call(self):
        """Stock + short call in same ticker = covered call = DEFINED risk."""
        from ib_sync import detect_structure_type
        legs = [
            {'secType': 'STK', 'right': '', 'position': 4000, 'strike': 0},
            {'secType': 'OPT', 'right': 'C', 'position': -40, 'strike': 60.0},
        ]
        structure, risk = detect_structure_type(legs)
        assert structure == "Covered Call"
        assert risk == "defined"

    def test_partially_covered_call_is_undefined(self):
        """Stock covers only part of short calls = still undefined for uncovered portion."""
        from ib_sync import detect_structure_type
        # 1000 shares only covers 10 contracts, but 40 are short
        legs = [
            {'secType': 'STK', 'right': '', 'position': 1000, 'strike': 0},
            {'secType': 'OPT', 'right': 'C', 'position': -40, 'strike': 60.0},
        ]
        structure, risk = detect_structure_type(legs)
        # Partially covered — still has naked exposure
        assert risk == "undefined"

    def test_short_put_with_stock_is_not_covered(self):
        """Stock + short put is NOT a covered call — it's a different structure."""
        from ib_sync import detect_structure_type
        legs = [
            {'secType': 'STK', 'right': '', 'position': 4000, 'strike': 0},
            {'secType': 'OPT', 'right': 'P', 'position': -40, 'strike': 50.0},
        ]
        structure, risk = detect_structure_type(legs)
        # Short put with stock is a "covered put" but we treat short puts as undefined
        assert structure != "Covered Call"

    def test_collapse_merges_stock_and_short_call_across_expiry_groups(self):
        """collapse_positions should merge separate (sym, expiry) groups for covered calls."""
        from ib_sync import collapse_positions

        # Simulate what IB returns: stock and option as separate positions
        positions = [
            {
                'symbol': 'URTY', 'secType': 'OPT', 'right': 'C',
                'position': -40, 'strike': 60.0, 'expiry': '2026-03-20',
                'entry_cost': 7012.0, 'avgCost': 175.30,
                'marketPrice': 1.75, 'marketValue': 7000.0,
                'marketPriceIsCalculated': False,
                'structure': 'Short Call',
            },
            {
                'symbol': 'URTY', 'secType': 'STK', 'right': '',
                'position': 4000, 'strike': 0, 'expiry': 'N/A',
                'entry_cost': 239274.0, 'avgCost': 59.82,
                'marketPrice': 55.78, 'marketValue': 223120.0,
                'marketPriceIsCalculated': False,
                'structure': 'Stock (4000.0 shares)',
            },
        ]

        collapsed = collapse_positions(positions)

        # Should produce ONE covered call position, not two separate positions
        urty_positions = [p for p in collapsed if p['ticker'] == 'URTY']

        # Find the one that has the short call
        covered = [p for p in urty_positions if 'Covered' in p.get('structure', '')]
        assert len(covered) == 1, f"Expected 1 Covered Call, got: {[p['structure'] for p in urty_positions]}"
        assert covered[0]['risk_profile'] == 'defined'

    def test_collapse_does_not_merge_unrelated_stock_and_option(self):
        """Stock in AAPL + short call in MSFT should NOT be merged."""
        from ib_sync import collapse_positions

        positions = [
            {
                'symbol': 'MSFT', 'secType': 'OPT', 'right': 'C',
                'position': -10, 'strike': 400.0, 'expiry': '2026-04-17',
                'entry_cost': 5000.0, 'avgCost': 500.0,
                'marketPrice': 5.0, 'marketValue': 5000.0,
                'marketPriceIsCalculated': False,
                'structure': 'Short Call',
            },
            {
                'symbol': 'AAPL', 'secType': 'STK', 'right': '',
                'position': 1000, 'strike': 0, 'expiry': 'N/A',
                'entry_cost': 175000.0, 'avgCost': 175.0,
                'marketPrice': 180.0, 'marketValue': 180000.0,
                'marketPriceIsCalculated': False,
                'structure': 'Stock (1000 shares)',
            },
        ]

        collapsed = collapse_positions(positions)
        msft = [p for p in collapsed if p['ticker'] == 'MSFT']
        assert len(msft) == 1
        assert msft[0]['risk_profile'] == 'undefined'  # Still naked


# ═══════════════════════════════════════════════════════════════════════════
# portfolio_report.py tests
# ═══════════════════════════════════════════════════════════════════════════

class TestCoveredCallDetection_PortfolioReport:
    """Tests for covered call detection in portfolio_report.py grouping logic."""

    def test_portfolio_report_detects_covered_call(self):
        """Portfolio report grouping should merge stock + short call into covered call."""
        from portfolio_report import group_positions

        # Simulate flattened positions from IB
        positions = [
            {
                'symbol': 'URTY', 'sec_type': 'OPT', 'right': 'C',
                'qty': -40, 'strike': 60.0, 'expiry': '2026-03-20',
                'entry_cost': 7012.0, 'avg_cost': 175.30,
                'mkt_val': 7000.0, 'pnl': -12.0, 'pnl_pct': -0.2,
                'dte': 11, 'last_price': 1.75,
            },
            {
                'symbol': 'URTY', 'sec_type': 'STK', 'right': None,
                'qty': 4000, 'strike': 0, 'expiry': 'stock',
                'entry_cost': 239274.0, 'avg_cost': 59.82,
                'mkt_val': 223120.0, 'pnl': -16154.0, 'pnl_pct': -6.7,
                'dte': None, 'last_price': 55.78,
            },
        ]

        grouped = group_positions(positions)
        urty = [g for g in grouped if g['symbol'] == 'URTY']

        # Should have ONE covered call group
        covered = [g for g in urty if 'Covered' in g.get('structure', '')]
        assert len(covered) == 1, f"Expected 1 Covered Call, got: {[g['structure'] for g in urty]}"
        assert covered[0]['risk'] == 'defined'


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
