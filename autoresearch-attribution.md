# Autoresearch: Portfolio Performance Attribution Engine

## Objective
Build a portfolio attribution engine that decomposes P&L into actionable dimensions: by strategy, by edge type, by ticker, and Kelly calibration accuracy. The engine reads `data/trade_log.json` + `data/performance.json` + `data/strategies.json`, computes attribution metrics, outputs JSON, and is surfaced via a new section on the `/performance` page in the web dashboard.

## Metrics
- **Primary**: `attribution_score` (unitless 0–100, higher is better) — composite score of how many attribution dimensions are computed, validated, and rendered in the UI
- **Secondary**: `dimensions` — number of attribution dimensions passing validation, `build_s` — web build time, `test_count` — number of new tests passing

## How to Run
`./autoresearch-attribution.sh` — runs Python attribution tests + web build + outputs `METRIC` lines.

**⚠️ Suffixed files to avoid collision with concurrent bundle-size autoresearch session.**

## Scoring Rubric (100 points total)

| Points | Milestone | Description |
|--------|-----------|-------------|
| 10 | M1: Strategy classifier | Classify every trade_log entry into one of 6 strategies |
| 10 | M2: Strategy P&L | Realized P&L aggregated per strategy |
| 10 | M3: Strategy win rate | Win/loss count and hit rate per strategy |
| 10 | M4: Kelly calibration | Predicted vs actual win rate per strategy |
| 10 | M5: Ticker attribution | P&L by ticker with best/worst |
| 10 | M6: Edge quality | P&L split by edge type (DP flow, IV mispricing, thesis, none) |
| 10 | M7: Risk profile | P&L split by defined vs undefined risk |
| 10 | M8: API route | `/api/attribution` route serving the JSON |
| 10 | M9: UI panel | AttributionPanel component rendering on /performance page |
| 10 | M10: Integration | Full round-trip: trade_log → Python → API → UI with real data |

## Files in Scope
- `scripts/portfolio_attribution.py` — **NEW** — core attribution engine
- `scripts/tests/test_portfolio_attribution.py` — **NEW** — Python unit tests
- `web/components/AttributionPanel.tsx` — **NEW** — React UI component
- `web/app/api/attribution/route.ts` — **NEW** — Next.js API route
- `web/lib/types.ts` — Add attribution types (APPEND ONLY)
- `web/lib/useAttribution.ts` — **NEW** — React data hook
- `web/components/PerformancePanel.tsx` — Import AttributionPanel
- `web/tests/attribution.test.ts` — **NEW** — Vitest tests

## Off Limits
- Existing `web/tests/` and `web/e2e/` files
- `scripts/portfolio_performance.py` (read only)
- `data/trade_log.json`, `data/strategies.json`, `data/performance.json` (read only)
- `web/package.json` / `web/package-lock.json` (no new deps)
- `autoresearch.sh` / `autoresearch.checks.sh` / `autoresearch.md` (owned by bundle-size session)

## Constraints
- No new npm dependencies
- Must not break existing vitest tests (9 pre-existing file failures allowed)
- Web build must succeed
- Python tests via `python3 -m pytest`
- Deterministic attribution (same input → same output)
- Radon brand identity (teal #05AD98, dark surfaces, Inter + IBM Plex Mono, 4px radius)

## Strategy Classification Rules

| Strategy ID | Classification Signal |
|-------------|----------------------|
| `dark-pool-flow` | `edge_analysis.edge_type` contains "DARK_POOL" OR gates mention "EDGE" with dp_strength > 50 |
| `leap-iv-mispricing` | `edge_analysis.edge_type` contains "IV_MISPRICING" OR structure contains "LEAP" |
| `garch-convergence` | `edge_analysis.edge_type` contains "GARCH" |
| `risk-reversal` | structure contains "Risk Reversal" OR risk_profile == "UNDEFINED" with short put + long call |
| `vcg` | `edge_analysis.edge_type` contains "VCG" |
| `cri` | `edge_analysis.edge_type` contains "CRI" OR ticker in ("SPXU","SPY") with put structure |
| `unclassified` | Anything else (equity trades, auto-imports without metadata) |

Primary edge takes precedence when a trade has multiple signals (e.g., IV_MISPRICING + FLOW_CONFLUENCE → leap-iv-mispricing).

## What's Been Tried

### Experiment 1: Full engine build (0 → 100/100) ✅
Built all 10 milestones in a single pass:
- Python engine: 41 tests covering classify, P&L, win rate, Kelly calibration, ticker, edge, risk
- API route: `/api/attribution` spawns Python, returns JSON
- UI panel: AttributionPanel with strategy table, edge/risk grids, ticker leaderboard, Kelly calibration
- Integration: 7 vitest tests validating types compile and hold realistic data
- Wired into PerformancePanel at bottom of existing content

**Key finding**: 30/39 trades classify as "unclassified" because most were auto-imported from IB reconciliation without `edge_analysis` metadata. This is correct behavior — the attribution engine honestly reveals that most P&L comes from trades outside the formal evaluation pipeline. As more trades flow through `evaluate.py`, the strategy attribution will become more populated.

**Real data output**:
- Total: $126,927 realized P&L across 23 closed trades
- Best ticker: AAOI (+$86,818), Worst: BRZE (-$23,285)
- Risk reversals: 100% win rate (2/2 closed), +$15,889
- LEAPs: 3 open, 0 closed (too early for attribution)
- Dark pool flow: 1 open (GOOG), 0 closed

