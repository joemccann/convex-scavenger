# Autoresearch Ideas — Scan Command Speed Optimization

## Status: 🔄 IN PROGRESS

## Promising Ideas

### 1. Leverage Existing UW Cache
- Scanner uses fetch_flow.py which should already use the 60s TTL cache
- Verify cache is being hit during scans
- May already be benefiting from evaluate.py optimizations

### 2. Reduce Days of Darkpool Data
- Currently fetches 5 days per ticker
- For scanning/ranking, 3 days may be sufficient
- Edge determination still needs 5 days (but that's in evaluate.py)

### 3. Skip Flow Alerts for Scanning
- Scanner only uses darkpool data for ranking
- Flow alerts are fetched but may not be used
- Remove unnecessary API call

### 4. Batch Darkpool Fetching
- UW may support fetching multiple tickers in one call
- Check `/api/darkpool/recent` endpoint

### 5. Reduce Worker Count
- 15 workers may cause more rate limiting
- Try 5-8 workers for more consistent throughput

### 6. Add Scanner-Specific Cache
- Cache scan results for short period (5 min)
- Useful for repeated scans during same session

## From Evaluate Optimization (Already Applied)
- UW request cache (60s TTL) — should help scanner
- M2/M3 flow_alerts params aligned — scanner uses same fetch_flow

## Tried and Failed
(Updated as experiments accumulate)

