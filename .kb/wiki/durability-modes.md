---
created: 2026-04-13
updated: 2026-04-13
tags: [langgraph, persistence, durable-execution, determinism]
sources: [raw/langchain/langgraph/durable-execution.md]
---

# Durability Modes

LangGraph's [[durable-execution]] system supports three durability modes that let you trade checkpoint overhead against resilience. The mode is set per graph invocation via the `durability` option on any execution method (`invoke`, `stream`, `streamEvents`).

```typescript
await graph.stream(
  { input: "test" },
  { durability: "sync" }  // or "async" or "exit"
);
```

## The Three Modes

### `"exit"` — Persist on exit only

LangGraph writes state to the [[checkpointer]] only when graph execution completes — whether successfully, with an error, or due to a [[langgraph-interrupts|human-in-the-loop interrupt]].

- **Performance:** Best. No per-step persistence overhead during execution.
- **Durability:** Lowest. A mid-execution process crash (e.g., OOM kill, power loss) loses all intermediate state. Recovery requires starting from scratch.
- **Use when:** Workflows are short-lived, fast, and a process crash is acceptable. Also suitable when the graph itself is idempotent and cheap to re-run.

### `"async"` — Persist asynchronously

LangGraph writes checkpoints asynchronously while the next step is already executing in parallel.

- **Performance:** Good. The checkpoint write is off the critical path for the next step.
- **Durability:** Medium. In normal operation, all checkpoints are written. A crash _during_ a checkpoint write can leave the last step unrecorded. Recovery falls back to the second-to-last checkpoint and replays one step.
- **Use when:** You want solid durability with minimal latency impact. This is a reasonable default for most production workflows.

### `"sync"` — Persist synchronously

LangGraph writes each checkpoint to completion before the next step begins.

- **Performance:** Lowest. Every step waits for the checkpoint write to complete before proceeding.
- **Durability:** Highest. Guarantees that every checkpoint is written before execution moves forward. A crash at any point recovers to the most recent step boundary.
- **Use when:** Data correctness is critical, checkpoints are slow relative to step execution, or the application cannot afford to replay even one step on recovery.

## Comparison Table

| Mode | Checkpoint timing | Crash recovery | Performance impact |
|------|-------------------|----------------|--------------------|
| `"exit"` | On exit only | Restart from scratch | None |
| `"async"` | Parallel with next step | Last confirmed checkpoint | Minimal |
| `"sync"` | Before next step starts | Most recent checkpoint | Moderate |

## Choosing a Mode

- **Short, cheap graphs with acceptable re-run cost** → `"exit"`
- **Most production LLM workflows** → `"async"` (good balance)
- **Critical pipelines, slow checkpointers, or compliance requirements** → `"sync"`

> [!NOTE]
> Durability mode controls _when_ checkpoints are written, not _whether_ they are written. You must still attach a [[checkpointer]] to the graph — without one, no state is persisted regardless of mode.

## Related

- [[durable-execution]]
- [[langgraph-persistence]]
- [[checkpointer]]
- [[langgraph-interrupts]]

## Sources

- `raw/langchain/langgraph/durable-execution.md` — durability modes spec including mode descriptions, performance trade-offs, and configuration syntax
