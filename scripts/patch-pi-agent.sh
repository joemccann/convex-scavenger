#!/bin/bash
# Temporary patch for pi-coding-agent compaction.js bug
# Bug: TypeError: message.content is not iterable
# Issue: estimateTokens doesn't handle null/undefined content in toolResult messages

set -e

# Find the installed pi-coding-agent
PI_AGENT_PATH=$(npm root -g)/@mariozechner/pi-coding-agent/dist/core/compaction/compaction.js

if [ ! -f "$PI_AGENT_PATH" ]; then
    echo "❌ pi-coding-agent not found at: $PI_AGENT_PATH"
    exit 1
fi

echo "📍 Found pi-coding-agent at: $PI_AGENT_PATH"

# Check if already patched
if grep -q "Array.isArray(message.content)" "$PI_AGENT_PATH"; then
    echo "✅ Already patched!"
    exit 0
fi

# Create backup
cp "$PI_AGENT_PATH" "${PI_AGENT_PATH}.bak"
echo "📦 Backup created: ${PI_AGENT_PATH}.bak"

# Apply patch using sed
# Replace the vulnerable pattern with safe iteration
sed -i.tmp '
/case "custom":/,/return Math\.ceil(chars \/ 4);/ {
    s/else {/else if (message.content \&\& Array.isArray(message.content)) {/
}
' "$PI_AGENT_PATH"

rm -f "${PI_AGENT_PATH}.tmp"

# Verify patch applied
if grep -q "Array.isArray(message.content)" "$PI_AGENT_PATH"; then
    echo "✅ Patch applied successfully!"
    echo ""
    echo "To revert: cp ${PI_AGENT_PATH}.bak $PI_AGENT_PATH"
else
    echo "❌ Patch failed. Restoring backup..."
    cp "${PI_AGENT_PATH}.bak" "$PI_AGENT_PATH"
    exit 1
fi
