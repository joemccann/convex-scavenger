#!/usr/bin/env python3
"""Fetch MenthorQ CTA positioning data via headless browser + Claude Vision.

MenthorQ renders CTA positioning tables as images (not structured HTML).
This script:
  1. Launches headless Chromium via Playwright
  2. Logs in to MenthorQ (credentials via env vars)
  3. Navigates to the CTA dashboard for a given date
  4. Screenshots each CTA table card
  5. Sends screenshots to Claude Haiku Vision for structured extraction
  6. Caches result as daily JSON in data/menthorq_cache/

Environment variables (via .env or shell):
  MENTHORQ_USER  — MenthorQ email/username
  MENTHORQ_PASS  — MenthorQ password
  ANTHROPIC_API_KEY / CLAUDE_CODE_API_KEY / CLAUDE_API_KEY — for Vision

Usage:
    python3 scripts/fetch_menthorq_cta.py              # Fetch + cache + print summary
    python3 scripts/fetch_menthorq_cta.py --json        # JSON to stdout
    python3 scripts/fetch_menthorq_cta.py --date 2026-03-06  # Specific date
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

# Load .env from project root (before any os.environ reads)
from dotenv import load_dotenv as _load_dotenv
_load_dotenv(Path(__file__).resolve().parent.parent / ".env")
from typing import Any, Dict, List, Optional

# ── path setup ────────────────────────────────────────────────────
_SCRIPT_DIR = Path(__file__).resolve().parent
_PROJECT_DIR = _SCRIPT_DIR.parent
CACHE_DIR = _PROJECT_DIR / "data" / "menthorq_cache"

# ── MenthorQ CTA table slugs ─────────────────────────────────────
CTA_TABLES = {
    "main": "cta_table",
    "index": "cta_index",
    "commodity": "cta_commodity",
    "currency": "cta_currency",
}

MENTHORQ_DASHBOARD_URL = (
    "https://menthorq.com/account/"
    "?action=data&type=dashboard&commands=cta&date={date}"
)

MENTHORQ_LOGIN_URL = "https://menthorq.com/login/"

# ── Anthropic API key resolution ──────────────────────────────────
ANTHROPIC_ENV_KEYS = ["ANTHROPIC_API_KEY", "CLAUDE_CODE_API_KEY", "CLAUDE_API_KEY"]


def is_market_open() -> bool:
    """Check if US equity markets are currently open."""
    import zoneinfo
    try:
        et = zoneinfo.ZoneInfo("America/New_York")
    except Exception:
        from datetime import timedelta as _td
        now_utc = datetime.now(timezone.utc)
        et_offset = _td(hours=-5)
        now_et = now_utc + et_offset
        return now_et.weekday() < 5 and 9 * 60 + 30 <= now_et.hour * 60 + now_et.minute <= 16 * 60

    now_et = datetime.now(et)
    if now_et.weekday() >= 5:
        return False
    minutes = now_et.hour * 60 + now_et.minute
    return 9 * 60 + 30 <= minutes <= 16 * 60


def resolve_trading_date() -> str:
    """Return the latest trading session date (YYYY-MM-DD).

    If market is open or it's a weekday after market close, use today.
    On weekends or before market open on Monday, use last Friday.
    """
    import zoneinfo
    try:
        et = zoneinfo.ZoneInfo("America/New_York")
        now = datetime.now(et)
    except Exception:
        from datetime import timedelta as _td
        now = datetime.now(timezone.utc) + _td(hours=-5)

    weekday = now.weekday()  # Mon=0 ... Sun=6

    if weekday == 5:  # Saturday → Friday
        delta = 1
    elif weekday == 6:  # Sunday → Friday
        delta = 2
    elif weekday == 0 and now.hour < 9:  # Monday pre-market → Friday
        delta = 3
    else:
        # Weekday: if before 9:30 AM, use previous trading day
        if now.hour * 60 + now.minute < 9 * 60 + 30:
            delta = 1 if weekday > 0 else 3  # Mon pre-market → Friday
        else:
            delta = 0

    from datetime import timedelta
    target = now - timedelta(days=delta)
    return target.strftime("%Y-%m-%d")


def resolve_api_key() -> Optional[str]:
    for key in ANTHROPIC_ENV_KEYS:
        value = os.environ.get(key, "").strip()
        if value:
            return value
    return None


def resolve_menthorq_creds() -> tuple[Optional[str], Optional[str]]:
    """Resolve MenthorQ login credentials from .env or environment."""
    user = os.environ.get("MENTHORQ_USER", "").strip()
    passwd = os.environ.get("MENTHORQ_PASS", "").strip()
    return (user or None, passwd or None)


# ── Vision extraction prompt ─────────────────────────────────────
EXTRACTION_PROMPT = """Extract CTA positioning data from this table image.
Return ONLY a JSON array of objects with these exact fields:
[{"underlying":"E-Mini S&P 500 Index","position_today":0.45,"position_yesterday":0.21,"position_1m_ago":1.06,"percentile_1m":38,"percentile_3m":13,"percentile_1y":38,"z_score_3m":-1.56},...]

