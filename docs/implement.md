# Execution Runbook

## Source of Truth
- `docs/plans.md` defines the milestone sequence
- `docs/prompt.md` defines constraints and "done when"
- Execute milestones IN ORDER, do not skip

## Operating Rules

### 1. Validate Before Assuming
- NEVER identify a ticker from memory/training data
- ALWAYS run `fetch_ticker.py` first to get verified company info
- If script fails or returns no data, state "UNVERIFIED" and flag uncertainty

### 2. Milestone Discipline
- Complete each milestone fully before proceeding
- Run validation command for each milestone
- If validation fails → repair immediately, do not continue
- If stop condition met → halt and report which gate failed

### 3. No Rationalization
- If a gate fails, stop evaluation
- Do not "find reasons" to proceed anyway
- State the failing gate clearly and move on

### 4. Diffs Stay Scoped
- When updating portfolio.json, only modify relevant fields
- When appending to trade_log.json, append only (never overwrite history)
- Keep watchlist.json updates minimal and targeted

### 5. Continuous Documentation
- Update `docs/status.md` after each evaluation
- Log EXECUTED trades only to trade_log.json (with full details)
- Log NO_TRADE decisions to docs/status.md (Recent Evaluations section)
- Include timestamp, ticker, decision, and rationale

### 6. Verification Commands
After any trade decision:
```bash
# Validate JSON integrity
python3 -m json.tool data/portfolio.json
python3 -m json.tool data/trade_log.json
python3 -m json.tool data/watchlist.json
```

### 7. Error Recovery
If a script fails:
1. Check error message
2. Attempt repair if obvious (missing dependency, API issue)
3. If unrecoverable, log the failure and flag for manual review
4. Do not fabricate data

---

## Command Reference

### Evaluation Commands
| Action | Command |
|--------|---------|
| Validate ticker | `python3 scripts/fetch_ticker.py [TICKER]` |
| Fetch dark pool flow | `python3 scripts/fetch_flow.py [TICKER]` |
| Fetch options data | `python3 scripts/fetch_options.py [TICKER]` |
| Fetch options (JSON) | `python3 scripts/fetch_options.py [TICKER] --json` |
| Fetch analyst ratings | `python3 scripts/fetch_analyst_ratings.py [TICKER]` |
| Calculate Kelly | `python3 scripts/kelly.py --prob P --odds O --bankroll B` |

### Portfolio Commands
| Action | Command |
|--------|---------|
| Sync IB portfolio | `python3 scripts/ib_sync.py --sync` |
| Run reconciliation | `python3 scripts/ib_reconcile.py` |
| View today's fills | `python3 scripts/blotter.py` |
| Fetch historical trades | `python3 scripts/trade_blotter/flex_query.py --symbol [TICKER]` |
| Start realtime server | `node scripts/ib_realtime_server.js` |
| Validate JSON | `python3 -m json.tool data/[file].json` |

### Order Execution Commands
| Action | Command |
|--------|---------|
| Place single-leg order | `python3 scripts/ib_order.py --symbol X --expiry YYYYMMDD --strike N --right C/P --qty N --side BUY/SELL --limit N` |
| Monitor order for fills | `python3 scripts/ib_fill_monitor.py --order-id N` |
| Monitor symbol orders | `python3 scripts/ib_fill_monitor.py --symbol GOOG` |
| Check pending exits | `python3 scripts/exit_order_service.py --status` |
| Run exit order check | `python3 scripts/exit_order_service.py` |
| Exit service daemon | `python3 scripts/exit_order_service.py --daemon` |
| Install exit service | `./scripts/setup_exit_order_service.sh install` |
| Exit service status | `./scripts/setup_exit_order_service.sh status` |

### IB Connection Ports
| Port | Environment |
|------|-------------|
| 7496 | TWS Live |
| 7497 | TWS Paper |
| 4001 | IB Gateway Live |
| 4002 | IB Gateway Paper |

---

## Trade Specification Reports

**ALWAYS generate a Trade Specification HTML report when recommending a trade.**

```bash
# Template
.pi/skills/html-report/trade-specification-template.html

# Output
reports/{ticker}-evaluation-{date}.html
```

**Workflow:**
1. Complete evaluation milestones 1-6
2. Generate HTML report using template
3. Present to user for confirmation
4. On "execute" → place order via IB
5. Monitor fills with `ib_fill_monitor.py`
6. On fill → update trade_log.json, portfolio.json, status.md
7. Place exit orders (stop loss + target)

