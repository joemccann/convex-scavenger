---
description: On-demand options pricing and structure analysis for the Convex Scavenger trading agent
---

# Options Analysis Skill

## Description
On-demand options pricing and structure analysis for the Convex Scavenger trading agent.

## Capabilities
- Fetch and parse options chains for a given ticker
- Calculate implied volatility rank and percentile
- Evaluate convexity profile of candidate structures (calls, puts, vertical spreads)
- Estimate P(ITM), conditional settlement value, and expected value for each strike
- Compare structures: naked options vs. spreads for optimal convexity

## Usage
Invoke when evaluating a specific ticker's options chain as part of the /evaluate workflow.

## Data Source Priority

When fetching live options pricing, use sources in this order:

| Priority | Source | Command/Method |
|----------|--------|----------------|
| **1** | Interactive Brokers | `python3 scripts/ib_sync.py` (requires TWS/Gateway) |
| **2** | Unusual Whales | `python3 scripts/fetch_flow.py` (flow data only at current tier) |
| **3** | Yahoo Finance | `agent-browser` to scrape options chain (fallback, rate limited) |

**Note:** IB provides the most accurate real-time bid/ask spreads. Yahoo Finance should only be used as a last resort due to rate limiting and potential data delays.

## Dependencies
- scripts/fetch_options.py — data retrieval
- scripts/kelly.py — position sizing
- data/portfolio.json — current exposure context