Rules:
- "underlying" is the asset name exactly as shown in the table
- Position values are decimal numbers as shown (can be negative)
- Percentiles are integers (e.g. 38 means 38th percentile)
- Z-scores are decimal numbers as shown (e.g. -1.56)
- Include ALL rows from the table
- Return ONLY the JSON array, no markdown, no explanation"""


# ══════════════════════════════════════════════════════════════════
# Cache
# ══════════════════════════════════════════════════════════════════

def cache_path(date_str: str) -> Path:
    return CACHE_DIR / f"cta_{date_str}.json"


def read_cache(date_str: str) -> Optional[Dict[str, Any]]:
    """Read cached MenthorQ data for a date. Returns None on miss/expiry."""
    p = cache_path(date_str)
    if not p.exists():
        return None
    try:
        data = json.loads(p.read_text())
        return data
    except (json.JSONDecodeError, KeyError):
        return None


def write_cache(date_str: str, tables: Dict[str, List[Dict]]) -> Path:
    """Write cache file. Returns the path."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    entry = {
        "date": date_str,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "source": "menthorq_vision",
        "tables": tables,
    }
    p = cache_path(date_str)
    p.write_text(json.dumps(entry, indent=2))
    return p


# ══════════════════════════════════════════════════════════════════
# Browser: Login + Screenshot
# ══════════════════════════════════════════════════════════════════

def screenshot_cta_tables(
    date_str: str,
    username: str,
    password: str,
    headless: bool = True,
) -> Dict[str, bytes]:
    """Launch Playwright, login to MenthorQ, screenshot CTA table cards.

    Returns {table_key: png_bytes} for each successfully captured table.
    """
    from playwright.sync_api import sync_playwright

    screenshots: Dict[str, bytes] = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
        )
        page = context.new_page()

        # ── Login ──
        print("  Navigating to MenthorQ login...", file=sys.stderr)
        page.goto(MENTHORQ_LOGIN_URL, wait_until="networkidle", timeout=30000)
        time.sleep(2)

        # WordPress login form — try multiple selector patterns
        username_selectors = [
            'input[name="log"]',
            'input#user_login',
            'input[name="username"]',
            'input[type="text"]',
            'input[type="email"]',
        ]
        password_selectors = [
            'input[name="pwd"]',
            'input#user_pass',
            'input[name="password"]',
            'input[type="password"]',
        ]

        for sel in username_selectors:
            el = page.query_selector(sel)
            if el:
                el.fill(username)
                break

        for sel in password_selectors:
            el = page.query_selector(sel)
            if el:
                el.fill(password)
                break

        # Submit — try multiple patterns
        submit_selectors = [
            'input[name="wp-submit"]',
            'input[type="submit"]',
            'button[type="submit"]',
            '#wp-submit',
        ]
        for sel in submit_selectors:
            el = page.query_selector(sel)
            if el:
                el.click()
                break

        page.wait_for_load_state("networkidle", timeout=30000)
        time.sleep(3)

        # Verify login succeeded
        current_url = page.url.lower()
        if "/login" in current_url or "/wp-login" in current_url:
            print("  ERROR: Login failed. Check credentials.", file=sys.stderr)
            browser.close()
            return {}

        print("  Login successful.", file=sys.stderr)

        # ── Navigate to CTA dashboard ──
        dashboard_url = MENTHORQ_DASHBOARD_URL.format(date=date_str)
        print(f"  Loading CTA dashboard: {date_str}...", file=sys.stderr)
        page.goto(dashboard_url, wait_until="networkidle", timeout=60000)
        time.sleep(3)

        # ── Screenshot each CTA card ──
        for table_key, slug in CTA_TABLES.items():
            try:
                # Find the card by data-command-slug attribute
                card = page.query_selector(f'[data-command-slug="{slug}"]')
                if not card:
                    # Try broader selector
                    card = page.query_selector(f'.command-card:has([data-command-slug="{slug}"])')
                if not card:
                    print(f"  WARNING: Card not found for {slug}", file=sys.stderr)
                    continue

                # Screenshot the card's main container or the card itself
                container = card.query_selector(".main-container") or card
                png = container.screenshot(type="png")
                screenshots[table_key] = png
                print(f"  Screenshot: {table_key} ({len(png):,} bytes)", file=sys.stderr)
            except Exception as exc:
                print(f"  WARNING: Screenshot failed for {slug}: {exc}", file=sys.stderr)

        browser.close()

    return screenshots


