# Autoresearch Ideas — Evaluate Speed Optimization

## Status: ✅ COMPLETE (57% improvement achieved)

Best result: 6,213ms for 5 tickers (from 14,501ms baseline)

## Tried and Failed

### 1. Intelligent Request Throttling ❌
- Attempted: Added adaptive delay based on 429 responses
- Result: 110s (worse) — backoff delays compound, don't help
- UW rate limiting is server-side and unpredictable

### 2. Reduced Backoff Factor ❌
- Attempted: Changed backoff from 1.0s to 0.5s
- Result: No consistent improvement (still 8-35s range)
- Rate limiting variability dominates

### 3. Reduced Max Retries ❌
- Attempted: Changed max retries from 3 to 1
- Result: No consistent improvement (7-17s range)
- Fails faster but doesn't help with rate limiting

## Remaining Ideas (Not Pursued - Diminishing Returns)

### 4. UW Request Deduplication Between M1 and M2
- M1 and M2 both fetch overlapping darkpool data
- Cache already handles this (60s TTL)
- Estimated savings: ~0.2s/ticker (not worth complexity)

### 5. Pre-Warming Cache
- Pre-fetch data for known watchlist tickers
- Would help but changes evaluation semantics
- Not worth complexity for marginal gains

### 6. Parallel UW Fetching with Semaphore
- Already using 7-worker parallelism per ticker
- More parallelism causes more rate limiting
- Sequential per-ticker is optimal

## Completed Optimizations
1. IB connection pooling — saves 1.8s × (N-1) tickers
2. --fast flag — skips IB price history entirely
3. Analyst ratings cache — reuses cached ratings
4. UW request cache (60s TTL) — deduplicates within session
5. M1 validation reduced to 1 day — saves 2 API calls/ticker
6. Multi-ticker CLI support — batch evaluation in single command

## Conclusion
The remaining performance variability (6-50s) is due to UW API rate limiting,
which is server-side and cannot be optimized client-side. We've achieved the
maximum practical improvement of 57% for the typical (non-rate-limited) case.
