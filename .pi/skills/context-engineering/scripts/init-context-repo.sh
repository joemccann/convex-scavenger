#!/usr/bin/env bash
# init-context-repo.sh — Bootstrap a context engineering repository
# Usage: bash init-context-repo.sh /path/to/project

set -euo pipefail

PROJECT_ROOT="${1:-.}"
CONTEXT_DIR="${PROJECT_ROOT}/context"

echo "Initializing context repository at ${CONTEXT_DIR}..."

# Create directory structure
dirs=(
  "history"
  "memory/fact"
  "memory/episodic"
  "memory/procedural"
  "memory/user"
  "memory/experiential"
  "pad"
  "human"
  "tools"
  "knowledge"
)

for dir in "${dirs[@]}"; do
  mkdir -p "${CONTEXT_DIR}/${dir}"
  echo "  ✓ ${dir}/"
done

# Create metadata.json with default governance policies
cat > "${CONTEXT_DIR}/metadata.json" << 'EOF'
{
  "version": "1.0.0",
  "created": "TIMESTAMP",
  "governance": {
    "history": {
      "retention": "permanent",
      "compression": { "after": "30d", "method": "summarize", "keepOriginal": true }
    },
    "episodic": {
      "retention": "1y",
      "pruneWhen": "count > 1000",
      "pruneStrategy": "merge_similar"
    },
    "scratchpad": {
      "retention": "session",
      "archiveTo": "history",
      "autoDelete": "7d"
    },
    "fact": {
      "retention": "permanent",
      "deduplication": "semantic_similarity > 0.95",
      "conflictResolution": "most_recent_wins"
    },
    "human": {
      "retention": "permanent",
      "priority": "overrides_model_output"
    }
  },
  "accessControl": {
    "defaultScope": "all_agents",
    "agentScopes": {}
  },
  "tokenBudget": {
    "systemPrompt": 0.08,
    "memoryFacts": 0.20,
    "episodicSummaries": 0.10,
    "taskContext": 0.30,
    "conversationHistory": 0.12,
    "toolDefinitions": 0.05,
    "outputReserve": 0.25
  }
}
EOF

# Replace TIMESTAMP with actual timestamp
if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' "s/TIMESTAMP/$(date -u +%Y-%m-%dT%H:%M:%SZ)/" "${CONTEXT_DIR}/metadata.json"
else
  sed -i "s/TIMESTAMP/$(date -u +%Y-%m-%dT%H:%M:%SZ)/" "${CONTEXT_DIR}/metadata.json"
fi

# Create empty transaction log
touch "${CONTEXT_DIR}/history/_transactions.jsonl"
echo "  ✓ history/_transactions.jsonl"

# Create .gitignore for ephemeral data
cat > "${CONTEXT_DIR}/.gitignore" << 'EOF'
# Scratchpads are ephemeral
pad/

# Transaction logs can get large
history/_transactions.jsonl

# SQLite databases (if used as backend)
*.sqlite3
*.sqlite3-journal
EOF
echo "  ✓ .gitignore"

echo ""
echo "Context repository initialized successfully."
echo ""
echo "Directory structure:"
echo "  ${CONTEXT_DIR}/"
echo "  ├── history/          # Immutable raw logs"
echo "  ├── memory/"
echo "  │   ├── fact/         # Atomic key-value facts"
echo "  │   ├── episodic/     # Session summaries"
echo "  │   ├── procedural/   # Tool/function definitions"
echo "  │   ├── user/         # User profiles & preferences"
echo "  │   └── experiential/ # Action-observation trajectories"
echo "  ├── pad/              # Ephemeral scratchpads"
echo "  ├── human/            # Human annotations & overrides"
echo "  ├── tools/            # Mounted external services"
echo "  ├── knowledge/        # RAG sources & documents"
echo "  └── metadata.json     # Governance & budget config"
echo ""
echo "Next steps:"
echo "  1. Review metadata.json and adjust token budget allocations"
echo "  2. Implement Constructor, Updater, Evaluator (see references/pipeline.md)"
echo "  3. Mount your data sources into the appropriate directories"
