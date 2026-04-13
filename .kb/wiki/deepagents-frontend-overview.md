---
created: 2026-04-12
updated: 2026-04-12
tags: [deepagents, frontend, use-stream, ai-elements, shadcn]
sources: [raw/langchain/deepagents/frontend/overview.md]
---

# DeepAgents Frontend Overview

The DeepAgents frontend layer is a set of patterns for building UIs that visualize deep agent workflows in real time — subagent progress, task planning, streaming content, and IDE-like sandbox experiences — on top of agents created with `createDeepAgent`.

## Architecture

DeepAgents use a coordinator-worker architecture on the backend. The main agent plans tasks and delegates to specialized subagents; each subagent runs in isolation and streams results back to the coordinator. On the frontend, [[use-stream-hook]] (imported from `@langchain/react`) surfaces both the coordinator's messages and each subagent's streaming state through a unified API.

The connection is straightforward: `useStream` is used identically for both `createAgent` and `createDeepAgent` backends. Deep agent usage adds three extra fields on the stream object:

- `stream.subagents` — a map of active [[subagent-streaming]] instances with their current state
- `stream.values?.todos` — the coordinator's real-time todo list (optional chaining required; `values` can be undefined on initial render)
- `filterSubagentMessages` option — strips subagent tool-call noise from the main message feed (see [[filter-subagent-messages]])

```ts
import { useStream } from "@langchain/react";

const stream = useStream<typeof agent>({
  apiUrl: "http://localhost:2024",
  assistantId: "agent",
});

const todos = stream.values?.todos;
const subagents = stream.subagents;
```

## Frontend Patterns

The documentation describes three distinct patterns built on this foundation:

| Pattern | Purpose |
|---|---|
| [[subagent-streaming]] | Collapsible subagent cards with streaming content and progress tracking |
| Todo list | Real-time task list synced from agent state via `stream.values?.todos` |
| [[sandbox-ide]] | IDE-like UI with file browser, code viewer, and diff panel backed by a sandbox |

The [[ai-elements]] component library provides pre-built React components for these patterns — see [[ai-elements-components]] for the full catalog. The [[agent-chat-ui]] scaffold provides a reference implementation with shadcn/ui base components that can be extended or replaced.

## Compatibility with LangChain Frontend Patterns

Because DeepAgents are built on the same LangGraph runtime, all standard LangChain frontend patterns (markdown message rendering, tool call display, human-in-the-loop UI) work without modification. The deep agent patterns are additive: they extend `useStream` rather than replacing it.

## Related

- [[deep-agents-overview]] — the harness these UIs render
- [[streaming]] — the four stream modes emitted to `useStream`
- [[use-stream-hook]]
- [[subagent-streaming]]
- [[filter-subagent-messages]]
- [[ai-elements]]
- [[ai-elements-components]] — full component catalog
- [[sandbox-ide]]

## Sources

- `raw/langchain/deepagents/frontend/overview.md` — architecture diagram, useStream integration example, pattern index, and compatibility note with LangChain frontend patterns
