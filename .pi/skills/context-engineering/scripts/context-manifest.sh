#!/usr/bin/env bash
# context-manifest.sh — Scan a context repository and generate a token-budget manifest
# Usage: bash context-manifest.sh /path/to/project/context [token_budget]

set -euo pipefail

CONTEXT_DIR="${1:?Usage: context-manifest.sh <context-dir> [token-budget]}"
TOKEN_BUDGET="${2:-128000}"

if [ ! -d "$CONTEXT_DIR" ]; then
  echo "Error: ${CONTEXT_DIR} is not a directory"
  exit 1
fi

echo "=== Context Manifest ==="
echo "Repository: ${CONTEXT_DIR}"
echo "Token Budget: ${TOKEN_BUDGET}"
echo "Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# Estimate tokens from character count (rough: 1 token ≈ 4 chars)
estimate_tokens() {
  local chars
  chars=$(wc -c < "$1" 2>/dev/null || echo 0)
  echo $(( chars / 4 ))
}

total_tokens=0

echo "--- Memory Inventory ---"
for memtype in fact episodic procedural user experiential; do
  dir="${CONTEXT_DIR}/memory/${memtype}"
  if [ -d "$dir" ]; then
    count=$(find "$dir" -type f | wc -l | tr -d ' ')
    tokens=0
    while IFS= read -r -d '' file; do
      t=$(estimate_tokens "$file")
      tokens=$((tokens + t))
    done < <(find "$dir" -type f -print0 2>/dev/null)
    total_tokens=$((total_tokens + tokens))
    printf "  %-15s %4d entries  ~%6d tokens\n" "${memtype}:" "$count" "$tokens"
  fi
done

echo ""
echo "--- History ---"
hist_dir="${CONTEXT_DIR}/history"
if [ -d "$hist_dir" ]; then
  hist_count=$(find "$hist_dir" -name '*.jsonl' ! -name '_transactions.jsonl' | wc -l | tr -d ' ')
  hist_tokens=0
  while IFS= read -r -d '' file; do
    t=$(estimate_tokens "$file")
    hist_tokens=$((hist_tokens + t))
  done < <(find "$hist_dir" -name '*.jsonl' ! -name '_transactions.jsonl' -print0 2>/dev/null)
  total_tokens=$((total_tokens + hist_tokens))
  printf "  Sessions: %d  ~%d tokens\n" "$hist_count" "$hist_tokens"
fi

echo ""
echo "--- Scratchpads ---"
pad_dir="${CONTEXT_DIR}/pad"
if [ -d "$pad_dir" ]; then
  pad_count=$(find "$pad_dir" -type d -mindepth 1 | wc -l | tr -d ' ')
  printf "  Active tasks: %d\n" "$pad_count"
fi

echo ""
echo "--- Human Annotations ---"
human_dir="${CONTEXT_DIR}/human"
if [ -d "$human_dir" ]; then
  human_count=$(find "$human_dir" -type f | wc -l | tr -d ' ')
  printf "  Annotations: %d\n" "$human_count"
fi

echo ""
echo "--- Budget Summary ---"
budget_pct=$(( (total_tokens * 100) / TOKEN_BUDGET ))
printf "  Total stored context: ~%d tokens\n" "$total_tokens"
printf "  Token budget:         %d tokens\n" "$TOKEN_BUDGET"
printf "  Utilization:          %d%%\n" "$budget_pct"

if [ "$total_tokens" -gt "$TOKEN_BUDGET" ]; then
  overage=$((total_tokens - TOKEN_BUDGET))
  echo ""
  echo "  ⚠ WARNING: Stored context exceeds budget by ~${overage} tokens."
  echo "  Constructor MUST apply selection + compression before loading."
fi

echo ""
echo "--- Transaction Log ---"
tx_log="${CONTEXT_DIR}/history/_transactions.jsonl"
if [ -f "$tx_log" ]; then
  tx_count=$(wc -l < "$tx_log" | tr -d ' ')
  printf "  Total transactions: %d\n" "$tx_count"
  echo "  Last 5 operations:"
  tail -5 "$tx_log" 2>/dev/null | while read -r line; do
    op=$(echo "$line" | grep -o '"operation":"[^"]*"' | cut -d'"' -f4)
    path=$(echo "$line" | grep -o '"path":"[^"]*"' | cut -d'"' -f4)
    ts=$(echo "$line" | grep -o '"timestamp":"[^"]*"' | cut -d'"' -f4)
    printf "    %s  %-8s  %s\n" "$ts" "$op" "$path"
  done
else
  echo "  No transaction log found."
fi
