---
created: 2026-04-12
updated: 2026-04-12
tags: [langgraph, context-engineering, state, persistence]
sources: [raw/langchain/deepagents/context.md]
---

# Context Overview

Context engineering is the practice of building dynamic systems that provide the right information and tools, in the right format, so that an AI application can accomplish a task. LangGraph organizes context along two independent dimensions to produce a clean taxonomy of its three mechanisms.

## The Two-Dimension Framework

### Dimension 1 — Mutability

- **Static context**: immutable data that does not change during execution (user metadata, API keys, database connections, tool definitions).
- **Dynamic context**: mutable data that evolves as the application runs (conversation history, intermediate results, tool-call observations).

### Dimension 2 — Lifetime

- **Single-run (runtime) context**: data scoped to one invocation. It does NOT mean the LLM context window — it means the execution-scoped environment your agent's code reads from.
- **Cross-conversation context**: data that persists across multiple conversations or sessions.

### The Three Mechanisms

Crossing the two dimensions yields exactly three slots LangGraph fills with concrete mechanisms:

| Mechanism | Mutability | Lifetime |
|---|---|---|
| [[config-runtime-context]] — `configurable` key passed at invoke time | Static | Single run |
| [[dynamic-runtime-context]] — LangGraph state object | Dynamic | Single run |
| [[cross-conversation-context]] — LangGraph Store | Dynamic | Cross-conversation |

There is no fourth slot: static cross-conversation context (immutable, persistent) is simply external configuration or environment variables — not managed by LangGraph.

## Why the Distinction Matters

Choosing the wrong mechanism causes subtle bugs:

- Passing a value in `configurable` that you intend to mutate mid-run will not work — config is frozen at invoke time.
- Storing conversation history in config instead of state means it cannot be appended to as the run progresses.
- Using single-run state for user preferences means they reset on every invocation — use the Store instead.

DeepAgents inherits this three-mechanism model. The [[context-engineering]] article covers DeepAgents-specific patterns layered on top of these primitives.

## Related

- [[config-runtime-context]]
- [[dynamic-runtime-context]]
- [[cross-conversation-context]]
- [[context-engineering]]
- [[deep-agents-overview]]

## Sources

- `raw/langchain/deepagents/context.md` — two-dimension framework and three-mechanism table
