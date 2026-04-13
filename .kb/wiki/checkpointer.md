---
created: 2026-04-13
updated: 2026-04-13
tags: [langgraph, persistence, checkpointer, state]
sources: [raw/langchain/langgraph/persistence.md]
---

# Checkpointer

A checkpointer is the persistence engine behind [[langgraph-persistence]]. It saves graph state to durable storage after every [[checkpoints|super-step]], keyed by `thread_id`. All checkpointer implementations conform to the `BaseCheckpointSaver` interface from `@langchain/langgraph-checkpoint`.

## Checkpointer Interface

Every checkpointer must implement four methods:

| Method | Purpose |
|---|---|
| `.put` | Store a checkpoint with its config and metadata |
| `.putWrites` | Store pending (intermediate) writes linked to a checkpoint |
| `.getTuple` | Fetch a checkpoint by `thread_id` + optional `checkpoint_id` — powers `graph.getState()` |
| `.list` | List checkpoints matching a config — powers `graph.getStateHistory()` |

## Available Implementations

| Package | Class | Use case |
|---|---|---|
| `@langchain/langgraph-checkpoint` | `MemorySaver` | Dev / testing — no install needed, included with LangGraph |
| `@langchain/langgraph-checkpoint-sqlite` | `SqliteSaver` | Local workflows, experimentation — install separately |
| `@langchain/langgraph-checkpoint-postgres` | `PostgresSaver` | Production — used by LangSmith hosted deployments |
| `@langchain/langgraph-checkpoint-mongodb` | `MongoDBSaver` | Production alternative |
| `@langchain/langgraph-checkpoint-redis` | `RedisSaver` | Production alternative |

> **Gotcha:** `MemorySaver` stores state only in-process memory — it is lost when the process restarts. Use `SqliteSaver` or `PostgresSaver` for anything that must survive a server restart.

## Basic Usage

```typescript
import { MemorySaver, StateGraph } from "@langchain/langgraph";

const checkpointer = new MemorySaver();
const graph = workflow.compile({ checkpointer });

// thread_id is REQUIRED in every invocation
const config = { configurable: { thread_id: "1" } };
await graph.invoke(input, config);
```

## Getting and Updating State

```typescript
// Get the latest state for a thread
const state = await graph.getState({ configurable: { thread_id: "1" } });

// Get a specific checkpoint by ID
const state = await graph.getState({
  configurable: {
    thread_id: "1",
    checkpoint_id: "1ef663ba-28fe-6528-8002-5a559208592c",
  },
});

// Walk the full history (newest first)
for await (const snapshot of graph.getStateHistory({ configurable: { thread_id: "1" } })) {
  console.log(snapshot);
}

// Update state (creates a new checkpoint, does not mutate the original)
// Values pass through reducers — channels with reducers accumulate, not overwrite
await graph.updateState(config, { foo: "new-value" });
```

> **Gotcha:** `graph.updateState()` passes values through reducer functions. A channel with an array reducer will *append* the update, not replace the value. Use `asNode` to control which node the update is attributed to.

## Checkpoint Namespace

Subgraphs get their own `checkpoint_ns` to avoid collisions:
- `""` — root (parent) graph
- `"node_name:uuid"` — a subgraph invoked via that node
- Nested: `"outer:uuid|inner:uuid"` — joined with `|`

Access it inside a node via `config.configurable?.checkpoint_ns`.

## Relationship to the Store

The checkpointer snapshots **thread-scoped** state. For data that must survive across threads (user memory, preferences), use the [[langgraph-store]] in addition to the checkpointer. They are compiled together:

```typescript
const graph = workflow.compile({ checkpointer, store });
```

> **Nexus relevance:** DeepAgents' `StoreBackend` wraps the LangGraph Store (not the checkpointer). The checkpointer is managed by the LangGraph server layer. Nexus does not configure a raw checkpointer directly — DeepAgents handles that via its deployment infrastructure.

## Related

- [[langgraph-persistence]]
- [[checkpoints]]
- [[threads]]
- [[langgraph-store]]

## Sources

- `raw/langchain/langgraph/persistence.md` — BaseCheckpointSaver interface, all five library implementations, `.put`/`.putWrites`/`.getTuple`/`.list` method descriptions
