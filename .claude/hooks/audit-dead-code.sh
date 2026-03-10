#!/usr/bin/env bash
# Dead code audit hook for Claude Code
# Runs once per session on first user prompt.
# Scans scripts/ for orphaned files not referenced by any active code.
# Writes findings to .claude/hooks/dead-code.manifest for cleanup-dead-code.sh

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SCRIPTS_DIR="$PROJECT_ROOT/scripts"
MANIFEST="$PROJECT_ROOT/.claude/hooks/dead-code.manifest"
LOCK="/tmp/radon-audit-$$-$PPID"

# Only run once per parent process (Claude session)
if [[ -f "$LOCK" ]]; then
  exit 0
fi
touch "$LOCK"
trap "rm -f '$LOCK'" EXIT

# ── Collectors ────────────────────────────────────────────
# Each adds "relative_path<TAB>reason" lines to the dead array.
dead=()

add() {
  local abs="$1"
  local reason="$2"
  local rel="${abs#$PROJECT_ROOT/}"
  dead+=("${rel}	${reason}")
}

# 1. Known dead patterns — ad-hoc test/debug scripts at top level
for f in \
  "$SCRIPTS_DIR/test_browser_use.py" \
  "$SCRIPTS_DIR/test_kelly.py" \
  "$SCRIPTS_DIR/test_kelly_calc.mjs" \
  "$SCRIPTS_DIR/test_kelly_return_type.mjs" \
  "$SCRIPTS_DIR/test_kelly_some_bug.mjs" \
  "$SCRIPTS_DIR/test_daily_change.mjs" \
  "$SCRIPTS_DIR/patch-pi-agent.sh" \
  "$SCRIPTS_DIR/scratch"; do
  [[ -e "$f" ]] && add "$f" "ad-hoc/one-off script"
done

# 2. Build artifacts — .pytest_cache, __pycache__, .pyc
while IFS= read -r -d '' d; do
  add "$d" "pytest cache directory"
done < <(find "$SCRIPTS_DIR" -type d -name ".pytest_cache" -print0 2>/dev/null)

while IFS= read -r -d '' d; do
  add "$d" "__pycache__ directory"
done < <(find "$SCRIPTS_DIR" -type d -name "__pycache__" -print0 2>/dev/null)

while IFS= read -r -d '' f; do
  add "$f" "compiled .pyc file"
done < <(find "$SCRIPTS_DIR" -name "*.pyc" -print0 2>/dev/null)

# 3. Legacy utils superseded by clients/
for f in "$SCRIPTS_DIR/utils/ib_connection.py" "$SCRIPTS_DIR/utils/uw_api.py"; do
  if [[ -f "$f" ]]; then
    basename_f="$(basename "$f" .py)"
    imports=$(grep -rl "from utils.$basename_f\|import $basename_f" "$SCRIPTS_DIR" --include="*.py" 2>/dev/null | grep -v "/tests/" | grep -v "__pycache__" || true)
    [[ -z "$imports" ]] && add "$f" "superseded by clients/"
  fi
done

# 4. Superseded scripts — no active non-test references
for f in "$SCRIPTS_DIR/ib_order.py" "$SCRIPTS_DIR/ib_fill_monitor.py" "$SCRIPTS_DIR/ib_realtime_server.py"; do
  if [[ -f "$f" ]]; then
    basename_f="$(basename "$f" .py)"
    refs=$(grep -rl "$basename_f" "$PROJECT_ROOT/web" "$PROJECT_ROOT/lib" "$SCRIPTS_DIR" \
      --include="*.ts" --include="*.tsx" --include="*.py" --include="*.js" --include="*.mjs" --include="*.json" \
      2>/dev/null | grep -v "/tests/" | grep -v "node_modules" | grep -v "__pycache__" | grep -v "$f" || true)
    [[ -z "$refs" ]] && add "$f" "superseded script, no active references"
  fi
done

# 5. Standalone Node xAI scripts
for f in "$SCRIPTS_DIR/xai-search.mjs" "$SCRIPTS_DIR/xai-x-search.mjs"; do
  if [[ -f "$f" ]]; then
    basename_f="$(basename "$f")"
    refs=$(grep -rl "$basename_f" "$PROJECT_ROOT" \
      --include="*.ts" --include="*.tsx" --include="*.py" --include="*.json" --include="*.md" --include="*.sh" \
      2>/dev/null | grep -v "node_modules" | grep -v "$f" || true)
    [[ -z "$refs" ]] && add "$f" "standalone script, no references"
  fi
done

# 6. Duplicate test files
if [[ -f "$SCRIPTS_DIR/tests/test_order_manage.py" && -f "$SCRIPTS_DIR/tests/test_ib_order_manage.py" ]]; then
  add "$SCRIPTS_DIR/tests/test_order_manage.py" "duplicate of test_ib_order_manage.py"
fi

# ── Write manifest ────────────────────────────────────────
# Format: one line per item — "relative_path<TAB>reason"
if [[ ${#dead[@]} -gt 0 ]]; then
  printf "%s\n" "${dead[@]}" > "$MANIFEST"
else
  > "$MANIFEST"
fi

# ── Output to user ────────────────────────────────────────
if [[ ${#dead[@]} -eq 0 ]]; then
  echo "✅ All code audited. Nothing to do."
else
  echo "⚠️  Dead code detected — ${#dead[@]} item(s) to remove:"
  echo ""
  echo "| # | File | Command |"
  echo "|---|------|---------|"
  i=1
  for entry in "${dead[@]}"; do
    rel="${entry%%	*}"
    if [[ -d "$PROJECT_ROOT/$rel" ]]; then
      echo "| $i | \`$rel/\` | \`rm -rf $rel\` |"
    else
      echo "| $i | \`$rel\` | \`rm $rel\` |"
    fi
    i=$((i + 1))
  done
  echo ""
  echo "Run \`./scripts/cleanup-dead-code.sh\` to remove all, or \`--dry-run\` to preview."
fi
