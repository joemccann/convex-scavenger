#!/bin/bash
# Checks for scanner optimization - verify output format is correct
set -e
cd "$(dirname "$0")"

# Check that scanner output has required fields
python3 -c "
import json
import sys

with open('/tmp/scanner_output.json') as f:
    data = json.load(f)

required = ['scan_time', 'tickers_scanned', 'signals_found', 'top_signals']
for field in required:
    if field not in data:
        print(f'FAIL: Missing required field: {field}')
        sys.exit(1)

# Check top_signals structure
for sig in data['top_signals']:
    sig_required = ['ticker', 'score', 'signal', 'direction']
    for field in sig_required:
        if field not in sig:
            print(f'FAIL: Signal missing field: {field}')
            sys.exit(1)

print('OK: Scanner output format valid')
"

echo "All checks passed"
