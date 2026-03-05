#!/usr/bin/env python3
"""
Index Rebalance Handler — Monitor S&P 500, NASDAQ 100, Russell 2000
for constituent changes and update presets automatically.

Runs weekly (Sunday night). Fetches fresh constituent lists, diffs
against current presets, and regenerates any that changed.

Sources:
  - S&P 500:    Wikipedia 'List of S&P 500 companies' table scrape
  - NASDAQ 100: Wikipedia 'Nasdaq-100' table scrape
  - Russell 2000: iShares IWM holdings CSV download

Registered as a monitor daemon handler.
"""

import json
import csv
import io
import re
import os
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Set, Tuple, Optional
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

logger = logging.getLogger(__name__)

PRESETS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "presets"
CHANGELOG_PATH = PRESETS_DIR / "changelog.json"
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"


# ─── Fetchers ────────────────────────────────────────────────

def fetch_sp500() -> List[Dict]:
    """Fetch current S&P 500 constituents from Wikipedia."""
    url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
    req = Request(url, headers={"User-Agent": USER_AGENT})
    html = urlopen(req, timeout=30).read().decode("utf-8")

    tables = list(re.finditer(r"<table[^>]*>(.*?)</table>", html, re.DOTALL))
    # Table 0 = current constituents (verified by header: Symbol, Security, GICS Sector...)
    table_html = tables[0].group(1)

    rows = re.findall(r"<tr>(.*?)</tr>", table_html, re.DOTALL)
    companies = []
    for row in rows[1:]:
        cells = re.findall(r"<td[^>]*>(.*?)</td>", row, re.DOTALL)
        if len(cells) >= 4:
            ticker = re.sub(r"<[^>]+>", "", cells[0]).strip()
            name = re.sub(r"<[^>]+>", "", cells[1]).strip()
            sector = re.sub(r"<[^>]+>", "", cells[2]).strip()
            sub_industry = re.sub(r"<[^>]+>", "", cells[3]).strip().replace("&amp;", "&")
            if ticker:
                companies.append({
                    "ticker": ticker,
                    "name": name,
                    "sector": sector,
                    "sub_industry": sub_industry,
                })

    # Dedup
    seen = set()
    unique = []
    for c in companies:
        if c["ticker"] not in seen:
            seen.add(c["ticker"])
            unique.append(c)
    return unique


def fetch_ndx100() -> List[Dict]:
    """Fetch current NASDAQ 100 constituents from Wikipedia."""
    url = "https://en.wikipedia.org/wiki/Nasdaq-100"
    req = Request(url, headers={"User-Agent": USER_AGENT})
    html = urlopen(req, timeout=30).read().decode("utf-8")

    tables = list(re.finditer(r"<table[^>]*>(.*?)</table>", html, re.DOTALL))
    # Table 4 = constituents (headers: Ticker, Company, ICB Industry, ICB Subsector)
    ndx_table = tables[4].group(1)

    rows = re.findall(r"<tr>(.*?)</tr>", ndx_table, re.DOTALL)
    companies = []
    for row in rows[1:]:
        cells = re.findall(r"<td[^>]*>(.*?)</td>", row, re.DOTALL)
        if len(cells) >= 4:
            ticker = re.sub(r"<[^>]+>", "", cells[0]).strip()
            name = re.sub(r"<[^>]+>", "", cells[1]).strip()
            sector = re.sub(r"<[^>]+>", "", cells[2]).strip()
            sub_industry = re.sub(r"<[^>]+>", "", cells[3]).strip().replace("&amp;", "&")
            if ticker:
                companies.append({
                    "ticker": ticker,
                    "name": name,
                    "sector": sector,
                    "sub_industry": sub_industry,
                })

    seen = set()
    unique = []
    for c in companies:
        if c["ticker"] not in seen:
            seen.add(c["ticker"])
            unique.append(c)
    return unique


