"""Legacy IB connection helpers kept for backward-compatible scripts/tests.

New code should prefer ``clients.ib_client.IBClient``.
"""
from __future__ import annotations

from ib_insync import IB
from typing import Optional

DEFAULT_HOST = "127.0.0.1"
DEFAULT_GATEWAY_PORT = 4001
DEFAULT_TWS_PORT = 7497

# Legacy registry values preserved exactly for compatibility tests.
CLIENT_IDS = {
    "ib_order_manage": 0,
    "ib_sync": 0,
    "ib_order": 2,
    "ib_orders": 11,
    "ib_execute": 25,
    "ib_fill_monitor": 52,
    "exit_order_service": 60,
    "ib_reconcile": 0,
    "fetch_analyst_ratings": 99,
    "ib_realtime_server": 100,
}


def connect_ib(
    client_name: str,
    *,
    host: str = DEFAULT_HOST,
    port: int = DEFAULT_GATEWAY_PORT,
    client_id: Optional[int] = None,
    timeout: int = 10,
):
    """Legacy raw-IB connector used by older scripts/tests."""
    if client_name not in CLIENT_IDS:
        raise ValueError(f"Unknown client name: {client_name}")

    ib = IB()
    resolved_client_id = CLIENT_IDS[client_name] if client_id is None else client_id
    ib.connect(host, port, clientId=resolved_client_id, timeout=timeout)
    return ib
