---
name: context-engineering
description: Implement file-system-based context engineering for agentic AI projects. Use when building persistent memory systems, context pipelines, token-budget management, context repositories, or agentic file system abstractions. Triggers on "context engineering", "context pipeline", "context management", "persistent memory", "token budget", "context constructor", "context evaluator", "agentic file system", "context rot", "memory lifecycle", or any task involving structured management of LLM context windows, history/memory/scratchpad tiers, or governance of context artifacts across agent sessions. Also use when asked to add memory, traceability, or context governance to an existing agentic project.
---

# Context Engineering Skill

Implements the "Everything is Context" architecture from Xu et al. (arXiv:2512.05470) — a file-system abstraction for managing LLM context as persistent, governed, traceable artifacts.

## When to Use

- Setting up a new agentic project that needs persistent context across sessions
- Adding memory/history/scratchpad tiers to an existing agent
- Building a Context Constructor → Updater → Evaluator pipeline
- Implementing token-budget discipline (selection, compression, streaming)
- Adding traceability/audit logging to context operations
- Designing multi-agent context isolation and access control
- Combating context rot or knowledge drift in long-running agents

## Core Architecture

The architecture has two layers:

### Layer 1: Persistent Context Repository (the "file system")

Three tiers, each with distinct lifecycle:

```
/context/
├── history/          # Immutable raw logs — never deleted, append-only
│   ├── session-{id}.jsonl
│   └── metadata.json
├── memory/           # Structured, indexed, mutable views
│   ├── fact/         # Atomic key-value facts (long-term)
│   ├── episodic/     # Session summaries (medium-term)
│   ├── procedural/   # Tool/function definitions (system-wide)
│   ├── user/         # User preferences & profiles (personalized)
│   └── experiential/ # Observation-action trajectories (cross-task)
├── pad/              # Scratchpads — ephemeral, task-scoped
│   └── task-{id}/
└── human/            # Human annotations, corrections, overrides
```

### Layer 2: Context Engineering Pipeline

Three components that bridge persistent storage → bounded token window:

1. **Context Constructor** — Selects, prioritizes, compresses context from the repository. Produces a manifest recording what was included/excluded and why.
2. **Context Updater** — Streams/refreshes context into the token window during extended reasoning. Handles static snapshots, incremental streaming, and adaptive refresh.
3. **Context Evaluator** — Validates outputs against source context, detects hallucinations/drift, writes verified outputs back to memory, triggers human review when confidence is low.

## Implementation Guide

Read the reference docs for detailed implementation patterns:

- `references/architecture.md` — Full architecture specification, design constraints, and data model
- `references/pipeline.md` — Step-by-step pipeline implementation with code patterns
- `scripts/init-context-repo.sh` — Bootstrap a context repository directory structure
- `scripts/context-manifest.sh` — Generate a context manifest for a given task

All paths are relative to this skill directory: `.pi/skills/context-engineering/`

## Quick Start

### 1. Initialize the context repository

```bash
# From project root
bash .pi/skills/context-engineering/scripts/init-context-repo.sh .
```

This creates the `/context/` directory tree with proper structure and metadata files.

### 2. Implement the three pipeline stages

For each stage, follow the patterns in `{baseDir}/references/pipeline.md`:

**Constructor:** Before every LLM call, run selection + compression. Record a manifest.

```typescript
// Pseudocode pattern
const manifest = await contextConstructor.build({
  task: currentTask,
  tokenBudget: model.contextWindow * 0.7, // reserve 30% for output
  sources: ['/context/memory/fact/', '/context/memory/episodic/'],
  accessScope: agent.id,
});
```

**Updater:** During multi-turn sessions, incrementally refresh.

```typescript
// On each turn, check staleness and refresh
await contextUpdater.refresh({
  manifest,
  currentTurn: turnNumber,
  maxTokens: remainingBudget,
});
```

**Evaluator:** After each model response, validate and persist.

```typescript
const evaluation = await contextEvaluator.validate({
  output: modelResponse,
  sourceManifest: manifest,
  confidenceThreshold: 0.8,
});
if (evaluation.needsHumanReview) {
  await writeToHumanQueue(evaluation);
}
await persistVerifiedFacts(evaluation.extractedFacts);
```

### 3. Add governance

- Set retention policies in `/context/metadata.json`
- Configure access control per agent/session
- Enable transaction logging on all context operations

## Design Constraints to Enforce

These are hard architectural constraints from GenAI model design:

1. **Token Window** — Hard upper bound on active context. Budget explicitly. Never blindly truncate; always use selection + compression.
2. **Statelessness** — Models don't remember across calls. All continuity must come from the persistent context repository.
3. **Non-Determinism** — Same prompt can yield different outputs. Log all input/output pairs with metadata for audit and replay.

## Key Principles

- **Everything is a file** — Memory, tools, knowledge, human input are all mounted as uniform context nodes
- **Log every operation** — Reads, writes, selections, replacements get timestamps + lineage metadata
- **Separate data from tools from governance** — Config files vs executables vs access-control policies
- **Hot-swap backends** — Vector store, knowledge graph, SQLite — swap without changing consuming agents
- **Version context like code** — Apply DevOps practices to context artifacts
- **Human-in-the-loop at evaluator** — Route low-confidence outputs to human review; store annotations as first-class context
- **Deduplicate aggressively** — Consolidate semantically similar memory entries to keep retrieval sharp
- **Combat context rot** — Auto-archive stale scratchpads, compress old history, never delete raw logs
