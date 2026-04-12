---
created: 2026-04-12
updated: 2026-04-12
tags: [deepagents, middleware, orchestration]
sources: [raw/langchain/deepagents/overview.md]
---

# Todo List Middleware

The todo list middleware is a built-in component of the [[deep-agents-overview|DeepAgents harness]] that injects a `write_todos` tool into every deep agent. It is one of the six [[harness-capabilities|harness capabilities]] (Planning).

## What It Does

- Provides a `write_todos` tool the agent calls to maintain a structured task list
- Each task has a status: `'pending'`, `'in_progress'`, or `'completed'`
- The task list is persisted in agent state, so it survives across tool call rounds
- The orchestrator updates the list as tasks are started and completed

## Why It Matters for Nexus

The frontend execution view in Nexus (`apps/web/src/components/execution/todo-panel.tsx`) reads `stream.values?.todos` to render the task list in the left panel of the 30/70 split layout. The todo list is the primary progress signal surfaced to the user during agent execution.

Access pattern in the frontend:

```ts
const todos = stream.values?.todos  // always optional-chain: values can be undefined initially
```

## Middleware Name

The middleware is called `todoListMiddleware` in the DeepAgents package and is wired automatically by [[create-deep-agent]]. It does not need to be added manually to the `middleware` array.

## Related

- [[harness-capabilities]]
- [[create-deep-agent]]
- [[deep-agents-overview]]
- [[streaming]]

## Sources

- `raw/langchain/deepagents/overview.md` — planning capabilities section describing `write_todos`, task statuses, and persistence
