# Convex Scavenger — Project Instructions

## Workflow Commands

| Command | Action |
|---------|--------|
| `scan` | Scan watchlist for dark pool flow signals |
| `discover` | Find new candidates from market-wide options flow |
| `evaluate [TICKER]` | Full 7-milestone evaluation |
| `portfolio` | Current positions, exposure, capacity |
| `journal` | View recent trade log entries |
| `sync` | Pull live portfolio from Interactive Brokers |
| `leap-scan [TICKERS]` | Scan for LEAP IV mispricing opportunities |
| `seasonal [TICKERS]` | Seasonality assessment for one or more tickers |
| `x-scan [@ACCOUNT]` | Fetch latest tweets and extract ticker sentiment |

## Evaluation Milestones

Always follow in order. Stop immediately if a gate fails.

1. **Validate Ticker** → `python3 scripts/fetch_ticker.py [TICKER]`
1B. **Seasonality** → Fetch & analyze (does not affect score, but report in analysis)
2. **Dark Pool Flow** → `python3 scripts/fetch_flow.py [TICKER]`
3. **Options Flow** → `python3 scripts/fetch_options.py [TICKER]`
4. **Edge Decision** → PASS/FAIL with reasoning (stop if FAIL)
5. **Structure** → Design convex position (stop if R:R < 2:1)
6. **Kelly Sizing** → Calculate + enforce caps
7. **Log Trade** → Append executed trades only to trade_log.json (NO_TRADE decisions go to status.md)

## Seasonality Data

Fetch monthly performance data from EquityClock:
```bash
curl -s -o /tmp/{TICKER}_sheet.png "https://charts.equityclock.com/seasonal_charts/{TICKER}_sheet.png"
```

**Rating Criteria:**
| Rating | Win Rate | Avg Return |
|--------|----------|------------|
| FAVORABLE | >60% | >5% |
| NEUTRAL | 50-60% | 0-5% |
| UNFAVORABLE | <50% | <0% |

Seasonality is CONTEXT, not a gate. Strong flow can override weak seasonality, but weak flow + weak seasonality = pass.

## X Account Scan

Fetch tweets from X accounts and extract ticker sentiment for watchlist.

```bash
# Scan default account (@aleabitoreddit)
python3 scripts/fetch_x_watchlist.py

# Scan specific account
python3 scripts/fetch_x_watchlist.py --account elonmusk

# Look back 48 hours instead of 24
python3 scripts/fetch_x_watchlist.py --hours 48

# Dry run (don't update watchlist)
python3 scripts/fetch_x_watchlist.py --dry-run
```

**Requires:** `BROWSER_USE_API_KEY` environment variable

**Startup Protocol:**
- Extension checks watchlist for X account subcategories
- If last scan >12 hours ago, notifies agent to run scan
- Agent should run `x-scan` for any flagged accounts

**Output:**
- Extracts tickers mentioned in tweets
- Determines sentiment: BULLISH / BEARISH / NEUTRAL
- Rates confidence: HIGH / MEDIUM / LOW
- Updates watchlist subcategory with new/updated tickers

---

## Seasonal Command

Usage: `seasonal [TICKER]` or `seasonal [TICKER1] [TICKER2] ...`

**Process:**
1. Download chart: `curl -s -o /tmp/{TICKER}_sheet.png "https://charts.equityclock.com/seasonal_charts/{TICKER}_sheet.png"`
2. Read image and extract monthly data table
3. Identify current month and next 2-3 months
4. Assign rating (FAVORABLE / NEUTRAL / UNFAVORABLE)
5. Output summary table with actionable context

**Output includes:**
- Current month: win rate, avg return, max, min
- Next 2-3 months outlook (for hold-through scenarios)
- Best/worst months of year
- Rating with reasoning

## Output Format

- Always show: signal → structure → Kelly math → decision
- State probability estimates explicitly, flag uncertainty
- When a trade doesn't meet criteria, say so immediately with the failing gate
- Never rationalize a bad trade
- Log EXECUTED trades to trade_log.json
- Log NO_TRADE decisions to docs/status.md (Recent Evaluations section)

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/fetch_ticker.py` | Validate ticker via dark pool activity |
| `scripts/fetch_flow.py` | Fetch dark pool + options flow data |
| `scripts/fetch_options.py` | Options chain data (stub) |
| `scripts/scanner.py` | Scan watchlist, rank by signal strength |
| `scripts/discover.py` | Market-wide flow scanner for new candidates |
| `scripts/kelly.py` | Kelly criterion calculator |
| `scripts/ib_sync.py` | Sync live portfolio from Interactive Brokers |
| `scripts/leap_iv_scanner.py` | LEAP IV mispricing scanner (IB connection required) |
| `scripts/leap_scanner_uw.py` | LEAP IV scanner using UW + Yahoo Finance (no IB needed) |
| `scripts/fetch_x_watchlist.py` | Fetch X account tweets and extract ticker sentiment |

## Interactive Brokers Integration

```bash
# Display live portfolio (requires TWS/Gateway running)
python3 scripts/ib_sync.py

