---
created: 2026-04-13
updated: 2026-04-13
tags: [langgraph, persistence, state, memory]
sources: [raw/langchain/langgraph/persistence.md]
---

# Threads (LangGraph)

A **thread** is a unique identifier (`thread_id`) that groups all [[checkpoints]] produced during a sequence of graph runs. It is the primary key the [[checkpointer]] uses to store and retrieve state. Every conversation, session, or workflow that requires persistent state must have a `thread_id`.

## What a Thread Contains

A thread holds the accumulated state of a sequence of runs. Each run appends one or more checkpoints to the thread, capturing the full `StateSnapshot` at each super-step. The thread's history is ordered chronologically, most recent first, and can be retrieved in full.

## Required Configuration

`thread_id` must be passed as part of the `configurable` field in the LangGraph config object on **every** invocation:

```typescript
const config = { configurable: { thread_id: "1" } };
await graph.invoke(input, config);
```

> **Gotcha:** If you omit `thread_id`, the checkpointer cannot save or resume state. There is no error thrown in all cases — the graph runs statelessly. This silently defeats persistence and breaks [[langgraph-interrupts|interrupt]]-based human-in-the-loop workflows.

## Thread State Retrieval

```typescript
// Latest state of the thread
const state = await graph.getState({ configurable: { thread_id: "1" } });
// Returns a StateSnapshot

// Full history, newest first
for await (const snapshot of graph.getStateHistory({ configurable: { thread_id: "1" } })) {
  console.log(snapshot.metadata.step, snapshot.values);
}

// Specific checkpoint within a thread
const state = await graph.getState({
  configurable: { thread_id: "1", checkpoint_id: "some-uuid" },
});
```

## Thread vs. Cross-Thread Memory

| | Thread (checkpointer) | Cross-thread (Store) |
|---|---|---|
| Scope | One conversation | All conversations for a user / namespace |
| Key | `thread_id` | `[namespace, key]` tuple |
| API | `graph.getState()`, `getStateHistory()` | `store.put()`, `store.search()` |
| Article | This page | [[langgraph-store]] |

To share data across threads (e.g., user preferences remembered across chat sessions), use the [[langgraph-store]] alongside the checkpointer. A new `thread_id` accesses the same store namespace as long as the namespace key (e.g., `user_id`) matches:

```typescript
// thread_id "2" — new conversation, same user, same store memories
const config = { configurable: { thread_id: "2" }, context: { userId: "1" } };
```

## Thread Management via LangSmith API

The LangSmith API provides endpoints to create and manage threads and their state. A thread must be created prior to executing a run when using the hosted platform. See the LangSmith API reference for thread CRUD operations.

## Nexus Relevance

In Nexus, threads correspond to LangGraph execution sessions managed by the LangGraph Dev Server. The `thread_id` is surfaced to the frontend via `@langchain/langgraph-sdk` and the `useStream` hook. The [[store-backend]] (accessed via `CompositeBackend`) uses separate namespacing via `StoreBackend` namespace factories — not `thread_id` alone.

## Related

- [[langgraph-persistence]]
- [[checkpointer]]
- [[checkpoints]]
- [[langgraph-store]]

## Sources

- `raw/langchain/langgraph/persistence.md` — thread definition, thread_id requirement, state retrieval methods, thread vs store distinction
