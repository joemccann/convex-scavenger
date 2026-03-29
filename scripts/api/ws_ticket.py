"""Short-lived WebSocket ticket endpoint.

Clients obtain a ticket via POST /ws-ticket (with JWT auth),
then connect to the WebSocket relay with ?ticket=<UUID>.
This avoids passing JWTs in WebSocket URLs (which leak in logs/proxies).

Tickets expire after 30 seconds and are single-use.
"""

import time
import uuid
import logging
from typing import Optional

logger = logging.getLogger("radon.ws_ticket")

_ticket_store: dict[str, dict] = {}

TICKET_TTL_SECONDS = 30


def create_ticket(user_id: str) -> str:
    """Create a short-lived ticket for WebSocket authentication."""
    _cleanup_expired()
    ticket = str(uuid.uuid4())
    _ticket_store[ticket] = {
        "user_id": user_id,
        "expires": time.time() + TICKET_TTL_SECONDS,
    }
    logger.debug("Created WS ticket for user %s (expires in %ds)", user_id, TICKET_TTL_SECONDS)
    return ticket


def validate_ticket(ticket: str) -> Optional[str]:
    """Validate and consume a ticket. Returns user_id if valid, None if not.

    Tickets are single-use: validated ticket is immediately deleted.
    """
    _cleanup_expired()
    entry = _ticket_store.pop(ticket, None)
    if entry is None:
        return None
    if time.time() > entry["expires"]:
        return None
    return entry["user_id"]


def _cleanup_expired():
    """Remove expired tickets from the store."""
    now = time.time()
    expired = [k for k, v in _ticket_store.items() if now > v["expires"]]
    for k in expired:
        del _ticket_store[k]