def fetch_r2k() -> List[Dict]:
    """Fetch current Russell 2000 constituents from iShares IWM holdings."""
    url = (
        "https://www.ishares.com/us/products/239710/ishares-russell-2000-etf/"
        "1467271812596.ajax?fileType=csv&fileName=IWM_holdings&dataType=fund"
    )
    req = Request(url, headers={"User-Agent": USER_AGENT})
    content = urlopen(req, timeout=30).read().decode("utf-8", errors="ignore")

    lines = content.strip().split("\n")
    # Header at line 9: Ticker,Name,Sector,Asset Class,...
    companies = []
    for line in lines[10:]:
        if not line.strip():
            continue

        # Manual CSV parse (handles quoted fields with commas)
        parts = []
        in_quote = False
        current = []
        for ch in line:
            if ch == '"':
                in_quote = not in_quote
            elif ch == "," and not in_quote:
                parts.append("".join(current).strip().strip('"'))
                current = []
            else:
                current.append(ch)
        parts.append("".join(current).strip().strip('"'))

        if len(parts) < 4:
            continue

        ticker = parts[0].strip()
        name = parts[1].strip()
        sector = parts[2].strip()
        asset_class = parts[3].strip()
        weight_str = parts[4].strip() if len(parts) > 4 else "0"

        if not ticker or ticker == "-" or asset_class != "Equity":
            continue
        if any(x in name.upper() for x in ["CASH COLLATERAL", "FUTURES", "ISHARES", "SWAP", "TREASURY"]):
            continue

        try:
            weight = float(weight_str.replace(",", ""))
        except ValueError:
            weight = 0.0

        companies.append({
            "ticker": ticker,
            "name": name,
            "sector": sector,
            "weight": weight,
        })

    seen = set()
    unique = []
    for c in companies:
        if c["ticker"] not in seen:
            seen.add(c["ticker"])
            unique.append(c)
    return unique


# ─── Diff Logic ──────────────────────────────────────────────

def diff_tickers(
    current_preset: List[str], fresh_list: List[str]
) -> Tuple[Set[str], Set[str]]:
    """Return (added, removed) tickers."""
    current = set(current_preset)
    fresh = set(fresh_list)
    return fresh - current, current - fresh


# ─── Preset Update Logic ────────────────────────────────────

