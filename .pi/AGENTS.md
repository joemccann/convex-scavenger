# Convex Scavenger — Project Instructions

## Workflow Commands

| Command | Action |
|---------|--------|
| `scan` | Scan watchlist for dark pool flow signals |
| `discover` | Find new candidates from market-wide options flow |
| `evaluate [TICKER]` | Full 7-milestone evaluation |
| `portfolio` | Current positions, exposure, capacity |
| `journal` | View recent trade log entries |

## Evaluation Milestones

Always follow in order. Stop immediately if a gate fails.

1. **Validate Ticker** → `python3 scripts/fetch_ticker.py [TICKER]`
2. **Dark Pool Flow** → `python3 scripts/fetch_flow.py [TICKER]`
3. **Options Flow** → `python3 scripts/fetch_options.py [TICKER]`
4. **Edge Decision** → PASS/FAIL with reasoning (stop if FAIL)
5. **Structure** → Design convex position (stop if R:R < 2:1)
6. **Kelly Sizing** → Calculate + enforce caps
7. **Log Decision** → Append to trade_log.json

## Output Format

- Always show: signal → structure → Kelly math → decision
- State probability estimates explicitly, flag uncertainty
- When a trade doesn't meet criteria, say so immediately with the failing gate
- Never rationalize a bad trade
- Log ALL decisions (TRADE and NO_TRADE)

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/fetch_ticker.py` | Validate ticker via dark pool activity |
| `scripts/fetch_flow.py` | Fetch dark pool + options flow data |
| `scripts/fetch_options.py` | Options chain data (stub) |
| `scripts/scanner.py` | Scan watchlist, rank by signal strength |
| `scripts/discover.py` | Market-wide flow scanner for new candidates |
| `scripts/kelly.py` | Kelly criterion calculator |

## Data Files

| File | Purpose |
|------|---------|
| `data/watchlist.json` | Tickers under surveillance with flow signals |
| `data/portfolio.json` | Open positions, entry prices, Kelly sizes, expiry dates |
| `data/trade_log.json` | Append-only decision journal (TRADE + NO_TRADE) |
| `data/ticker_cache.json` | Local cache of ticker → company name mappings |

## Documentation

| File | Purpose |
|------|---------|
| `docs/prompt.md` | Spec, constraints, deliverables |
| `docs/plans.md` | Milestone workflow with validation steps |
| `docs/implement.md` | Execution runbook |
| `docs/status.md` | Current state, recent decisions, audit log |

## Tools Available

- `bash` — Run Python scripts in ./scripts/
- `read`/`write`/`edit` — Manage data and documentation files
- `kelly_calc` — Built-in fractional Kelly calculator

## Discovery Scoring (0-100 Scale)

When running `discover`, candidates are scored on edge quality:

| Component | Weight | Measure |
|-----------|--------|---------|
| DP Strength | 30% | Dark pool flow imbalance (0-100) |
| DP Sustained | 20% | Consecutive days same direction |
| Confluence | 20% | Options + DP alignment |
| Vol/OI Ratio | 15% | Unusual volume indicator |
| Sweeps | 15% | Urgency signal |

Score interpretation:
- **60-100**: Strong — worth full evaluation
- **40-59**: Moderate — monitor closely
- **20-39**: Weak — early stage or conflicting
- **0-19**: No actionable signal