# Sync to portfolio.json
python3 scripts/ib_sync.py --sync

# Connect to different ports
python3 scripts/ib_sync.py --port 7496   # TWS Live
python3 scripts/ib_sync.py --port 7497   # TWS Paper (default)
python3 scripts/ib_sync.py --port 4001   # IB Gateway Live
python3 scripts/ib_sync.py --port 4002   # IB Gateway Paper
```

**Setup:**
1. Install: `pip install ib_insync`
2. In TWS: Configure → API → Settings → Enable "ActiveX and Socket Clients"
3. Ensure "Read-Only API" is unchecked if you want order capability later

## LEAP IV Mispricing Scanner

Identifies long-dated options where implied volatility diverges from realized volatility.

```bash
# Scan specific tickers
python3 scripts/leap_iv_scanner.py AAPL MSFT NVDA EWY

# Use presets
python3 scripts/leap_iv_scanner.py --preset sectors    # State Street sector ETFs
python3 scripts/leap_iv_scanner.py --preset mag7       # Magnificent 7
python3 scripts/leap_iv_scanner.py --preset semis      # Semiconductors
python3 scripts/leap_iv_scanner.py --preset emerging   # Emerging market ETFs

# Custom parameters
python3 scripts/leap_iv_scanner.py --min-gap 20 --years 2027 2028

# Scan portfolio holdings for IV opportunities
python3 scripts/leap_iv_scanner.py --portfolio
```

**Available Presets:** `sectors`, `mag7`, `semis`, `financials`, `energy`, `china`, `emerging`

**Output:** HTML report at `reports/leap-iv-scan.html`

See `docs/strategies.md` for full methodology.

## Data Files

| File | Purpose |
|------|---------|
| `data/watchlist.json` | Tickers under surveillance with flow signals |
| `data/portfolio.json` | Open positions, entry prices, Kelly sizes, expiry dates |
| `data/trade_log.json` | Executed trades only (append-only) |
| `data/ticker_cache.json` | Local cache of ticker → company name mappings |

## Documentation

| File | Purpose |
|------|---------|
| `docs/prompt.md` | Spec, constraints, deliverables |
| `docs/plans.md` | Milestone workflow with validation steps |
| `docs/implement.md` | Execution runbook |
| `docs/status.md` | Current state, recent decisions, audit log |
| `docs/strategies.md` | Trading strategies (Dark Pool Flow, LEAP IV Mispricing) |

## Data Source Priority

When fetching live pricing data (quotes, options chains), use sources in this order:

| Priority | Source | Use Case | Notes |
|----------|--------|----------|-------|
| **1** | Interactive Brokers | Real-time quotes, options chains | Requires TWS/Gateway running |
| **2** | Unusual Whales | Flow data, options activity | API key in UW_TOKEN env var |
| **3** | Yahoo Finance | Fallback for quotes/chains | Rate limited, use as last resort |

**Rationale:**
- IB provides the most accurate real-time data with tight spreads
- UW excels at flow/activity data but options chain access requires higher tier
- Yahoo Finance is free but rate-limited and data can be delayed

## Tools Available

- `bash` — Run Python scripts in ./scripts/
- `read`/`write`/`edit` — Manage data and documentation files
- `kelly_calc` — Built-in fractional Kelly calculator
- `agent-browser` — Web browsing and scraping (see web-fetch skill)

## Skills

Skills are loaded on-demand when tasks match their descriptions.

| Skill | Location | Purpose |
|-------|----------|---------|
| `options-analysis` | `.pi/skills/options-analysis/SKILL.md` | Options pricing and structure analysis |
| `web-fetch` | `.pi/skills/web-fetch/SKILL.md` | Fetch and extract content from websites |
| `browser-use-cloud` | `.pi/skills/browser-use-cloud/SKILL.md` | AI browser agent for autonomous web tasks |
| `html-report` | `.pi/skills/html-report/SKILL.md` | Generate styled HTML reports (Terminal theme) |
| `context-engineering` | `.pi/skills/context-engineering/SKILL.md` | Persistent memory, context pipelines, token budget management |

### Web Fetch Quick Reference
```bash
# Open and snapshot a page
agent-browser open "https://example.com"
agent-browser snapshot -i -c

# Extract text from element (use @refs from snapshot)
agent-browser get text @e5

# Screenshot
agent-browser screenshot page.png

# Interactive: fill form and click
agent-browser fill @e3 "value"
agent-browser click @e5
```

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
