<p align="center">
  <img src="brand/radon-readme-hero.svg" alt="Radon — Reconstructing Market Structure" width="900" />
</p>

# Radon

Market structure reconstruction system. Surfaces convex opportunities from institutional dark pool flow, volatility surfaces, and cross-asset positioning. Detects institutional positioning via dark pool/OTC flow, constructs convex options structures, sizes with fractional Kelly criterion. Includes a real-time Next.js terminal with IB WebSocket streaming, order management, and an AI chat interface.

**No narrative trades. No TA trades. Flow signal or nothing.**

## Three Gates

Every trade must pass three sequential gates:

1. **Convexity** — Potential gain >= 2x potential loss. Defined-risk only (long options, vertical spreads).
2. **Edge** — A specific, data-backed signal that hasn't yet moved price.
3. **Risk Management** — Fractional Kelly sizing with a hard cap of 2.5% of bankroll per position.

If any gate fails, no trade is taken.

## Strategies

Six active strategies, each exploiting a different informational or structural advantage:

| # | Strategy | Edge Source | Timeframe | Risk |
|---|----------|-------------|-----------|------|
| 1 | **Dark Pool Flow** | Institutional positioning via dark pool/OTC | 2-6 weeks | Defined |
| 2 | **LEAP IV Mispricing** | HV >> LEAP IV during regime changes | Weeks-9 months | Defined |
| 3 | **GARCH Convergence** | Cross-asset IV repricing lag | 2-8 weeks | Defined |
| 4 | **Risk Reversal** | IV skew exploitation (sell rich put, buy cheap call) | 2-8 weeks | Undefined |
| 5 | **Volatility-Credit Gap (VCG)** | Vol complex / credit market divergence | 1-5 days | Defined |
| 6 | **Crash Risk Index (CRI)** | CTA deleveraging + sector correlation | 3-5 days | Defined |

Full specs in `docs/strategies.md`. VCG math in `docs/VCG_institutional_research_note.md`.

## Prerequisites