# ══════════════════════════════════════════════════════════════════
# Vision Extraction
# ══════════════════════════════════════════════════════════════════

def extract_via_vision(
    png_bytes: bytes,
    api_key: str,
    table_key: str,
) -> Optional[List[Dict[str, Any]]]:
    """Send a screenshot to Claude Haiku Vision, extract structured CTA data."""
    import httpx

    b64 = base64.b64encode(png_bytes).decode("utf-8")

    try:
        resp = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-haiku-4-5-20251001",
                "max_tokens": 4096,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/png",
                                    "data": b64,
                                },
                            },
                            {"type": "text", "text": EXTRACTION_PROMPT},
                        ],
                    }
                ],
            },
            timeout=60.0,
        )

        if resp.status_code != 200:
            print(f"  Vision API error ({table_key}): {resp.status_code} {resp.text[:200]}", file=sys.stderr)
            return None

        data = resp.json()
        text = None
        for block in data.get("content", []):
            if block.get("type") == "text":
                text = block.get("text", "")
                break

        if not text:
            return None

        # Strip markdown fences if present
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1] if "\n" in cleaned else cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        parsed = json.loads(cleaned)
        if not isinstance(parsed, list):
            return None

        print(f"  Vision: {table_key} — {len(parsed)} assets extracted", file=sys.stderr)
        return parsed

    except Exception as exc:
        print(f"  Vision extraction failed ({table_key}): {exc}", file=sys.stderr)
        return None


# ══════════════════════════════════════════════════════════════════
# Main Fetch Pipeline
# ══════════════════════════════════════════════════════════════════

def fetch_menthorq_cta(
    date_str: Optional[str] = None,
    force: bool = False,
    headless: bool = True,
) -> Optional[Dict[str, Any]]:
    """Fetch MenthorQ CTA data: check cache, screenshot, extract, cache.

    Returns the full cache entry dict, or None on failure.
    """
    if date_str is None:
        date_str = datetime.now().strftime("%Y-%m-%d")

    # Check cache (unless forced)
    if not force:
        cached = read_cache(date_str)
        if cached:
            print(f"  Cache hit: {cache_path(date_str)}", file=sys.stderr)
            return cached

    # Validate credentials
    username, password = resolve_menthorq_creds()
    if not username or not password:
        print("  ERROR: MenthorQ credentials not available.", file=sys.stderr)
        return None

    # Validate API key
    api_key = resolve_api_key()
    if not api_key:
        print("  ERROR: No Anthropic API key found.", file=sys.stderr)
        return None

    # Screenshot
    screenshots = screenshot_cta_tables(date_str, username, password, headless=headless)
    if not screenshots:
        print("  ERROR: No screenshots captured.", file=sys.stderr)
        return None

    # Extract via Vision
    tables: Dict[str, List[Dict]] = {}
    for table_key, png_bytes in screenshots.items():
        extracted = extract_via_vision(png_bytes, api_key, table_key)
        if extracted:
            tables[table_key] = extracted

    if not tables:
        print("  ERROR: Vision extraction returned no data.", file=sys.stderr)
        return None

    # Cache
    p = write_cache(date_str, tables)
    print(f"  Cached: {p}", file=sys.stderr)

    return read_cache(date_str)


# ══════════════════════════════════════════════════════════════════
# Helper: Find asset in MenthorQ tables
# ══════════════════════════════════════════════════════════════════

def find_by_underlying(
    table: List[Dict[str, Any]],
    search: str,
) -> Optional[Dict[str, Any]]:
    """Find an asset entry by partial underlying name match (case-insensitive)."""
    search_lower = search.lower()
    for entry in table:
        name = entry.get("underlying", "")
        if search_lower in name.lower():
            return entry
    return None


