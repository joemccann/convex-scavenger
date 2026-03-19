#!/bin/bash
# Autoresearch benchmark for scanner.py speed optimization
# Measures scan time for watchlist tickers

set -e
cd "$(dirname "$0")"

echo "=== Scanner Benchmark ===" >&2

# Run scanner and capture timing
START=$(python3 -c "import time; print(int(time.time() * 1000))")
python3 scripts/scanner.py --top 5 > /tmp/scanner_output.json 2>/tmp/scanner_stderr.txt
END=$(python3 -c "import time; print(int(time.time() * 1000))")

TOTAL_MS=$((END - START))

# Extract tickers scanned from output
TICKERS_SCANNED=$(python3 -c "import json; d=json.load(open('/tmp/scanner_output.json')); print(d.get('tickers_scanned', 0))")

# Calculate per-ticker time
if [ "$TICKERS_SCANNED" -gt 0 ]; then
    PER_TICKER_MS=$((TOTAL_MS / TICKERS_SCANNED))
else
    PER_TICKER_MS=0
fi

echo "Total: ${TOTAL_MS}ms" >&2
echo "Tickers: ${TICKERS_SCANNED}" >&2
echo "Per ticker: ${PER_TICKER_MS}ms" >&2

# Output metrics for autoresearch
echo "METRIC total_ms=${TOTAL_MS}"
echo "METRIC per_ticker_ms=${PER_TICKER_MS}"