def update_sp500_presets(fresh_companies: List[Dict], added: Set[str], removed: Set[str]) -> int:
    """Update SP500 master and sub-presets. Returns number of files written."""
    master_path = PRESETS_DIR / "sp500.json"
    with open(master_path) as f:
        master = json.load(f)

    files_written = 0

    # ─── Handle removals ───
    for ticker in removed:
        # Remove from master tickers
        if ticker in master["tickers"]:
            master["tickers"].remove(ticker)

        # Remove from master pairs
        master["pairs"] = [p for p in master["pairs"] if ticker not in p]

        # Remove from groups
        for gkey, group in master["groups"].items():
            if ticker in group["tickers"]:
                group["tickers"].remove(ticker)
                group["pairs"] = [p for p in group["pairs"] if ticker not in p]

                # Re-pair orphaned partner if a pair was broken
                paired_tickers = set()
                for p in group["pairs"]:
                    paired_tickers.update(p)
                unpaired = [t for t in group["tickers"] if t not in paired_tickers]
                if len(unpaired) >= 2:
                    group["pairs"].append([unpaired[0], unpaired[1]])
                elif len(unpaired) == 1 and group["tickers"]:
                    # Pair with first ticker in group
                    group["pairs"].append([unpaired[0], group["tickers"][0]])

    # ─── Handle additions ───
    fresh_by_ticker = {c["ticker"]: c for c in fresh_companies}
    for ticker in added:
        info = fresh_by_ticker.get(ticker, {})
        sub_industry = info.get("sub_industry", "Unknown")
        sector = info.get("sector", "Unknown")

        # Add to master tickers
        if ticker not in master["tickers"]:
            master["tickers"].append(ticker)
            master["tickers"].sort()

        # Find or create the appropriate sub-industry group
        target_group = None
        for gkey, group in master["groups"].items():
            if group.get("name") == sub_industry:
                target_group = gkey
                break

        if target_group:
            group = master["groups"][target_group]
            if ticker not in group["tickers"]:
                group["tickers"].append(ticker)
                # Auto-pair with first unpaired ticker or last ticker
                paired_tickers = set()
                for p in group["pairs"]:
                    paired_tickers.update(p)
                unpaired = [t for t in group["tickers"] if t not in paired_tickers]
                if len(unpaired) >= 2:
                    new_pair = [unpaired[-2], unpaired[-1]]
                    group["pairs"].append(new_pair)
                    master["pairs"].append(new_pair)
        else:
            # New sub-industry — add to cross-industry group
            ci = master["groups"].get("cross-industry", {})
            if ci:
                if ticker not in ci.get("tickers", []):
                    ci.setdefault("tickers", []).append(ticker)

    # ─── Write master ───
    with open(master_path, "w") as f:
        json.dump(master, f, indent=2)
    files_written += 1

    # ─── Regenerate sub-presets ───
    for gkey, group in master["groups"].items():
        preset = {
            "name": f"sp500-{gkey}",
            "description": f"S&P 500 {group['name']} ({group.get('sector', 'Multi-Sector')})",
            "tickers": group["tickers"],
            "pairs": group["pairs"],
            "sector": group.get("sector", ""),
            "sub_industry": group.get("name", ""),
            "vol_driver": group.get("vol_driver", ""),
            "source": "S&P 500 GICS classification",
        }
        sub_path = PRESETS_DIR / f"sp500-{gkey}.json"
        with open(sub_path, "w") as f:
            json.dump(preset, f, indent=2)
        files_written += 1

    # ─── Regenerate sector rollups ───
    sector_groups = {}
    for c in fresh_companies:
        s = c["sector"]
        if s not in sector_groups:
            sector_groups[s] = []
        sector_groups[s].append(c["ticker"])

    for sector_name, tickers in sector_groups.items():
        key = sector_name.lower().replace(" ", "-")
        sector_pairs = []
        for gkey, g in master["groups"].items():
            if g.get("sector") == sector_name:
                sector_pairs.extend(g["pairs"])

        preset = {
            "name": f"sp500-sector-{key}",
            "description": f"S&P 500 {sector_name} sector — all sub-industries",
            "tickers": sorted(tickers),
            "pairs": sector_pairs,
            "sector": sector_name,
            "source": "S&P 500 GICS classification",
        }
        with open(PRESETS_DIR / f"sp500-sector-{key}.json", "w") as f:
            json.dump(preset, f, indent=2)
        files_written += 1

    return files_written


def update_ndx100_presets(fresh_companies: List[Dict], added: Set[str], removed: Set[str]) -> int:
    """Update NDX100 master and sub-presets."""
    master_path = PRESETS_DIR / "ndx100.json"
    with open(master_path) as f:
        master = json.load(f)

    # Update master tickers
    fresh_tickers = sorted(set(c["ticker"] for c in fresh_companies))
    master["tickers"] = fresh_tickers

    # Handle removals from groups
    for ticker in removed:
        master["pairs"] = [p for p in master["pairs"] if ticker not in p]
        for gkey, group in master["groups"].items():
            if ticker in group["tickers"]:
                group["tickers"].remove(ticker)
                group["pairs"] = [p for p in group["pairs"] if ticker not in p]

    # Handle additions — add to the closest matching group
    for ticker in added:
        # Default: add to misc-singles group
        misc = master["groups"].get("misc-singles")
        if misc and ticker not in misc["tickers"]:
            misc["tickers"].append(ticker)

    # Rebuild master pairs from groups
    master["pairs"] = []
    for g in master["groups"].values():
        master["pairs"].extend(g["pairs"])

    master["description"] = (
        f"NASDAQ 100 — {len(fresh_tickers)} companies, "
        f"{len(master['groups'])} groups, {len(master['pairs'])} curated pairs"
    )

    files_written = 0
    with open(master_path, "w") as f:
        json.dump(master, f, indent=2)
    files_written += 1

    # Regenerate sub-presets
    for gkey, group in master["groups"].items():
        preset = {
            "name": f"ndx100-{gkey}",
            "description": f"NASDAQ 100 {group['name']}",
            "tickers": group["tickers"],
            "pairs": group["pairs"],
            "sector": group.get("sector", ""),
            "vol_driver": group.get("vol_driver", ""),
            "source": "NASDAQ 100 Index",
        }
        with open(PRESETS_DIR / f"ndx100-{gkey}.json", "w") as f:
            json.dump(preset, f, indent=2)
        files_written += 1

    return files_written


