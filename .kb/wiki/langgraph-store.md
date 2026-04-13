---
created: 2026-04-13
updated: 2026-04-13
tags: [langgraph, persistence, memory, state]
sources: [raw/langchain/langgraph/persistence.md]
---

# LangGraph Store

The LangGraph **Store** is a cross-thread key-value store for information that must survive beyond a single conversation thread. While the [[checkpointer]] snapshots per-thread state, the Store holds arbitrary named facts accessible across all threads — user preferences, long-term memories, shared knowledge.

> **Distinction from DeepAgents StoreBackend:** The [[store-backend]] in Nexus (`StoreBackend` class from `deepagents`) is a *DeepAgents filesystem backend* that wraps the LangGraph Store primitive described here. The underlying store interface (`BaseStore`, `InMemoryStore`, etc.) is what this article covers.

## Core Concept

Data in the Store is addressed by a **namespace tuple** and a **key**. The namespace is any sequence of strings (e.g., `[userId, "memories"]`). Within that namespace, each item has a unique `key`.

```typescript
import { MemoryStore } from "@langchain/langgraph";

const store = new MemoryStore();
const namespace = ["user-1", "memories"];

// Write
await store.put(namespace, "some-memory-id", { food_preference: "I like pizza" });

// Read all items in namespace
const memories = await store.search(namespace);
// memories[-1] = { value: {...}, key: "...", namespace: [...], createdAt: "...", updatedAt: "..." }
```

## Store Item Fields

| Field | Description |
|---|---|
| `value` | The stored data object |
| `key` | Unique identifier within the namespace |
| `namespace` | The namespace tuple (may serialize as array in JSON) |
| `createdAt` | ISO 8601 creation timestamp |
| `updatedAt` | ISO 8601 last-updated timestamp |

## Implementations

| Class | Package | Use case |
|---|---|---|
| `MemoryStore` | `@langchain/langgraph` | Dev / testing — not persistent across restarts |
| `InMemoryStore` | `@langchain/langgraph` | Dev / testing (alias) |
| `PostgresStore` | separate | Production |
| `RedisStore` | separate | Production |

All implementations extend `BaseStore` — use `BaseStore` as the type annotation in node function signatures.

> **Gotcha:** `MemoryStore`/`InMemoryStore` lose all data on process restart. Use `PostgresStore` or `RedisStore` for production deployments.

## Using the Store Inside Graph Nodes

Compile the graph with both a checkpointer and the store. Access the store via the `runtime` argument in any node:

```typescript
import { MemorySaver } from "@langchain/langgraph";

const graph = workflow.compile({ checkpointer: new MemorySaver(), store });

// Inside a node:
const updateMemory = async (state, runtime) => {
  const userId = runtime.context?.user_id;
  const namespace = [userId, "memories"];
  await runtime.store?.put(namespace, uuidv4(), { memory: "Some fact" });
};

const callModel = async (state, runtime) => {
  const namespace = [runtime.context?.user_id, "memories"];
  const memories = await runtime.store?.search(namespace, {
    query: state.messages.at(-1).content,
    limit: 3,
  });
  const info = memories.map((d) => d.value.memory).join("\n");
  // ... use info in model call
};
```

## Cross-Thread Access

Creating a new thread (`thread_id: "2"`) with the same `user_id` gives the same store namespace:

```typescript
// Thread 1
const config1 = { configurable: { thread_id: "1" }, context: { userId: "alice" } };

// Thread 2 — new conversation, same store memories because userId is the same
const config2 = { configurable: { thread_id: "2" }, context: { userId: "alice" } };
```

## Semantic Search

The store supports semantic (vector) search when configured with an embedding model:

```typescript
import { InMemoryStore } from "@langchain/langgraph";
import { OpenAIEmbeddings } from "@langchain/openai";

const store = new InMemoryStore({
  index: {
    embeddings: new OpenAIEmbeddings({ model: "text-embedding-3-small" }),
    dims: 1536,
    fields: ["food_preference", "$"], // fields to embed
  },
});

// Natural language query
const results = await store.search(namespace, {
  query: "What does the user like to eat?",
  limit: 3,
});
```

Control embedding per-item with the `index` option on `store.put`:

```typescript
// Only embed specific fields
await store.put(ns, id, { food_preference: "Italian", context: "dinner" }, { index: ["food_preference"] });

// Skip embedding (item is retrievable but not semantically searchable)
await store.put(ns, id, { system_info: "..." }, { index: false });
```

For LangSmith-hosted deployments, configure semantic search in `langgraph.json`:

```json
{
  "store": {
    "index": {
      "embed": "openai:text-embeddings-3-small",
      "dims": 1536,
      "fields": ["$"]
    }
  }
}
```

## Nexus Relevance

> **Nexus uses the LangGraph Store via DeepAgents' `StoreBackend`.** The `CompositeBackend` routes `/memories/` and `/skills/` to `StoreBackend`, which wraps a LangGraph `BaseStore` underneath. When reasoning about what Nexus stores where, think: `StoreBackend` = the DeepAgents adapter; `BaseStore` = the LangGraph primitive this article documents. See `CLAUDE.md` → CompositeBackend Pattern.

## Related

- [[langgraph-persistence]]
- [[checkpointer]]
- [[store-backend]]
- [[cross-conversation-context]]
- [[long-term-memory]]

## Sources

- `raw/langchain/langgraph/persistence.md` — Store interface, InMemoryStore usage, semantic search configuration, cross-thread access patterns, runtime.store node access