def load_menthorq_cache(date_str: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Load the latest MenthorQ cache. Tries trading date first, then yesterday."""
    if date_str:
        return read_cache(date_str)

    trading_date = resolve_trading_date()
    cached = read_cache(trading_date)
    if cached:
        return cached

    # Try previous trading day fallback
    from datetime import timedelta
    yesterday = (datetime.strptime(trading_date, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
    return read_cache(yesterday)


# ══════════════════════════════════════════════════════════════════
# Console Summary
# ══════════════════════════════════════════════════════════════════

def print_summary(data: Dict[str, Any]) -> None:
    """Print human-readable summary of MenthorQ CTA data."""
    print(f"\n{'='*60}", file=sys.stderr)
    print(f"MENTHORQ CTA POSITIONING — {data['date']}", file=sys.stderr)
    print(f"Source: {data['source']} | Fetched: {data['fetched_at']}", file=sys.stderr)
    print(f"{'='*60}", file=sys.stderr)

    for table_key in ["main", "index", "commodity", "currency"]:
        table = data.get("tables", {}).get(table_key, [])
        if not table:
            continue

        label = table_key.upper()
        print(f"\n  {label} ({len(table)} assets):", file=sys.stderr)
        print(f"  {'Underlying':<35} {'Pos Today':>10} {'Pos Yest':>10} {'Pctl 3M':>8} {'Z-Score':>8}", file=sys.stderr)
        print(f"  {'-'*35} {'-'*10} {'-'*10} {'-'*8} {'-'*8}", file=sys.stderr)

        for entry in table:
            name = entry.get("underlying", "?")[:35]
            pos_t = entry.get("position_today", "---")
            pos_y = entry.get("position_yesterday", "---")
            pctl = entry.get("percentile_3m", "---")
            zscore = entry.get("z_score_3m", "---")

            pos_t_str = f"{pos_t:>10.2f}" if isinstance(pos_t, (int, float)) else f"{pos_t:>10}"
            pos_y_str = f"{pos_y:>10.2f}" if isinstance(pos_y, (int, float)) else f"{pos_y:>10}"
            pctl_str = f"{pctl:>8}" if isinstance(pctl, (int, float)) else f"{pctl:>8}"
            zscore_str = f"{zscore:>8.2f}" if isinstance(zscore, (int, float)) else f"{zscore:>8}"

            print(f"  {name:<35} {pos_t_str} {pos_y_str} {pctl_str} {zscore_str}", file=sys.stderr)

    # Highlight SPX
    main_table = data.get("tables", {}).get("main", [])
    spx = find_by_underlying(main_table, "S&P 500")
    if spx:
        print(f"\n  KEY: E-Mini S&P 500", file=sys.stderr)
        print(f"    Position Today     : {spx.get('position_today', '---')}", file=sys.stderr)
        print(f"    Position Yesterday : {spx.get('position_yesterday', '---')}", file=sys.stderr)
        print(f"    3M Percentile      : {spx.get('percentile_3m', '---')}", file=sys.stderr)
        print(f"    3M Z-Score         : {spx.get('z_score_3m', '---')}", file=sys.stderr)

    print(f"\n{'='*60}\n", file=sys.stderr)


# ══════════════════════════════════════════════════════════════════
# CLI
# ══════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="Fetch MenthorQ CTA positioning data",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Fetches CTA positioning data from MenthorQ via headless browser + Vision.
Requires MENTHORQ_USER, MENTHORQ_PASS, and an Anthropic API key.

Examples:
  python3 scripts/fetch_menthorq_cta.py              # Fetch + summary
  python3 scripts/fetch_menthorq_cta.py --json        # JSON to stdout
  python3 scripts/fetch_menthorq_cta.py --date 2026-03-06
  python3 scripts/fetch_menthorq_cta.py --force        # Bypass cache
""",
    )
    parser.add_argument("--json", action="store_true", help="Output JSON to stdout")
    parser.add_argument("--date", help="Date to fetch (YYYY-MM-DD, default: today)")
    parser.add_argument("--force", action="store_true", help="Bypass cache, force re-fetch")
    parser.add_argument("--no-headless", action="store_true", help="Show browser (debug)")

    args = parser.parse_args()

    date_str = args.date or resolve_trading_date()

    print(f"\n{'='*60}", file=sys.stderr)
    print(f"MENTHORQ CTA FETCH — {date_str}", file=sys.stderr)
    print(f"{'='*60}", file=sys.stderr)

    t_start = time.time()
    result = fetch_menthorq_cta(
        date_str=date_str,
        force=args.force,
        headless=not args.no_headless,
    )
    elapsed = time.time() - t_start

    if not result:
        print("  FAILED: No MenthorQ data retrieved.", file=sys.stderr)
        sys.exit(1)

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print_summary(result)

    print(f"  Completed in {elapsed:.1f}s", file=sys.stderr)


if __name__ == "__main__":
    main()