- Python 3.9+
- [Interactive Brokers](https://www.interactivebrokers.com/) TWS or IB Gateway running locally
- [Unusual Whales](https://unusualwhales.com) API key for dark pool / flow data
- Node.js 18+ (for the web terminal)

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/joemccann/radon.git
cd radon
pip install -r requirements.txt
```

### 2. Set environment variables

**Web app** (`web/.env` — copied from `web/.env.example`):

```bash
ANTHROPIC_API_KEY=your-anthropic-key
UW_TOKEN=your-unusual-whales-key
EXA_API_KEY=your-exa-key
```

**Python scripts** (project root `.env`):

```bash
# MenthorQ — institutional CTA positioning data (for CRI scanner)
MENTHORQ_USER=your-menthorq-email
MENTHORQ_PASS=your-menthorq-password
```

Python scripts load the root `.env` via `python-dotenv`. The web app uses Next.js built-in `.env` loading from `web/`.

**Optional shell exports** (`.zshrc` / `.bashrc`):

```bash
export XAI_API_KEY="your-xai-api-key"  # xAI Grok — X/Twitter sentiment
```

**MenthorQ additional dependencies:**

```bash
pip install playwright httpx
playwright install chromium
```

IB Gateway/TWS connects locally on port 4001 (Gateway) or 7497 (TWS). No API key needed — just have it running.

### 3. Verify IB connection

```bash
python scripts/ib_sync.py
```

### 4. Run your first scan

```bash
python scripts/scanner.py --top 15
```

## Radon Terminal (Web)

A Next.js 16 trading terminal with real-time IB WebSocket price streaming and greeks.

```bash
cd web
npm install
npm run dev        # Starts Next.js + IB WebSocket server
```

Visit `http://localhost:3000`. Sections: Dashboard, Flow Analysis, Portfolio, Orders, Scanner, Discover, Journal, Regime, CTA.

**Key features:**
- Real-time price streaming via IB WebSocket with live greeks (delta, gamma, theta, vega)
- Position table with per-leg P&L breakdown for multi-leg spreads
- Exposure breakdown modal with clickable metric cards showing delta calculation details
- Order management: cancel, modify (including BAG/combo spread orders)
- Ticker detail modal with company info, seasonality charts, and analyst ratings
- Crash Risk Index with intraday time-series and MenthorQ CTA overlay
- Dual light/dark theme with Radon design system
- AI chat interface for running commands and analysis

## Project Structure

```
radon/
├── CLAUDE.md                          # Agent identity, trading rules, commands
├── VERSION                            # Semantic version
├── requirements.txt                   # Python deps (ib_insync, requests, pandas, numpy)
├── brand/                             # Radon design system assets
│   ├── radon-brand-system.md          # Full 9-section brand spec
│   ├── radon-design-tokens.json       # Machine-readable design tokens
│   ├── radon-tailwind-theme.ts        # Tailwind theme extension
│   ├── radon-component-kit.html       # Live component reference
│   ├── radon-terminal-mockup.html     # Terminal layout mockup
│   └── radon-*.svg                    # Logo assets
├── scripts/
│   ├── clients/                       # API client libraries
│   │   ├── ib_client.py               # IBClient — wraps ib_insync
│   │   ├── uw_client.py               # UWClient — wraps UW REST API (50+ endpoints)
│   │   └── menthorq_client.py         # MenthorQClient — browser automation + Vision
│   ├── utils/                         # Shared utilities
│   ├── trade_blotter/                 # IB trade blotter subsystem
│   ├── monitor_daemon/                # Background monitoring daemon
│   ├── tests/                         # pytest test suite (735+ tests)
│   ├── evaluate.py                    # Unified 7-milestone evaluation (parallel)
│   ├── scanner.py                     # Watchlist batch dark pool scan
│   ├── discover.py                    # Market-wide options flow scanner
│   ├── cri_scan.py                    # Crash Risk Index scanner
│   ├── vcg_scan.py                    # Volatility-Credit Gap scanner
│   ├── garch_convergence.py           # GARCH convergence vol divergence scanner
│   ├── kelly.py                       # Kelly criterion calculator
│   ├── scenario_analysis.py           # Portfolio stress testing
│   └── ...                            # IB sync, orders, blotter, etc.
├── data/                              # Runtime JSON data (gitignored)
├── docs/                              # Strategy specs, API references
├── config/                            # launchd plists for background services
├── web/                               # Next.js 16 terminal
│   ├── app/                           # App Router pages + API routes
│   ├── components/                    # React 19 components
│   │   ├── kit/                       # Radon component kit (viewable at /kit)
│   │   └── ...                        # WorkspaceShell, PositionTable, MetricCards, etc.
│   ├── lib/                           # Hooks, utilities, types, Zustand store
│   └── tests/                         # Vitest + Playwright tests
└── .pi/                               # Agent slash commands + skills
```

## Commands

| Command | Action |
|---------|--------|
| `scan` | Watchlist dark pool flow scan |
| `discover` | Market-wide options flow for new candidates |
| `evaluate [TICKER]` | Full 7-milestone three-gate evaluation |
| `portfolio` | Positions, exposure, capacity |
| `journal` | Recent trade log |
| `strategies` | Display strategy registry |
| `scenario [TYPE] [PCT]` | Portfolio stress test (price shock or delta decay) |
| `vcg-scan` | Volatility-Credit Gap divergence scan |
| `cri-scan` | Crash Risk Index scan |
| `garch-convergence [PRESET]` | Cross-asset GARCH vol divergence scan |
| `sync` | Pull live portfolio from IB |
| `blotter` | Today's fills + P&L |
| `leap-scan [TICKERS]` | LEAP IV mispricing opportunities |
| `seasonal [TICKERS]` | Monthly seasonality assessment |
| `analyst-ratings [TICKERS]` | Ratings, changes, price targets |

## Data Source Priority

| Priority | Source | Notes |
|----------|--------|-------|
| **1** | Interactive Brokers (TWS/Gateway) | Real-time quotes, options chains, fundamentals |
| **2** | Unusual Whales (`$UW_TOKEN`) | Dark pool flow, sweeps, flow alerts, analyst ratings |
| **3** | Exa (`$EXA_API_KEY`) | Web search, company research |
| **4** | Yahoo Finance | **Last resort** — delayed, rate-limited |

## Testing

```bash
# Python tests (735+ tests)
python -m pytest scripts/tests/ -v

# TypeScript tests (Vitest)
cd web && npx vitest run

# E2E tests (Playwright)
cd web && npx playwright test
```

All unit tests use mocked API calls — no live IB or UW connections required.

## Background Services

| Service | Schedule | Purpose |
|---------|----------|---------|
| IB Gateway (IBC) | Mon-Fri 00:00 | Auto-start Gateway, 2FA, daily restart |
| CRI Scan | Every 30 min, 4:05 AM–8 PM ET | Crash Risk Index intraday time-series |
| Monitor Daemon | Pluggable | Fill monitoring, exit order placement |
| Data Refresh | Configurable | Portfolio + orders staleness refresh |

Setup: `./scripts/setup_ibc.sh install`, `./scripts/setup_cri_service.sh install`, etc.

## Glossary

| Term | Definition |
|------|------------|
| **Convexity** | Asymmetric payoff where gain >> loss (we require >= 2:1) |
| **CRI** | Crash Risk Index — composite crash risk score (VIX, VVIX, correlation, momentum) |
| **CTA** | Commodity Trading Advisor — systematic funds that deleverage on vol spikes |
| **DP** | Dark Pool — private exchanges for institutional orders |
| **Edge** | Data-backed reason the market is mispricing an outcome |
| **GEX** | Gamma Exposure — aggregate market maker gamma positioning |
| **Kelly Criterion** | Optimal bet sizing: `f* = p - (q/b)` where p = win prob, q = 1-p, b = odds |
| **VCG** | Volatility-Credit Gap — divergence between vol complex and credit markets |
