---
created: 2026-04-12
updated: 2026-04-12
tags: [langgraph, context-engineering, configurable-model]
sources: [raw/langchain/deepagents/context.md]
---

# Config / Runtime Context

Config is LangGraph's mechanism for **static, single-run context** — immutable data threaded through an invocation without polluting the graph's state schema. It is the correct place for values that are fixed at call time: user IDs, API keys, feature flags, and per-call model overrides.

## The `configurable` Key

LangGraph reserves a top-level key named `configurable` in the second argument to `graph.invoke()` (and `stream()`). Anything placed there is accessible inside nodes, tools, and [[context-engineering]] middleware without being part of the graph's own state.

```typescript
await graph.invoke(
  { messages: [{ role: "user", content: "hi!" }] },
  { configurable: { user_id: "user_123" } }
);
```

Inside a tool or node, read it via `config.configurable`:

```typescript
const tool = tool(async (input, config) => {
  const userId = config?.configurable?.user_id;
  // ...
});
```

## What Belongs Here

- User or session identifiers
- API keys that should not be hard-coded in the graph definition
- Per-request model selection (Nexus uses `configurable.models` to swap tiers at runtime — see the configurable-model middleware in `apps/agents/src/nexus/middleware/configurable-model.ts`)
- Thread IDs that LangGraph uses to scope checkpointer state

## What Does NOT Belong Here

- Data that needs to be mutated during the run → use [[dynamic-runtime-context]] (state) instead.
- Data that must survive across invocations → use [[cross-conversation-context]] (Store) instead.

## Relationship to DeepAgents

In Nexus, `configurable.models` carries per-role model override strings (e.g., `"anthropic:claude-opus-4-5"`) into the `createConfigurableModelMiddleware` factory. Each sub-agent's middleware closure reads `config.configurable.models[agentName]` and swaps the resolved model without touching the agent's state.

## Related

- [[context-overview]]
- [[dynamic-runtime-context]]
- [[cross-conversation-context]]
- [[context-engineering]]

## Sources

- `raw/langchain/deepagents/context.md` — `configurable` key pattern and invoke-time config example
