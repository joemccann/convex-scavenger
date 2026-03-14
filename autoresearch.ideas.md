# IB Sync Latency — Ideas Backlog

## Status: EXHAUSTED — No actionable ideas remain.

All paths with meaningful impact have been explored and either applied or rejected.
The optimization is at the theoretical floor (~2.9s) bounded by IB's 2.5s data streaming requirement.

## Applied (merged to main)
- Batch PnL Single (−13.6s)
- Overlap all sleeps (−4.5s)
- Skip qualifyContracts (−1.5s)
- accountValues() cache read (−0.3s)
- Phase 6 elimination (−0.3s)
- Sleep 2.7→2.5s (−0.2s)
- Close price fallback (data quality, no timing impact)

## Explored and rejected
- Adaptive polling (0.1s/0.25s): iteration overhead exceeds savings
- Snapshot market data: broken with delayed-frozen (type 4)
- Move account summary after subs: event loop backlog regression
- Import optimization: ib_insync 121ms, unavoidable
- Post-IB processing: <3ms total, negligible
- Skip cancel calls: <2ms total, negligible
- Sleep <2.5s: overfits to degraded gateway, loses live data during market hours

## Not worth pursuing
- Persistent connection pool: saves ~125ms connect, needs daemon architecture change — beyond scope