**Reference:** `reports/goog-evaluation-2026-03-04.html`

---

## Order Execution Workflow

### Placing Orders

**Single-leg option:**
```bash
python3 scripts/ib_order.py \
  --symbol GOOG \
  --expiry 20260417 \
  --strike 315 \
  --right C \
  --qty 44 \
  --side BUY \
  --limit 8.90
```

**Multi-leg spread:** Use inline Python with `ib_insync` (see `ib-order-execution` skill)

### Monitoring Fills
```bash
# By order ID
python3 scripts/ib_fill_monitor.py --order-id 7

# By symbol
python3 scripts/ib_fill_monitor.py --symbol GOOG --timeout 300

# JSON output for automation
python3 scripts/ib_fill_monitor.py --order-id 7 --json
```

### Exit Orders

After entry fill, place exit orders:
1. **Stop Loss** — Stop-limit order at stop price
2. **Target Profit** — Limit sell order at target

**Note:** IB rejects limit orders >40% from current price. Use exit order service.

---

## Exit Order Service

Automatically places pending target orders when IB will accept them.

**Check status:**
```bash
python3 scripts/exit_order_service.py --status
```

**Run single check:**
```bash
python3 scripts/exit_order_service.py
```

**Run as daemon (every 5 min during market hours):**
```bash
python3 scripts/exit_order_service.py --daemon
```

**Install as launchd service:**
```bash
./scripts/setup_exit_order_service.sh install
./scripts/setup_exit_order_service.sh status
./scripts/setup_exit_order_service.sh logs
```

**Logs:** `logs/exit-order-service.out.log`

---

## Options Flow Analysis

The `fetch_options.py` script provides comprehensive options analysis:

```bash
# Full analysis with formatted report
python3 scripts/fetch_options.py AAPL

# JSON output for programmatic use
python3 scripts/fetch_options.py AAPL --json

# Force specific data source
python3 scripts/fetch_options.py AAPL --source uw   # Unusual Whales
python3 scripts/fetch_options.py AAPL --source ib   # Interactive Brokers
python3 scripts/fetch_options.py AAPL --source yahoo # Yahoo Finance
```

**Output includes:**
- Chain: Premium, volume, OI, bid/ask volume, P/C ratio, bias
- Flow: Institutional alerts, sweeps, bid/ask side premium, flow strength
- Combined: Synthesized bias with conflict detection and confidence rating

---

## Trade Blotter & P&L

### Today's Fills
```bash
python3 scripts/blotter.py
```

Shows:
- All executions grouped by contract
- Spread detection (put spreads, call spreads, risk reversals)
- Combined P&L for multi-leg positions
- Commission totals

### Historical Trades (Flex Query)
```bash
# All trades
python3 scripts/trade_blotter/flex_query.py

# Filter by symbol
python3 scripts/trade_blotter/flex_query.py --symbol EWY
```

Requires `IB_FLEX_TOKEN` and `IB_FLEX_QUERY_ID` environment variables.

---

## P&L Reports

When generating P&L reports, use the template:
```
.pi/skills/html-report/pnl-template.html
```

**Required sections:**
1. Header with CLOSED/OPEN status pill
2. 4 metrics: Realized P&L, Commissions, Hold Period, Return on Risk
3. Trade Summary callout
4. Execution table(s) with cash flows
5. Combined P&L panel (for spreads)
6. Trade timeline
7. Footer with data source

**Return on Risk formula:**
```
Return on Risk = Realized P&L / Capital at Risk

Capital at Risk:
  - Debit spread: Net debit paid
  - Credit spread: Max loss (width - credit)
  - Long option: Premium paid
  - Stock: Cost basis
```

---

## Startup Reconciliation

The startup extension automatically runs `ib_reconcile.py` when Pi starts:

- **Async**: Does not block Pi startup
- **Detects**: New trades, new positions, closed positions
- **Output**: `data/reconciliation.json`
- **Notification**: Shows if action needed

Manual run:
```bash
python3 scripts/ib_reconcile.py
```

Check results:
```bash
cat data/reconciliation.json | python3 -m json.tool
```

---

## Data File Locations

| File | Purpose |
|------|---------|
| `data/trade_log.json` | Executed trades (append-only) |
| `data/portfolio.json` | Current positions from IB |
| `data/reconciliation.json` | IB sync discrepancies |
| `data/watchlist.json` | Tickers under surveillance |
| `data/ticker_cache.json` | Ticker → company name cache |
| `data/analyst_ratings_cache.json` | Cached analyst data |