def update_r2k_presets(fresh_companies: List[Dict], added: Set[str], removed: Set[str]) -> int:
    """Update R2K master and sub-presets."""
    master_path = PRESETS_DIR / "r2k.json"

    # Rebuild from scratch (R2K changes too many tickers to diff incrementally)
    sectors = {}
    for c in fresh_companies:
        s = c["sector"]
        if s not in sectors:
            sectors[s] = []
        sectors[s].append(c)

    # Sort by weight within each sector
    for s in sectors:
        sectors[s].sort(key=lambda x: -x.get("weight", 0))

    r2k_groups = {}
    all_pairs = []

    for sector_name, members in sorted(sectors.items(), key=lambda x: -len(x[1])):
        tickers = [m["ticker"] for m in members]
        pairs = []
        for i in range(0, len(tickers) - 1, 2):
            pairs.append([tickers[i], tickers[i + 1]])
        if len(tickers) % 2 == 1:
            pairs.append([tickers[-1], tickers[0]])

        key = sector_name.lower().replace(" ", "-").replace("&", "and")
        if not key:
            key = "other"

        r2k_groups[key] = {
            "name": sector_name,
            "sector": sector_name,
            "tickers": tickers,
            "pairs": pairs,
            "vol_driver": f"Russell 2000 {sector_name} — small-cap sector fundamentals",
        }
        all_pairs.extend(pairs)

    # Tier groups
    sorted_all = sorted(fresh_companies, key=lambda x: -x.get("weight", 0))
    tiers = {
        "top-100": (0, 100),
        "top-200": (0, 200),
        "top-500": (0, 500),
        "mid-500": (100, 600),
        "tail-500": (max(0, len(sorted_all) - 500), len(sorted_all)),
    }

    for tier_key, (start, end) in tiers.items():
        tier_companies = sorted_all[start:min(end, len(sorted_all))]
        tier_tickers = [c["ticker"] for c in tier_companies]
        tier_pairs = []
        for i in range(0, len(tier_tickers) - 1, 2):
            tier_pairs.append([tier_tickers[i], tier_tickers[i + 1]])

        r2k_groups[f"tier-{tier_key}"] = {
            "name": f"R2K {tier_key.replace('-', ' ').title()}",
            "sector": "Multi-Sector",
            "tickers": tier_tickers,
            "pairs": tier_pairs,
            "vol_driver": f"Small-cap factor exposure",
        }

    all_tickers = sorted(set(c["ticker"] for c in fresh_companies))

    master = {
        "name": "r2k",
        "description": f"Russell 2000 (IWM) — {len(all_tickers)} companies, {len(sectors)} sectors, {len(all_pairs)} pairs",
        "tickers": all_tickers,
        "pairs": all_pairs,
        "source": f"iShares Russell 2000 ETF (IWM) holdings, {datetime.now().strftime('%B %Y')}",
        "groups": r2k_groups,
    }

    files_written = 0
    with open(master_path, "w") as f:
        json.dump(master, f, indent=2)
    files_written += 1

    for key, g in sorted(r2k_groups.items()):
        preset = {
            "name": f"r2k-{key}",
            "description": f"Russell 2000 {g['name']} ({len(g['tickers'])} companies)",
            "tickers": g["tickers"],
            "pairs": g["pairs"],
            "sector": g["sector"],
            "vol_driver": g["vol_driver"],
            "source": "iShares Russell 2000 ETF (IWM) holdings",
        }
        with open(PRESETS_DIR / f"r2k-{key}.json", "w") as f:
            json.dump(preset, f, indent=2)
        files_written += 1

    return files_written


