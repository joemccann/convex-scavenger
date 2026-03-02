# Context Engineering Pipeline — Implementation Patterns

Step-by-step patterns for implementing the Constructor → Updater → Evaluator pipeline.

## Table of Contents

1. [Context Constructor](#context-constructor)
2. [Context Updater](#context-updater)
3. [Context Evaluator](#context-evaluator)
4. [TypeScript Reference Implementation](#typescript-reference-implementation)
5. [Python Reference Implementation](#python-reference-implementation)
6. [Integration Checklist](#integration-checklist)

---

## Context Constructor

The Constructor runs **before every LLM call**. It answers: "What context should this model see right now?"

### Algorithm

```
1. Identify task type and required context categories
2. Query memory index for relevant entries (semantic search + recency + scope)
3. Score and rank candidates by relevance, recency, confidence
4. Apply token budget: greedily select top-scored items until budget exhausted
5. Compress oversized items (summarize, truncate with ellipsis, embed key sections)
6. Assemble into prompt schema (system → memory → task → history → tools)
7. Generate manifest recording all selection decisions
8. Log the construction event to transaction log
```

### Selection Heuristics

- **Recency bias**: Items from the last 3 sessions score 2x
- **Task relevance**: Semantic similarity to current task description > 0.6 threshold
- **Confidence filter**: Exclude items with confidence < 0.5
- **Deduplication**: If two facts overlap > 0.95 similarity, keep the more recent one
- **Access control**: Only include items within agent's access scope

### Prompt Assembly Order

```
[system_prompt]           # Fixed instructions, persona
[memory_facts]            # Key facts from long-term memory
[episodic_summaries]      # Relevant session summaries
[user_profile]            # User preferences and context
[tool_definitions]        # Available tool schemas
[task_context]            # Current task documents/data
[recent_conversation]     # Last N turns of dialogue
[user_message]            # Current user input
```

---

## Context Updater

Manages the token window during multi-turn and long-running sessions.

### Three Modes

**Static Snapshot** (single-turn tasks):
- Constructor builds context once, model processes it, done.

**Incremental Streaming** (multi-turn dialogue):
- After each turn, check if any context items have become stale
- Replace stale items with fresh reads from the repository
- Append new conversation turns, trim oldest if budget exceeded

**Adaptive Refresh** (dynamic/interactive sessions):
- Monitor model feedback signals (e.g., "I don't have enough context about X")
- On signal, query repository for X and inject into next turn
- On human intervention, immediately refresh affected context

### Staleness Detection

```
for each item in active_context:
  if item.updatedAt < (now - staleness_threshold):
    mark_for_refresh(item)
  if item.source has been updated in repository:
    mark_for_refresh(item)
  if item.relevance_to_current_task < 0.3:
    mark_for_eviction(item)
```

### Window Management

```
on_new_turn(user_message):
  1. Append user_message to conversation history
  2. Estimate total tokens (system + memory + history + new_message)
  3. If over budget:
     a. Summarize oldest conversation turns into episodic memory
     b. Write summary to /context/memory/episodic/
     c. Replace detailed turns with summary reference
  4. Check staleness of memory items → refresh if needed
  5. Send updated context to model
  6. Append model response to conversation history
  7. Log all changes to transaction log
```

---

## Context Evaluator

Runs **after every model response**. Validates, extracts, and persists.

### Validation Steps

```
1. Compare output claims against source context in manifest
2. Check for contradictions with known facts in memory
3. Score confidence based on:
   - Source coverage: % of claims traceable to context
   - Consistency: no contradictions with existing facts
   - Hallucination indicators: claims with no source
4. If confidence < threshold → flag for human review
5. If confidence >= threshold → extract and persist new facts
```

### Fact Extraction

After validation, extract structured facts from model output:

```
Input:  "The user prefers dark mode and uses VS Code on macOS"
Output: [
  { key: "user.preference.theme", value: "dark", confidence: 0.9 },
  { key: "user.tools.editor", value: "vscode", confidence: 0.9 },
  { key: "user.system.os", value: "macos", confidence: 0.9 }
]
```

### Human Review Queue

When confidence is low or contradictions are detected:

```json
{
  "reviewId": "rev-001",
  "modelOutput": "...",
  "flaggedClaims": [
    { "claim": "User switched to Linux", "reason": "contradicts fact user.system.os=macos", "confidence": 0.4 }
  ],
  "sourceManifest": "mfst-xyz",
  "status": "pending",
  "assignedTo": null,
  "createdAt": "2025-12-05T15:00:00Z"
}
```

Human annotations are persisted to `/context/human/` as first-class context.

---

## TypeScript Reference Implementation

### Context Repository Class

```typescript
import { readFile, writeFile, readdir, mkdir } from 'fs/promises';
import { join } from 'path';

interface ContextMetadata {
  id: string;
  path: string;
  type: string;
  createdAt: string;
  updatedAt: string;
  sourceId: string;
  agentId: string;
  confidence: number;
  revisionId: number;
  accessScope: string[];
  ttl: string | null;
  tags: string[];
}

interface ContextEntry<T = unknown> {
  metadata: ContextMetadata;
  content: T;
}

class ContextRepository {
  constructor(private basePath: string) {}

  async init(): Promise<void> {
    const dirs = [
      'history', 'memory/fact', 'memory/episodic', 'memory/procedural',
      'memory/user', 'memory/experiential', 'pad', 'human', 'tools',
    ];
    for (const dir of dirs) {
      await mkdir(join(this.basePath, dir), { recursive: true });
    }
  }

  async read(path: string): Promise<ContextEntry | null> {
    try {
      const fullPath = join(this.basePath, path);
      const raw = await readFile(fullPath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async write(path: string, entry: ContextEntry): Promise<void> {
    const fullPath = join(this.basePath, path);
    entry.metadata.updatedAt = new Date().toISOString();
    await writeFile(fullPath, JSON.stringify(entry, null, 2));
    await this.logTransaction('write', path, entry.metadata.agentId);
  }

  async list(path: string): Promise<string[]> {
    const fullPath = join(this.basePath, path);
    return readdir(fullPath);
  }

  async appendHistory(sessionId: string, entry: object): Promise<void> {
    const histPath = join(this.basePath, 'history', `${sessionId}.jsonl`);
    const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '\n';
    await writeFile(histPath, line, { flag: 'a' });
  }

  private async logTransaction(op: string, path: string, agentId: string): Promise<void> {
    const logPath = join(this.basePath, 'history', '_transactions.jsonl');
    const entry = { txId: crypto.randomUUID(), operation: op, path, agentId, timestamp: new Date().toISOString() };
    await writeFile(logPath, JSON.stringify(entry) + '\n', { flag: 'a' });
  }
}
```

### Context Constructor

```typescript
interface ManifestEntry {
  path: string;
  items: number;
  tokens: number;
  reason: string;
}

interface ContextManifest {
  manifestId: string;
  taskId: string;
  agentId: string;
  timestamp: string;
  tokenBudget: number;
  tokenUsed: number;
  included: ManifestEntry[];
  excluded: ManifestEntry[];
}

class ContextConstructor {
  constructor(
    private repo: ContextRepository,
    private tokenCounter: (text: string) => number,
  ) {}

  async build(opts: {
    taskId: string;
    taskDescription: string;
    agentId: string;
    tokenBudget: number;
    sources: string[];
  }): Promise<{ context: string; manifest: ContextManifest }> {
    const manifest: ContextManifest = {
      manifestId: crypto.randomUUID(),
      taskId: opts.taskId,
      agentId: opts.agentId,
      timestamp: new Date().toISOString(),
      tokenBudget: opts.tokenBudget,
      tokenUsed: 0,
      included: [],
      excluded: [],
    };

    let assembledContext = '';
    let tokensRemaining = opts.tokenBudget;

    for (const source of opts.sources) {
      const entries = await this.repo.list(source);
      for (const entry of entries) {
        const item = await this.repo.read(join(source, entry));
        if (!item) continue;
        if (!item.metadata.accessScope.includes(opts.agentId)) continue;

        const content = JSON.stringify(item.content);
        const tokens = this.tokenCounter(content);

        if (tokens <= tokensRemaining) {
          assembledContext += `\n<!-- ${item.metadata.path} -->\n${content}\n`;
          tokensRemaining -= tokens;
          manifest.included.push({ path: item.metadata.path, items: 1, tokens, reason: 'within budget and scope' });
        } else {
          manifest.excluded.push({ path: item.metadata.path, items: 1, tokens, reason: 'exceeded token budget' });
        }
      }
    }

    manifest.tokenUsed = opts.tokenBudget - tokensRemaining;
    return { context: assembledContext, manifest };
  }
}
```

---

## Python Reference Implementation

```python
import json
import uuid
import os
from datetime import datetime
from pathlib import Path

class ContextRepository:
    def __init__(self, base_path: str):
        self.base = Path(base_path)

    def init(self):
        dirs = [
            "history", "memory/fact", "memory/episodic", "memory/procedural",
            "memory/user", "memory/experiential", "pad", "human", "tools",
        ]
        for d in dirs:
            (self.base / d).mkdir(parents=True, exist_ok=True)

    def read(self, path: str) -> dict | None:
        try:
            return json.loads((self.base / path).read_text())
        except (FileNotFoundError, json.JSONDecodeError):
            return None

    def write(self, path: str, entry: dict):
        entry["metadata"]["updatedAt"] = datetime.utcnow().isoformat() + "Z"
        (self.base / path).write_text(json.dumps(entry, indent=2))
        self._log_tx("write", path, entry["metadata"].get("agentId", "unknown"))

    def list_entries(self, path: str) -> list[str]:
        return [f.name for f in (self.base / path).iterdir() if f.is_file()]

    def append_history(self, session_id: str, entry: dict):
        hist_path = self.base / "history" / f"{session_id}.jsonl"
        entry["timestamp"] = datetime.utcnow().isoformat() + "Z"
        with open(hist_path, "a") as f:
            f.write(json.dumps(entry) + "\n")

    def _log_tx(self, op: str, path: str, agent_id: str):
        log_path = self.base / "history" / "_transactions.jsonl"
        tx = {"txId": str(uuid.uuid4()), "operation": op, "path": path,
              "agentId": agent_id, "timestamp": datetime.utcnow().isoformat() + "Z"}
        with open(log_path, "a") as f:
            f.write(json.dumps(tx) + "\n")


class ContextConstructor:
    def __init__(self, repo: ContextRepository, count_tokens):
        self.repo = repo
        self.count_tokens = count_tokens

    def build(self, task_id: str, agent_id: str, token_budget: int,
              sources: list[str]) -> tuple[str, dict]:
        manifest = {
            "manifestId": str(uuid.uuid4()),
            "taskId": task_id, "agentId": agent_id,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "tokenBudget": token_budget, "tokenUsed": 0,
            "included": [], "excluded": [],
        }
        context_parts = []
        remaining = token_budget

        for source in sources:
            for entry_name in self.repo.list_entries(source):
                item = self.repo.read(f"{source}/{entry_name}")
                if not item:
                    continue
                content = json.dumps(item.get("content", ""))
                tokens = self.count_tokens(content)
                if tokens <= remaining:
                    context_parts.append(content)
                    remaining -= tokens
                    manifest["included"].append(
                        {"path": f"{source}/{entry_name}", "items": 1,
                         "tokens": tokens, "reason": "within budget"})
                else:
                    manifest["excluded"].append(
                        {"path": f"{source}/{entry_name}", "items": 1,
                         "tokens": tokens, "reason": "exceeded budget"})

        manifest["tokenUsed"] = token_budget - remaining
        return "\n".join(context_parts), manifest
```

---

## Integration Checklist

Use this when adding context engineering to a project:

- [ ] Initialize context repository directory structure
- [ ] Define memory types needed (fact, episodic, user, procedural)
- [ ] Implement Context Constructor with token budget
- [ ] Implement Context Updater for multi-turn sessions
- [ ] Implement Context Evaluator with confidence scoring
- [ ] Add transaction logging to all context operations
- [ ] Define retention/pruning policies per memory type
- [ ] Set up access scopes if multi-agent
- [ ] Add human review queue for low-confidence outputs
- [ ] Implement deduplication for fact memory
- [ ] Create manifest schema and log manifests
- [ ] Add staleness detection for long-running sessions
- [ ] Set up compression strategies (summarization, aging)
- [ ] Test context rot scenarios (outdated facts, conflicting info)
- [ ] Version context schemas for evolvability
