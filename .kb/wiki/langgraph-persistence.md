---
created: 2026-04-13
updated: 2026-04-13
tags: [langgraph, persistence, checkpointer, memory, state]
sources: [raw/langchain/langgraph/persistence.md]
---

# LangGraph Persistence

LangGraph's built-in persistence layer saves graph state as [[checkpoints]] at every execution step, organized into [[threads]]. When you compile a graph with a [[checkpointer]], the full state is snapshotted after each super-step, enabling four critical capabilities: human-in-the-loop, memory across interactions, time travel debugging, and fault-tolerant execution.

## Why Use Persistence

| Feature | What Persistence Enables |
|---|---|
| **Human-in-the-loop** | Humans can inspect state at any point and the graph resumes after their edits. Requires [[langgraph-interrupts]] to pause execution. |
| **Memory** | Follow-up messages sent to the same thread retain prior conversation state automatically. |
| **Time travel** | Prior graph executions can be replayed or forked at any checkpoint to explore alternative trajectories. |
| **Fault tolerance** | If a node fails mid-execution, resume from the last successful super-step without re-running completed nodes (see pending writes). |

## How It Works

1. Compile a graph with a checkpointer: `workflow.compile({ checkpointer })`
2. Pass a `thread_id` in every invocation config — **this is required**
3. LangGraph saves a `StateSnapshot` after each super-step boundary
4. To share data *across* threads, add a `store` alongside the checkpointer

```typescript
import { MemorySaver } from "@langchain/langgraph";

const checkpointer = new MemorySaver();
const graph = workflow.compile({ checkpointer });

// thread_id is REQUIRED — omitting it means no state is saved
const config = { configurable: { thread_id: "1" } };
await graph.invoke(input, config);
```

## The Two Persistence Mechanisms

LangGraph provides two distinct but complementary persistence mechanisms:

- **[[checkpointer]]** — snapshots graph state per-thread per-step. Retrieved by `thread_id`. State is scoped to one conversation thread.
- **[[langgraph-store]]** — cross-thread key-value store for information that must survive across multiple threads (e.g., user preferences, long-term memories).

Both can be passed together at compile time:

```typescript
const graph = workflow.compile({ checkpointer, store: memoryStore });
```

> **Nexus relevance:** Nexus uses `StoreBackend` (via `CompositeBackend` routing `/memories/` and `/skills/`) which wraps the LangGraph Store primitive. The DeepAgents `StoreBackend` is the Nexus-specific adapter; the underlying primitive is the [[langgraph-store]] described here. See `CLAUDE.md` → CompositeBackend Pattern.

## Pending Writes and Fault Tolerance

When a node fails at a given super-step, LangGraph stores **pending writes** from any nodes that completed successfully at that same super-step. On resume, those successful nodes are not re-run — only the failed node retries. This prevents double-execution of side effects from nodes that already wrote their outputs.

## Agent Server Note

When using the LangGraph Agent Server (LangSmith-hosted deployment), you do not configure checkpointers or stores manually — the server provisions them automatically. This is transparent to graph logic.

## Related

- [[checkpointer]]
- [[checkpoints]]
- [[threads]]
- [[langgraph-store]]
- [[langgraph-interrupts]]

## Sources

- `raw/langchain/langgraph/persistence.md` — full persistence layer reference including threads, checkpoints, super-steps, store, and checkpointer libraries