# ─── Changelog ───────────────────────────────────────────────

def log_changes(index: str, added: Set[str], removed: Set[str]):
    """Append to changelog.json."""
    changelog = []
    if CHANGELOG_PATH.exists():
        try:
            with open(CHANGELOG_PATH) as f:
                changelog = json.load(f)
        except (json.JSONDecodeError, KeyError):
            changelog = []

    entry = {
        "timestamp": datetime.now().isoformat(),
        "index": index,
        "added": sorted(added),
        "removed": sorted(removed),
        "added_count": len(added),
        "removed_count": len(removed),
    }
    changelog.append(entry)

    # Keep last 100 entries
    changelog = changelog[-100:]

    with open(CHANGELOG_PATH, "w") as f:
        json.dump(changelog, f, indent=2)


# ─── Main Handler ────────────────────────────────────────────

def execute() -> dict:
    """
    Check all three indices for constituent changes.
    Called by the monitor daemon weekly.

    Returns:
        dict with status, changes detected, files written.
    """
    results = {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "indices": {},
        "total_changes": 0,
        "total_files_written": 0,
    }

    # ─── S&P 500 ───
    try:
        logger.info("Fetching S&P 500 constituents...")
        sp500_fresh = fetch_sp500()
        sp500_tickers = [c["ticker"] for c in sp500_fresh]

        master_path = PRESETS_DIR / "sp500.json"
        with open(master_path) as f:
            current = json.load(f)

        added, removed = diff_tickers(current["tickers"], sp500_tickers)

        if added or removed:
            logger.info(f"SP500: +{len(added)} -{len(removed)} changes detected")
            files = update_sp500_presets(sp500_fresh, added, removed)
            log_changes("sp500", added, removed)
            results["indices"]["sp500"] = {
                "added": sorted(added),
                "removed": sorted(removed),
                "files_written": files,
            }
            results["total_changes"] += len(added) + len(removed)
            results["total_files_written"] += files
        else:
            logger.info("SP500: No changes")
            results["indices"]["sp500"] = {"added": [], "removed": [], "files_written": 0}

    except Exception as e:
        logger.error(f"SP500 fetch failed: {e}")
        results["indices"]["sp500"] = {"error": str(e)}

    # ─── NASDAQ 100 ───
    try:
        logger.info("Fetching NASDAQ 100 constituents...")
        ndx_fresh = fetch_ndx100()
        ndx_tickers = [c["ticker"] for c in ndx_fresh]

        master_path = PRESETS_DIR / "ndx100.json"
        with open(master_path) as f:
            current = json.load(f)

        added, removed = diff_tickers(current["tickers"], ndx_tickers)

        if added or removed:
            logger.info(f"NDX100: +{len(added)} -{len(removed)} changes detected")
            files = update_ndx100_presets(ndx_fresh, added, removed)
            log_changes("ndx100", added, removed)
            results["indices"]["ndx100"] = {
                "added": sorted(added),
                "removed": sorted(removed),
                "files_written": files,
            }
            results["total_changes"] += len(added) + len(removed)
            results["total_files_written"] += files
        else:
            logger.info("NDX100: No changes")
            results["indices"]["ndx100"] = {"added": [], "removed": [], "files_written": 0}

    except Exception as e:
        logger.error(f"NDX100 fetch failed: {e}")
        results["indices"]["ndx100"] = {"error": str(e)}

    # ─── Russell 2000 ───
    try:
        logger.info("Fetching Russell 2000 constituents...")
        r2k_fresh = fetch_r2k()
        r2k_tickers = [c["ticker"] for c in r2k_fresh]

        master_path = PRESETS_DIR / "r2k.json"
        with open(master_path) as f:
            current = json.load(f)

        added, removed = diff_tickers(current["tickers"], r2k_tickers)

        if added or removed:
            logger.info(f"R2K: +{len(added)} -{len(removed)} changes detected")
            files = update_r2k_presets(r2k_fresh, added, removed)
            log_changes("r2k", added, removed)
            results["indices"]["r2k"] = {
                "added": sorted(added),
                "removed": sorted(removed),
                "files_written": files,
            }
            results["total_changes"] += len(added) + len(removed)
            results["total_files_written"] += files
        else:
            logger.info("R2K: No changes")
            results["indices"]["r2k"] = {"added": [], "removed": [], "files_written": 0}

    except Exception as e:
        logger.error(f"R2K fetch failed: {e}")
        results["indices"]["r2k"] = {"error": str(e)}

    return results


