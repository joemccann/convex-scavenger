# Autoresearch: Scan Command Speed Optimization

## Summary
**🔄 IN PROGRESS**

| Metric | Baseline | Best | Improvement |
|--------|----------|------|-------------|
| 19 tickers | ~40,000ms | — | — |

**Status**: Starting optimization.

**Target**: 50% improvement (40s → 20s)

---

## Objective
Improve the execution speed of `scripts/scanner.py` by ≥50%. The scanner fetches dark pool flow data for all watchlist tickers and ranks them by signal strength.

**Current performance**: ~40s for 19 tickers (highly variable due to UW rate limiting)

## Metrics
- **Primary**: `total_ms` (milliseconds, lower is better) — end-to-end scan time
- **Secondary**: `per_ticker_ms` — average time per ticker

## How to Run
`./autoresearch.sh` — outputs `METRIC total_ms=number` and `METRIC per_ticker_ms=number` lines.

## Files in Scope
| File | Purpose |
|------|---------|
| `scripts/scanner.py` | Main scanner (218 lines) |
| `scripts/fetch_flow.py` | Dark pool flow fetching |
| `scripts/clients/uw_client.py` | UW API client |
| `scripts/utils/uw_cache.py` | UW request caching |

## Off Limits
- `data/*.json` — Data files
- `web/` — Frontend
- `.pi/` — Agent configuration
- `docs/` — Documentation

## Constraints
1. **No feature breakage** — Scanner output format must remain identical
2. **50% minimum improvement** — Target: 40s → 20s
3. **Maintain accuracy** — Signal analysis must be identical

## Architecture Notes

### Current Flow
```
scanner.py
  └── ThreadPoolExecutor(15 workers)
      └── For each ticker:
          └── fetch_flow(ticker, days=5)
              ├── 5x darkpool calls (1 per day)
              └── 1x flow_alerts call
              = ~6 UW API calls per ticker
```

### Bottlenecks Identified
1. **High API call count** — 6 calls per ticker × 19 tickers = ~114 API calls
2. **UW rate limiting** — Same issue as evaluate.py
3. **No cross-ticker caching** — Same dates fetched for each ticker separately

### Key Insight from Evaluate Optimization
The evaluate.py optimization achieved 58% improvement via:
1. Request caching (60s TTL) 
2. Reduced API calls (stock_info vs darkpool)
3. Cache alignment between milestones

Scanner can benefit from the same UW cache since it uses fetch_flow.py.

## What's Been Tried
(Updated as experiments accumulate)

