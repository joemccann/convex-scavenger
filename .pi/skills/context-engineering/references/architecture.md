# Context Engineering Architecture Reference

Based on "Everything is Context" (Xu et al., arXiv:2512.05470).

## Table of Contents

1. [File System Abstraction](#file-system-abstraction)
2. [Memory Taxonomy](#memory-taxonomy)
3. [Data Model](#data-model)
4. [Governance Model](#governance-model)
5. [Multi-Agent Isolation](#multi-agent-isolation)
6. [Token Budget Strategy](#token-budget-strategy)

---

## File System Abstraction

The core idea: treat every context source (memory, tools, knowledge, human input) as a file mounted into a uniform namespace. Agents interact with context using standard file operations (list, read, write, search) without knowing the backend.

### Mount Points

```
/context/
  history/         → Append-only event log (SQLite, JSONL, or Postgres)
  memory/
    fact/          → Key-value store (Redis, SQLite, JSON files)
    episodic/      → Session summaries (embeddings + text)
    procedural/    → Tool/function schemas (JSON/YAML definitions)
    user/          → User profiles and preferences
    experiential/  → Action-observation trajectories
  pad/             → Ephemeral scratchpads per task
  human/           → Human annotations, corrections, overrides
  tools/           → Mounted external services (APIs, CLIs, MCP servers)
  knowledge/       → RAG sources, documents, knowledge graphs
```

### Operations

Every mount point supports these base operations:

| Operation | Description |
|-----------|-------------|
| `list(path, depth?)` | List entries at path, optional depth |
| `read(path)` | Read content + metadata |
| `write(path, content, metadata)` | Write content with lineage |
| `search(path, query)` | Semantic or keyword search |
| `exec(path, args)` | Execute a tool/action node |

### Metadata Schema

Every context artifact carries:

```json
{
  "id": "uuid",
  "path": "/context/memory/fact/user-preference-theme",
  "type": "fact|episodic|procedural|user|experiential|human|tool",
  "createdAt": "2025-12-05T10:30:00Z",
  "updatedAt": "2025-12-05T14:22:00Z",
  "sourceId": "session-abc-turn-7",
  "agentId": "agent-research-01",
  "confidence": 0.92,
  "revisionId": 3,
  "accessScope": ["agent-research-01", "agent-writer-02"],
  "ttl": null,
  "tags": ["preference", "ui"]
}
```

---

## Memory Taxonomy

| Type | Temporal Scope | Structural Unit | Representation | Example Path |
|------|---------------|-----------------|----------------|--------------|
| Scratchpad | Temporary, task-bounded | Dialogue turns, temp states | Plain text or embeddings | `/context/pad/task-42/` |
| Episodic | Medium-term, session-bounded | Session summaries | Summaries + embeddings | `/context/memory/episodic/` |
| Fact | Long-term, fine-grained | Atomic statements | Key-value pairs or triples | `/context/memory/fact/` |
| Experiential | Long-term, cross-task | Observation-action trajectories | Structured logs | `/context/memory/experiential/` |
| Procedural | Long-term, system-wide | Tool/function definitions | API/code references | `/context/memory/procedural/` |
| User | Long-term, personalized | Attributes, preferences | Profiles, embeddings | `/context/memory/user/` |
| History | Immutable, full-trace | Raw logs of all interactions | Plain text + metadata | `/context/history/` |

### Lifecycle Transitions

```
User Input → History (append, immutable)
                ↓
History → Episodic Memory (summarize session)
History → Fact Memory (extract atomic facts)
History → User Memory (update profile)
                ↓
Scratchpad → Memory (validated results promoted)
Scratchpad → History (archived after task completion)
                ↓
Memory → Context Window (selected by Constructor)
                ↓
Model Output → Evaluator → Memory (verified facts written back)
                         → Human Queue (low confidence)
```

---

## Data Model

### History Entry

```json
{
  "id": "hist-001",
  "sessionId": "session-abc",
  "turnNumber": 7,
  "role": "user|assistant|system|tool",
  "content": "...",
  "timestamp": "2025-12-05T10:30:00Z",
  "modelId": "claude-sonnet-4-5",
  "modelParams": { "temperature": 0.7 },
  "tokenCount": 342,
  "toolCalls": [],
  "parentId": "hist-000"
}
```

### Fact Entry

```json
{
  "id": "fact-user-likes-dark-mode",
  "key": "user.preference.theme",
  "value": "dark",
  "confidence": 0.95,
  "source": "hist-001",
  "extractedBy": "context-evaluator",
  "createdAt": "2025-12-05T10:31:00Z",
  "expiresAt": null,
  "revisionId": 1
}
```

### Context Manifest (produced by Constructor)

```json
{
  "manifestId": "mfst-xyz",
  "taskId": "task-42",
  "agentId": "agent-research-01",
  "timestamp": "2025-12-05T14:00:00Z",
  "tokenBudget": 90000,
  "tokenUsed": 78432,
  "included": [
    { "path": "/context/memory/fact/user-*", "items": 12, "tokens": 1200, "reason": "task-relevant facts" },
    { "path": "/context/memory/episodic/session-abc", "items": 1, "tokens": 800, "reason": "recent session summary" }
  ],
  "excluded": [
    { "path": "/context/memory/experiential/", "reason": "not relevant to current task", "tokens_saved": 4200 }
  ],
  "compressionApplied": [
    { "path": "/context/history/session-abc.jsonl", "original_tokens": 12000, "compressed_tokens": 800, "method": "summarization" }
  ]
}
```

---

## Governance Model

### Retention Policies

```json
{
  "history": {
    "retention": "permanent",
    "compression": { "after": "30d", "method": "summarize", "keep_original": true }
  },
  "episodic": {
    "retention": "1y",
    "pruneWhen": "memory_count > 1000",
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
  }
}
```

### Transaction Log

Every context operation produces a log entry:

```json
{
  "txId": "tx-12345",
  "operation": "read|write|delete|search|select|compress|promote",
  "path": "/context/memory/fact/user-preference-theme",
  "agentId": "agent-research-01",
  "sessionId": "session-abc",
  "timestamp": "2025-12-05T14:22:00Z",
  "details": { "tokensRead": 45 },
  "result": "success"
}
```

---

## Multi-Agent Isolation

When multiple agents share a context repository:

- Each agent has an `agentId` and `accessScope` list
- The Constructor only retrieves artifacts matching the agent's scope
- Writes are tagged with the writing agent's ID
- Cross-agent sharing requires explicit scope grants
- The Updater enforces isolation: one agent's token window never leaks into another's

```
Agent A scope: ["/context/memory/fact/", "/context/memory/user/"]
Agent B scope: ["/context/memory/procedural/", "/context/tools/"]
Shared scope:  ["/context/history/", "/context/human/"]
```

---

## Token Budget Strategy

### Budget Allocation (recommended defaults)

| Component | % of Context Window | Purpose |
|-----------|-------------------|---------|
| System prompt | 5-10% | Instructions, persona, constraints |
| Memory (facts + episodic) | 15-25% | Persistent knowledge |
| Current task context | 30-40% | Documents, code, data for this task |
| Conversation history | 10-20% | Recent turns for continuity |
| Tool definitions | 5-10% | Available tool schemas |
| Output reserve | 20-30% | Space for model response |

### Compression Strategies

1. **Summarization** — Condense long histories into key points
2. **Embedding + retrieval** — Store as vectors, retrieve only relevant chunks
3. **Hierarchical selection** — Load summaries first, drill into details on demand
4. **Aging** — Recent items get full fidelity, older items get progressively compressed
5. **Deduplication** — Merge semantically similar entries before loading
