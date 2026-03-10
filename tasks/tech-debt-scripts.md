# Technical Debt Inventory: `scripts/`

**Repository**: radon
**Analysis Date**: 2026-03-04
**Scope**: `scripts/` directory (22 Python files, 8,252 LOC)
**Total Debt Items**: 16

---

## Executive Summary

| Severity | Count | Action |
|----------|------:|--------|
| Critical | 3 | Fix immediately |
| High | 4 | Next sprint |
| Medium | 5 | Next quarter |
| Low | 4 | Backlog |

The scripts folder has **one dominant problem**: massive code duplication across UW API helpers, market calendar utilities, and IB connection patterns. Four files copy-paste identical functions. Fixing this single issue resolves ~40% of all debt items and dramatically reduces maintenance burden.

Secondary concerns: a hardcoded expiry date time bomb, no linting config, embedded HTML templates, and Python 3.9.6 (EOL Dec 2025).

---

## Debt by Category

| Category | Items | Severity | Est. Effort |
|----------|------:|----------|-------------|
| Code Quality | 5 | High | 3 days |
| Test Coverage | 1 | Medium | 1 day |
| Documentation | 1 | Low | 0.5 days |
| Dependencies | 2 | Medium | 1 day |
| Design | 4 | Critical/High | 3 days |
| Infrastructure | 2 | Critical/Medium | 1 day |
| Performance | 1 | Low | 0.5 days |

---

## Inventory (Ranked by Impact)

### CRITICAL

#### 1. Massive Code Duplication — UW API Helpers
- **Files**: `discover.py`, `fetch_flow.py`, `fetch_ticker.py`, `leap_scanner_uw.py`
- **What**: `_get_token()`, `_api_get()`, `BASE_URL`, `MARKET_HOLIDAYS_2026`, `is_market_open()`, `get_last_n_trading_days()` are copy-pasted across 4 files
- **Impact**: Bug fixes or holiday updates must be applied in 4 places. Already caused inconsistent naming (`_get_token` vs `get_uw_token`, `_api_get` vs `uw_api_get`)
- **Fix**: Extract `scripts/utils/uw_api.py` and `scripts/utils/market_calendar.py`
- **Effort**: 1 day
- **Quadrant**: Inadvertent/Reckless

#### 2. Hardcoded Expiry Date (Time Bomb)
- **File**: `exit_order_service.py:266`
- **What**: `expiry = "20260417"  # TODO: Extract from contract description`
- **Impact**: Exit order daemon silently breaks after April 17, 2026. Orders won't be placed.
- **Fix**: Parse expiry from the pending order's contract description
- **Effort**: 0.5 days
- **Quadrant**: Deliberate/Reckless

#### 3. Year-Specific Holiday List
- **Files**: `discover.py`, `fetch_flow.py`, `fetch_ticker.py`, `exit_order_service.py`
- **What**: `MARKET_HOLIDAYS_2026` hardcoded for 2026 only, in 4 files
- **Impact**: All `is_market_open()` checks silently return wrong results starting Jan 2027
- **Fix**: Use `exchange_calendars` package or load from config file
- **Effort**: 0.5 days
- **Quadrant**: Deliberate/Prudent (acceptable short-term, needs yearly update)

---

### HIGH

#### 4. No Central IB Connection Configuration
- **Files**: 8 scripts each hardcode `host`, `port`, `client_id`
- **What**: Client IDs scattered: sync=1, order=2, orders=11, monitor=52, exit=60, reconcile=90, ratings=99, realtime=100
- **Impact**: Adding a new IB script requires checking all existing IDs to avoid conflicts. Port changes require editing 8 files.
- **Fix**: Create `scripts/utils/ib_connection.py` with a factory and client ID registry
- **Effort**: 1 day

#### 5. Inconsistent HTTP Libraries
- **Files**: `discover.py`, `fetch_flow.py`, `fetch_ticker.py` use `urllib`; `fetch_options.py`, `leap_scanner_uw.py` use `requests`
- **Impact**: Two patterns to maintain, different error handling, different auth patterns
- **Fix**: Standardize on `requests` (already a dependency, cleaner API)
- **Effort**: 0.5 days

#### 6. 700 Lines of Embedded HTML in Python
- **Files**: `leap_iv_scanner.py` (~500 lines), `leap_scanner_uw.py` (~200 lines)
- **What**: `generate_html_report()` contains raw HTML/CSS/JS template strings
- **Impact**: Impossible to maintain, no syntax highlighting, no template reuse
- **Fix**: Extract to Jinja2 templates or separate HTML files
- **Effort**: 1 day

#### 7. Bare `except:` Clauses
- **Files**: `fetch_analyst_ratings.py:105,394`, `ib_fill_monitor.py:69,155`, `leap_iv_scanner.py:~379`
- **What**: Catches *all* exceptions including `KeyboardInterrupt`, `SystemExit`
- **Impact**: Silently swallows real errors, makes debugging impossible
- **Fix**: Use `except Exception:` at minimum, or catch specific exceptions
- **Effort**: 0.5 days

---

### MEDIUM

#### 8. Duplicated HV Calculation
- **Files**: `leap_iv_scanner.py`, `leap_scanner_uw.py`
- **What**: Both implement `calculate_historical_volatility()` / `calculate_hv()` with Yahoo Finance
- **Fix**: Extract to `scripts/utils/volatility.py`
- **Effort**: 0.5 days

#### 9. Duplicated Formatting in Trade Blotter
- **Files**: `trade_blotter/flex_query.py`, `trade_blotter/cli.py`
- **What**: `format_currency()`, `format_pnl()` duplicated; `FlexQueryFetcher` exists in both `blotter_service.py` and `flex_query.py`
- **Fix**: Consolidate in `models.py` or shared `formatting.py`
- **Effort**: 0.5 days

