---
created: 2026-04-12
updated: 2026-04-12
tags: [langgraph, context-engineering, persistence, memory]
sources: [raw/langchain/deepagents/context.md]
---

# Cross-Conversation Context

Cross-conversation context is LangGraph's mechanism for **dynamic, persistent context** — mutable data that survives beyond a single run and is shared across multiple conversations or sessions. It is managed through the **LangGraph Store**, which acts as long-term memory.

## What It Covers

Data that must outlive an invocation belongs here:

- User profiles and preferences accumulated over time
- Historical interactions referenced in future sessions
- Persistent facts the agent learns and should recall later
- Shared knowledge accessible across different threads or users

## The LangGraph Store

The Store is a key-value store with a namespace/key addressing scheme. Agents read from it to populate context at the start of a run and write to it to record new information. Unlike [[dynamic-runtime-context]] (state), writes to the Store are not rolled back if a run fails — they are committed immediately.

In Nexus, the [[store-backend]] (SQLite-backed via Drizzle ORM) implements the Store interface. The `CompositeBackend` routes `/memories/` paths to the `StoreBackend` so the orchestrator's long-term memory is separate from the ephemeral AIO Sandbox workspace.

## Contrast with Runtime Context

| | [[dynamic-runtime-context]] | Cross-conversation context |
|---|---|---|
| Mechanism | LangGraph state | LangGraph Store |
| Lifetime | One run | Across runs |
| On run end | Discarded (without checkpointer) | Persisted |
| Use case | Conversation history for current session | User preferences, learned facts |

## Enabling Memory in LangGraph

To persist state across runs (making the state object itself durable), configure a LangGraph checkpointer and pass a `thread_id` via [[config-runtime-context]]. This is distinct from the Store — the checkpointer snapshots the full state graph; the Store holds arbitrary named facts.

## Related

- [[context-overview]]
- [[config-runtime-context]]
- [[dynamic-runtime-context]]
- [[store-backend]]
- [[memory]]

## Sources

- `raw/langchain/deepagents/context.md` — Store as long-term memory, user profiles and persistent facts use case
