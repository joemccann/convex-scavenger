"""Tests for ib_order_manage.py — mocks IBClient connection."""

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch, PropertyMock

import pytest

# Add scripts dir to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from ib_order_manage import find_trade, cancel_order, modify_order, output


# ─── Helpers ────────────────────────────────────────────

def make_trade(order_id=10, perm_id=12345, status="Submitted", order_type="LMT", lmt_price=22.50):
    trade = MagicMock()
    trade.order.orderId = order_id
    trade.order.permId = perm_id
    trade.order.orderType = order_type
    trade.order.lmtPrice = lmt_price
    trade.order.clientId = 0
    trade.orderStatus.status = status
    trade.contract = MagicMock()
    return trade


def make_client(trades=None):
    client = MagicMock()
    client.get_open_orders.return_value = trades or []
    client.sleep = MagicMock()
    # Expose ib property for error event handling and clientId access
    client.ib = MagicMock()
    client.ib.client.clientId = 0
    return client


# ─── find_trade ─────────────────────────────────────────

class TestFindTrade:
    def test_find_by_perm_id(self):
        t = make_trade(order_id=10, perm_id=999)
        client = make_client([t])
        assert find_trade(client, 0, 999) is t

    def test_find_by_order_id(self):
        t = make_trade(order_id=42, perm_id=0)
        client = make_client([t])
        assert find_trade(client, 42, 0) is t

    def test_perm_id_preferred_over_order_id(self):
        t1 = make_trade(order_id=10, perm_id=100)
        t2 = make_trade(order_id=10, perm_id=200)
        client = make_client([t1, t2])
        assert find_trade(client, 10, 200) is t2

    def test_not_found(self):
        client = make_client([make_trade(order_id=10, perm_id=100)])
        assert find_trade(client, 99, 88) is None


# ─── cancel_order ───────────────────────────────────────

class TestCancelOrder:
    def test_cancel_success(self):
        t = make_trade(status="Submitted")
        # After cancel, status changes
        t.orderStatus.status = "Submitted"

        def side_effect(order):
            t.orderStatus.status = "Cancelled"

        client = make_client([t])
        client.cancel_order = MagicMock(side_effect=side_effect)

        with pytest.raises(SystemExit) as exc:
            cancel_order(client, 10, 12345)
        assert exc.value.code == 0
        client.cancel_order.assert_called_once_with(t.order)

    def test_cancel_already_filled(self):
        t = make_trade(status="Filled")
        client = make_client([t])

        with pytest.raises(SystemExit) as exc:
            cancel_order(client, 10, 12345)
        assert exc.value.code == 1

    def test_cancel_not_found(self):
        client = make_client([])

        with pytest.raises(SystemExit) as exc:
            cancel_order(client, 99, 88)
        assert exc.value.code == 1


# ─── modify_order ───────────────────────────────────────

class TestModifyOrder:
    def test_modify_success(self):
        t = make_trade(status="Submitted", order_type="LMT", lmt_price=20.00)
        client = make_client([t])
        client.place_order = MagicMock()

        with pytest.raises(SystemExit) as exc:
            modify_order(client, 10, 12345, 22.50, "127.0.0.1", 4001)
        assert exc.value.code == 0
        assert t.order.lmtPrice == 22.50
        client.place_order.assert_called_once_with(t.contract, t.order)

    def test_modify_non_lmt_fails(self):
        t = make_trade(status="Submitted", order_type="MKT")
        client = make_client([t])

        with pytest.raises(SystemExit) as exc:
            modify_order(client, 10, 12345, 22.50, "127.0.0.1", 4001)
        assert exc.value.code == 1

    def test_modify_already_filled(self):
        t = make_trade(status="Filled", order_type="LMT")
        client = make_client([t])

        with pytest.raises(SystemExit) as exc:
            modify_order(client, 10, 12345, 22.50, "127.0.0.1", 4001)
        assert exc.value.code == 1

    def test_modify_zero_price_fails(self):
        t = make_trade(status="Submitted", order_type="LMT")
        client = make_client([t])

        with pytest.raises(SystemExit) as exc:
            modify_order(client, 10, 12345, 0, "127.0.0.1", 4001)
        assert exc.value.code == 1

    def test_modify_not_found(self):
        client = make_client([])

        with pytest.raises(SystemExit) as exc:
            modify_order(client, 99, 88, 22.50, "127.0.0.1", 4001)
        assert exc.value.code == 1

    def test_modify_stp_lmt_allowed(self):
        t = make_trade(status="Submitted", order_type="STP LMT", lmt_price=18.00)
        client = make_client([t])
        client.place_order = MagicMock()

        with pytest.raises(SystemExit) as exc:
            modify_order(client, 10, 12345, 19.00, "127.0.0.1", 4001)
        assert exc.value.code == 0
        assert t.order.lmtPrice == 19.00


# ─── output ─────────────────────────────────────────────

class TestOutput:
    def test_output_ok(self, capsys):
        with pytest.raises(SystemExit) as exc:
            output("ok", "done")
        assert exc.value.code == 0
        captured = capsys.readouterr()
        data = json.loads(captured.out)
        assert data["status"] == "ok"
        assert data["message"] == "done"

    def test_output_error(self, capsys):
        with pytest.raises(SystemExit) as exc:
            output("error", "fail")
        assert exc.value.code == 1
        captured = capsys.readouterr()
        data = json.loads(captured.out)
        assert data["status"] == "error"

    def test_output_extra_fields(self, capsys):
        with pytest.raises(SystemExit) as exc:
            output("ok", "done", orderId=42, newPrice=22.5)
        captured = capsys.readouterr()
        data = json.loads(captured.out)
        assert data["orderId"] == 42
        assert data["newPrice"] == 22.5