#### 10. No Linting Configuration
- **What**: No `.pylintrc`, `pyproject.toml`, `ruff.toml`, `.flake8` anywhere in the project
- **Impact**: No automated quality enforcement, inconsistent style
- **Fix**: Add `ruff` config in `pyproject.toml` (fastest Python linter, single tool)
- **Effort**: 0.5 days

#### 11. Python 3.9.6 (EOL)
- **What**: Python 3.9 reached end-of-life October 2025
- **Impact**: No security patches, missing modern features (match/case, tomllib, ExceptionGroup)
- **Fix**: Upgrade to Python 3.12+
- **Effort**: 0.5 days (low risk — no Python 3.10+ features used)

#### 12. `scanner.py` Architecture
- **File**: `scanner.py`
- **What**: Calls `fetch_flow.py` via `subprocess.run` instead of importing. Uses relative path `Path("data/watchlist.json")` that breaks from different CWDs.
- **Fix**: Import `fetch_flow` functions directly; use `Path(__file__).parent` for paths
- **Effort**: 0.5 days

---

### LOW

#### 13. `kelly_calc.py` is Dead Code
- **What**: Entirely hardcoded WULF LEAP analysis — `stock_price = 16.28`, `bankroll = 981353`
- **Fix**: Move to `scratch/` or delete
- **Effort**: 5 min

#### 14. `fetch_ticker.py` Uses Manual `sys.argv` Parsing
- **What**: Every other script uses `argparse`; this one manually parses `sys.argv`
- **Fix**: Convert to `argparse`
- **Effort**: 15 min

#### 15. `fetch_x_watchlist.py` Shell Injection Risk
- **File**: `fetch_x_watchlist.py`
- **What**: Uses `subprocess.run` with `shell=True`
- **Impact**: Low (input comes from config, not user), but poor practice
- **Fix**: Use list-form arguments
- **Effort**: 15 min

#### 16. NaN Check Pattern
- **File**: `ib_realtime_server.py`
- **What**: Uses `value == value` instead of `math.isnan(value)` for NaN detection
- **Impact**: Works correctly but confuses readers
- **Fix**: Use `math.isnan()` with guard for None
- **Effort**: 15 min

---

## Refactoring Roadmap

### Sprint 1: Extract Shared Utilities (3 days) — Resolves items 1, 3, 4, 5

Create `scripts/utils/` package:

```
scripts/utils/
  __init__.py
  uw_api.py          # UW token, API client, base URL
  market_calendar.py # holidays (config-driven), is_market_open(), trading days
  ib_connection.py   # connect_ib() factory, CLIENT_ID registry, default ports
```

Update all 8+ consumer scripts to import from shared modules.

**Acceptance Criteria:**
- [ ] Zero duplicated UW helpers across `discover.py`, `fetch_flow.py`, `fetch_ticker.py`, `leap_scanner_uw.py`
- [ ] Single `MARKET_HOLIDAYS` source (JSON config file, not hardcoded)
- [ ] IB client ID registry prevents conflicts
- [ ] All scripts standardized on `requests` for HTTP
- [ ] Existing tests still pass

### Sprint 2: Code Quality (1.5 days) — Resolves items 7, 10, 14, 15, 16

- [ ] Replace all bare `except:` with `except Exception:`
- [ ] Add `pyproject.toml` with ruff config
- [ ] Run ruff and fix auto-fixable issues
- [ ] Convert `fetch_ticker.py` to argparse
- [ ] Fix `shell=True` in `fetch_x_watchlist.py`
- [ ] Replace `val == val` NaN checks with `math.isnan()`

### Sprint 3: Template Extraction & Cleanup (2 days) — Resolves items 6, 8, 9, 12, 13

- [ ] Extract HTML reports to template files
- [ ] Shared `volatility.py` for HV calculation
- [ ] Consolidate trade blotter formatting
- [ ] Fix `scanner.py` to use imports + absolute paths
- [ ] Move `kelly_calc.py` to `scratch/`

### Sprint 4: Time Bombs & Infrastructure (1 day) — Resolves items 2, 11

- [ ] Fix hardcoded expiry in `exit_order_service.py`
- [ ] Upgrade Python to 3.12+
- [ ] Verify all scripts work on new Python version

---

## Metrics Snapshot

| Metric | Current | Target |
|--------|---------|--------|
| Duplicated functions | 18+ across 4 files | 0 |
| Bare `except:` | 5 | 0 |
| Hardcoded dates | 5 (holidays + expiry) | 0 (config-driven) |
| Linting config | None | ruff in pyproject.toml |
| Python version | 3.9.6 (EOL) | 3.12+ |
| Lines in largest file | 1,195 | < 500 |
| IB client IDs documented | 0 (scattered) | 1 registry |
| HTTP library consistency | 2 (urllib + requests) | 1 (requests) |

---

## IB Client ID Registry (for reference)

| ID | Script | Purpose |
|---:|--------|---------|
| 1 | `ib_sync.py` | Portfolio sync |
| 2 | `ib_order.py` | Order placement |
| 11 | `ib_orders.py` | Order sync |
| 52 | `ib_fill_monitor.py` | Fill monitoring |
| 60 | `exit_order_service.py` | Exit order daemon |
| 90 | `ib_reconcile.py` | Reconciliation |
| 99 | `fetch_analyst_ratings.py` | Analyst data |
| 100 | `ib_realtime_server.py` | Real-time streaming |
| 101 | `ib_realtime_server.js` | Real-time streaming (JS) |
