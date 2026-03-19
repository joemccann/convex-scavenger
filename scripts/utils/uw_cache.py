"""Simple in-memory cache for UW API responses.

Used to deduplicate requests within a session (e.g., multiple tickers
fetching the same date's darkpool data in the same evaluation run).

Cache entries expire after TTL_SECONDS (default: 60s).
"""
import time
from typing import Any, Dict, Optional, Tuple

# Default TTL in seconds
TTL_SECONDS = 60

# Global cache: {cache_key: (timestamp, data)}
_cache: Dict[str, Tuple[float, Any]] = {}


def get_cached(key: str) -> Optional[Any]:
    """Get a cached value if it exists and hasn't expired."""
    entry = _cache.get(key)
    if entry is None:
        return None
    timestamp, data = entry
    if time.time() - timestamp > TTL_SECONDS:
        del _cache[key]
        return None
    return data


def set_cached(key: str, data: Any) -> None:
    """Store a value in the cache."""
    _cache[key] = (time.time(), data)


def make_key(endpoint: str, params: Optional[Dict] = None) -> str:
    """Create a cache key from endpoint and params."""
    if params:
        sorted_params = sorted(params.items())
        param_str = "&".join(f"{k}={v}" for k, v in sorted_params)
        return f"{endpoint}?{param_str}"
    return endpoint


def clear_cache() -> None:
    """Clear all cached entries."""
    _cache.clear()
