---
created: 2026-04-12
updated: 2026-04-12
tags: [deepagents, backends, store-backend, persistence]
sources: [raw/langchain/deepagents/backends.md]
---

# StoreBackend

`StoreBackend` is the durable [[backends|filesystem backend]] for [[deep-agents-overview|DeepAgents]]. It stores files in a LangGraph `BaseStore`, persisting them across threads and agent restarts. This is what Nexus uses for `/memories/` (long-term agent memory) and `/skills/` (skill file storage) via a [[composite-backend|CompositeBackend]].

## Usage

```typescript
import { createDeepAgent, StoreBackend } from "deepagents";
import { InMemoryStore } from "@langchain/langgraph";

// Local dev: provide an explicit store
const store = new InMemoryStore();
const agent = createDeepAgent({
  backend: new StoreBackend({
    namespace: (ctx) => [ctx.runtime.context.userId],
  }),
  store,
});
```

When deploying to LangSmith Deployment, omit the `store` parameter — the platform provisions one automatically.

## Namespace factories

The `namespace` parameter controls data isolation. It receives a `BackendContext` and returns a tuple of strings used as the LangGraph store namespace.

**Important:** The `namespace` parameter will be required in v1.9.0. Always set it explicitly for new code. Without it, the legacy default uses `assistantId`, meaning all users share the same storage.

```typescript
import { StoreBackend } from "deepagents";

// Per-user isolation
const backend = new StoreBackend({
  namespace: (ctx) => [ctx.runtime.serverInfo.user.identity],
});

// Per-assistant (shared across all users of same assistant)
const backend = new StoreBackend({
  namespace: (ctx) => [ctx.runtime.serverInfo.assistantId],
});

// Per-thread (scoped to one conversation)
const backend = new StoreBackend({
  namespace: (ctx) => [ctx.runtime.executionInfo.threadId],
});

// Combined scopes
const backend = new StoreBackend({
  namespace: (ctx) => [ctx.runtime.serverInfo.user.identity, ctx.runtime.executionInfo.threadId],
});
```

### BackendContext fields

- `ctx.runtime.context` — user-supplied context from LangGraph's context schema (e.g., `userId`)
- `ctx.runtime.serverInfo` — server metadata: `assistantId`, `graphId`, authenticated user (requires deepagents >= 1.9.0)
- `ctx.runtime.executionInfo` — execution identity: `threadId`, `runId`, `checkpointId` (requires deepagents >= 1.9.0)
- `ctx.state` — current agent state

Namespace components may only contain alphanumeric characters, hyphens, underscores, dots, `@`, `+`, colons, and tildes. Wildcards are rejected to prevent glob injection.

## Nexus usage

Nexus routes `/memories/` and `/skills/` to `StoreBackend` via `CompositeBackend`, while leaving the default route on the AIO Sandbox backend:

```typescript
new CompositeBackend(
  aioSandboxBackend,        // default route
  {
    "/memories/": new StoreBackend({ namespace: ... }),
    "/skills/":   new StoreBackend({ namespace: ... }),
  }
)
```

This gives agents durable access to memories and skills (cross-thread) while all other file I/O goes to the isolated AIO Sandbox container.

## Best for

- Long-term agent memories that persist across sessions
- Skill files loaded at agent startup
- Per-user or per-tenant data isolation
- Any state that must survive thread boundaries

## Related

- [[composite-backend]]
- [[backends]]
- [[state-backend]]
- [[backend-protocol]]

## Sources

- `raw/langchain/deepagents/backends.md` — StoreBackend section and namespace factories
