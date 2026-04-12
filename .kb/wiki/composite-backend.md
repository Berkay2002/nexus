---
created: 2026-04-12
updated: 2026-04-12
tags: [deepagents, backends, composite-backend, persistence, filesystem]
sources: [raw/langchain/deepagents/backends.md]
---

# CompositeBackend

`CompositeBackend` is the path-routing [[backends|filesystem backend]] for [[deep-agents-overview|DeepAgents]]. It dispatches file operations to different backends based on path prefix, enabling a single agent to have simultaneously ephemeral scratch space, durable long-term storage, and sandbox execution — all visible through one unified filesystem.

This is the most important backend for Nexus: the production configuration routes `/memories/` and `/skills/` to [[store-backend|StoreBackend]] while sending all other paths to the [[aio-sandbox-overview|AIO Sandbox]] backend.

## How routing works

```typescript
import { createDeepAgent, CompositeBackend, StateBackend, StoreBackend } from "deepagents";

const agent = createDeepAgent({
  backend: new CompositeBackend(
    new StateBackend(),         // first arg = default backend
    {
      "/memories/": new StoreBackend(),   // route map
    }
  ),
  store,
});
```

**Routing rules:**

1. The **first argument** is the default backend. Any path that does not match a route prefix falls through to this backend.
2. The **second argument** is a route map: `{ [pathPrefix: string]: Backend }`.
3. Path prefix matching is **longest prefix wins** — a route for `"/memories/projects/"` overrides `"/memories/"` for paths under `/memories/projects/`.
4. Path prefixes must end with `/` by convention.

## Routing examples

Given a `CompositeBackend(StateBackend(), { "/memories/": StoreBackend() })`:

| Path | Routed to |
|---|---|
| `/workspace/plan.md` | StateBackend (default) |
| `/tmp/scratch.txt` | StateBackend (default) |
| `/memories/agent.md` | StoreBackend |
| `/memories/projects/foo.md` | StoreBackend |

Given nested routes `{ "/memories/": A, "/memories/projects/": B }`:

| Path | Routed to |
|---|---|
| `/memories/agent.md` | Backend A |
| `/memories/projects/foo.md` | Backend B (longer prefix wins) |

## Aggregate operations

`ls`, `glob`, and `grep` on a path that spans multiple backends aggregate results from all matching backends and return them with their original path prefixes intact. This means the agent sees a unified directory tree even when files are stored across different backends.

## Nexus configuration

The Nexus `CompositeBackend` is defined in `apps/agents/src/nexus/backend/composite.ts`:

```typescript
new CompositeBackend(
  aioSandboxBackend,                          // default: AIO Sandbox container
  {
    "/memories/": new StoreBackend({ ... }),  // durable memory
    "/skills/":   new StoreBackend({ ... }),  // skill files
  }
)
```

- **Default route** → [[aio-sandbox-overview|AIOSandboxBackend]] — all agent workspace operations (`/workspace/`, `/tmp/`, etc.) run inside the sandboxed Docker container.
- **`/memories/`** → [[store-backend|StoreBackend]] — long-term agent memories that persist across threads and restarts.
- **`/skills/`** → [[store-backend|StoreBackend]] — skill files seeded at startup via `orchestrator.invoke({ files: nexusSkillFiles })`.

This setup means skills and memories are durable (written once, read many times) while all ephemeral computation happens inside the isolated AIO Sandbox.

## StoreBackend routing note

When any route uses `StoreBackend`, ensure a store is provided via `createDeepAgent({ store: ... })` or provisioned by the deployment platform.

## Migration note

The older backend factory pattern is deprecated. Pass pre-constructed instances directly:

```typescript
// Before (deprecated)
backend: (config) => new CompositeBackend(new StateBackend(config), { ... })

// After
backend: new CompositeBackend(new StateBackend(), { ... })
```

The factory pattern still works at runtime with a deprecation warning.

## Related

- [[store-backend]]
- [[state-backend]]
- [[backends]]
- [[aio-sandbox-overview]]
- [[backend-protocol]]

## Sources

- `raw/langchain/deepagents/backends.md` — CompositeBackend section, routing behavior, and migration example
