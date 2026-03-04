#!/usr/bin/env python3
"""
Tests for ib_order_manage.py — Cancel & Modify orders

RED/GREEN TDD — These tests verify permId is used correctly for cancellation.
"""

import pytest
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).parent.parent))


def make_client(trades=None):
    """Create a mock IBClient."""
    client = MagicMock()
    client.get_open_orders.return_value = trades or []
    client.sleep = MagicMock()
    client.ib = MagicMock()
    client.ib.client.clientId = 0
    return client


class TestFindTrade:
    """Test find_trade function uses permId correctly."""

    def test_finds_by_perm_id_when_provided(self):
        """Should find trade by permId when permId > 0."""
        from ib_order_manage import find_trade

        # Create mock trades
        trade1 = MagicMock()
        trade1.order.orderId = 10
        trade1.order.permId = 111111

        trade2 = MagicMock()
        trade2.order.orderId = 0  # orderId=0 (placed in different session)
        trade2.order.permId = 222222  # But has valid permId

        mock_client = make_client([trade1, trade2])

        # Should find trade2 by permId even though orderId=0
        result = find_trade(mock_client, order_id=0, perm_id=222222)

        assert result is not None
        assert result.order.permId == 222222

    def test_perm_id_takes_precedence_over_order_id(self):
        """Should prefer permId over orderId when both provided."""
        from ib_order_manage import find_trade

        # Two trades with same orderId but different permId
        trade1 = MagicMock()
        trade1.order.orderId = 10
        trade1.order.permId = 111111

        trade2 = MagicMock()
        trade2.order.orderId = 10  # Same orderId (collision)
        trade2.order.permId = 222222  # Different permId

        mock_client = make_client([trade1, trade2])

        # Should find by permId, not orderId
        result = find_trade(mock_client, order_id=10, perm_id=222222)

        assert result is not None
        assert result.order.permId == 222222
        assert result == trade2

    def test_falls_back_to_order_id_when_perm_id_zero(self):
        """Should use orderId as fallback when permId=0."""
        from ib_order_manage import find_trade

        trade1 = MagicMock()
        trade1.order.orderId = 10
        trade1.order.permId = 111111

        mock_client = make_client([trade1])

        # permId=0, should fall back to orderId
        result = find_trade(mock_client, order_id=10, perm_id=0)

        assert result is not None
        assert result.order.orderId == 10

    def test_returns_none_when_not_found(self):
        """Should return None when no matching trade."""
        from ib_order_manage import find_trade

        trade1 = MagicMock()
        trade1.order.orderId = 10
        trade1.order.permId = 111111

        mock_client = make_client([trade1])

        # Non-existent permId
        result = find_trade(mock_client, order_id=0, perm_id=999999)

        assert result is None


class TestCancelOrder:
    """Test cancel_order uses permId correctly."""

    def test_cancels_order_by_perm_id(self):
        """Should cancel order found by permId."""
        from ib_order_manage import find_trade

        trade = MagicMock()
        trade.order.orderId = 0  # orderId=0 (external order)
        trade.order.permId = 326559220
        trade.orderStatus.status = "Submitted"

        mock_client = make_client([trade])

        # Should find by permId
        result = find_trade(mock_client, order_id=0, perm_id=326559220)

        assert result is not None
        assert result.order.permId == 326559220

        # In real code, client.cancel_order(trade.order) would be called


class TestDuplicateOrderIds:
    """Test handling of duplicate orderIds (real-world scenario)."""

    def test_handles_multiple_orders_with_same_order_id(self):
        """Should correctly identify orders when multiple have orderId=0."""
        from ib_order_manage import find_trade

        # Real scenario: multiple orders with orderId=0
        aaoi_order = MagicMock()
        aaoi_order.order.orderId = 0
        aaoi_order.order.permId = 1259686775
        aaoi_order.contract.symbol = "AAOI"

        bkd_order = MagicMock()
        bkd_order.order.orderId = 0  # Same orderId!
        bkd_order.order.permId = 1446612730
        bkd_order.contract.symbol = "BKD"

        mock_client = make_client([aaoi_order, bkd_order])

        # Should find AAOI by its permId
        result1 = find_trade(mock_client, order_id=0, perm_id=1259686775)
        assert result1 is not None
        assert result1.contract.symbol == "AAOI"

        # Should find BKD by its permId
        result2 = find_trade(mock_client, order_id=0, perm_id=1446612730)
        assert result2 is not None
        assert result2.contract.symbol == "BKD"

    def test_handles_multiple_orders_with_same_order_id_10(self):
        """Should correctly identify orders when multiple have orderId=10."""
        from ib_order_manage import find_trade

        # Real scenario: TSLL and ALAB both have orderId=10
        tsll_order = MagicMock()
        tsll_order.order.orderId = 10
        tsll_order.order.permId = 326482405
        tsll_order.contract.symbol = "TSLL"

        alab_order = MagicMock()
        alab_order.order.orderId = 10  # Same orderId!
        alab_order.order.permId = 326482280
        alab_order.contract.symbol = "ALAB"

        mock_client = make_client([tsll_order, alab_order])

        # Should find TSLL by its permId
        result1 = find_trade(mock_client, order_id=10, perm_id=326482405)
        assert result1 is not None
        assert result1.contract.symbol == "TSLL"

        # Should find ALAB by its permId
        result2 = find_trade(mock_client, order_id=10, perm_id=326482280)
        assert result2 is not None
        assert result2.contract.symbol == "ALAB"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