# ─── CLI ─────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Index Rebalance Checker")
    parser.add_argument("--dry-run", action="store_true", help="Check only, don't update")
    parser.add_argument("--index", choices=["sp500", "ndx100", "r2k"], help="Check single index")
    parser.add_argument("--changelog", action="store_true", help="Show recent changelog")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(message)s")

    if args.changelog:
        if CHANGELOG_PATH.exists():
            with open(CHANGELOG_PATH) as f:
                entries = json.load(f)
            print(f"\n=== PRESET CHANGELOG ({len(entries)} entries) ===\n")
            for e in entries[-10:]:
                print(f"  {e['timestamp'][:19]}  {e['index']:8s}  +{e['added_count']} -{e['removed_count']}")
                if e["added"]:
                    print(f"    Added: {', '.join(e['added'][:10])}")
                if e["removed"]:
                    print(f"    Removed: {', '.join(e['removed'][:10])}")
        else:
            print("No changelog yet.")
        exit(0)

    if args.dry_run:
        print("\n=== DRY RUN — checking for changes ===\n")

        checks = {
            "sp500": (fetch_sp500, "sp500.json"),
            "ndx100": (fetch_ndx100, "ndx100.json"),
            "r2k": (fetch_r2k, "r2k.json"),
        }

        indices = [args.index] if args.index else ["sp500", "ndx100", "r2k"]

        for idx in indices:
            fetcher, master_file = checks[idx]
            try:
                fresh = fetcher()
                fresh_tickers = [c["ticker"] for c in fresh]
                with open(PRESETS_DIR / master_file) as f:
                    current = json.load(f)
                added, removed = diff_tickers(current["tickers"], fresh_tickers)

                if added or removed:
                    print(f"  {idx.upper():8s}: ⚠️  CHANGES DETECTED")
                    if added:
                        print(f"    + Added ({len(added)}): {', '.join(sorted(added)[:20])}")
                    if removed:
                        print(f"    - Removed ({len(removed)}): {', '.join(sorted(removed)[:20])}")
                else:
                    print(f"  {idx.upper():8s}: ✅ No changes ({len(fresh_tickers)} tickers)")
            except Exception as e:
                print(f"  {idx.upper():8s}: ❌ Error — {e}")
    else:
        result = execute()
        print(f"\n=== INDEX REBALANCE CHECK ===\n")
        print(f"  Total changes: {result['total_changes']}")
        print(f"  Files written: {result['total_files_written']}")
        for idx, info in result["indices"].items():
            if "error" in info:
                print(f"  {idx}: ❌ {info['error']}")
            else:
                added = len(info.get("added", []))
                removed = len(info.get("removed", []))
                if added or removed:
                    print(f"  {idx}: +{added} -{removed}")
                else:
                    print(f"  {idx}: ✅ No changes")
