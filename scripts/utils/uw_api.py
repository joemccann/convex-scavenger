"""Legacy UW API helper kept for backward-compatible scripts/tests.

New code should prefer ``clients.uw_client.UWClient``.
"""
from __future__ import annotations

import os
from typing import Any, Dict, Optional

import requests

UW_BASE_URL = "https://api.unusualwhales.com/api"


def get_uw_token() -> str:
    token = os.environ.get("UW_TOKEN")
    if not token:
        raise ValueError("UW_TOKEN environment variable is required")
    return token


def uw_api_get(endpoint: str, params: Optional[Dict[str, Any]] = None, timeout: int = 30) -> dict:
    """Legacy requests-based GET helper that returns ``{\"error\": ...}`` on failure."""
    token = get_uw_token()
    url = f"{UW_BASE_URL}/{endpoint.lstrip('/')}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "User-Agent": "radon/legacy-uw-api",
    }
    try:
        response = requests.get(url, headers=headers, params=params, timeout=timeout)
        response.raise_for_status()
        return response.json()
    except Exception as exc:
        return {"error": str(exc)}
