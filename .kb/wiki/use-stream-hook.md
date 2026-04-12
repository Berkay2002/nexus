---
created: 2026-04-12
updated: 2026-04-12
tags: [deepagents, frontend, use-stream, streaming, filter-subagent-messages]
sources: [raw/langchain/deepagents/frontend/subagent-streaming.md]
---

# useStream Hook

`useStream` is the primary React hook for streaming LangGraph agent output on the frontend. For full [[subagent-streaming|subagent streaming]] features — including `filterSubagentMessages`, `stream.subagents`, and `getSubagentsByMessage` — you **must** import from `@langchain/react`, not from `@langchain/langgraph-sdk/react`.

## Critical import gotcha

```ts
// CORRECT — has subagent features (v0.3.3+)
import { useStream } from "@langchain/react";

// WRONG — missing filterSubagentMessages, stream.subagents, getSubagentsByMessage
import { useStream } from "@langchain/langgraph-sdk/react";
```

The SDK version (`@langchain/langgraph-sdk/react`) lacks all subagent-related APIs. Always use `@langchain/react`.

## Basic setup

```tsx
import { useStream } from "@langchain/react";
import type { myAgent } from "./agent";

const stream = useStream<typeof myAgent>({
  apiUrl: "http://localhost:2024",
  assistantId: "my_agent",
  filterSubagentMessages: true,
} as any);  // 'as any' required — see typing gotcha below
```

Pass `typeof myAgent` as the type parameter for type-safe access to `stream.values` (e.g. `stream.values?.todos`).

## Typing gotcha: `filterSubagentMessages` requires `as any`

`filterSubagentMessages` is defined on `AnyStreamOptions` but **not** on the `UseStreamOptions` overload that the hook exposes to TypeScript. When you use the hook with a type parameter (as above), TypeScript resolves to the `UseStreamOptions` overload and rejects `filterSubagentMessages` as an unknown property.

Workaround: cast the options object with `as any`:

```ts
const stream = useStream<typeof myAgent>({
  apiUrl: AGENT_URL,
  assistantId: "my_agent",
  filterSubagentMessages: true,
} as any);
```

This is not a bug you can fix by upgrading — it is a type declaration gap in `@langchain/react` as of v0.3.x.

## Options surface

| Option | Type | Notes |
|---|---|---|
| `apiUrl` | `string` | LangGraph server URL |
| `assistantId` | `string` | Graph/assistant ID to target |
| `filterSubagentMessages` | `boolean` | Removes subagent tokens from `stream.messages` |
| `threadId` | `string \| null` | Resume an existing thread |
| `onError` | `(err) => void` | Error handler |

## Key properties on the returned stream object

| Property | Notes |
|---|---|
| `stream.messages` | Coordinator messages only (when `filterSubagentMessages: true`) |
| `stream.values` | Current graph state — **can be `undefined` initially**, always use optional chaining: `stream.values?.todos` |
| `stream.isLoading` | `true` while the run is in progress — use for submit button state and synthesis indicator |
| `stream.subagents` | `Map<string, SubagentStreamInterface>` — all subagents in the current run |
| `stream.getSubagentsByMessage(id)` | Returns subagents spawned by a specific message |
| `stream.submit(input, options)` | Sends a new message; pass `{ streamSubgraphs: true }` |

## `stream.values` is undefined initially

Until the first state update arrives, `stream.values` is `undefined`. Always use optional chaining:

```ts
// Safe
const todos = stream.values?.todos ?? [];

// Will throw on first render
const todos = stream.values.todos;  // TypeError: Cannot read properties of undefined
```

## Submitting messages

```ts
stream.submit(
  { messages: [{ type: "human", content: text }] },
  { streamSubgraphs: true }   // required to receive subagent events
);
```

Without `{ streamSubgraphs: true }`, subgraph (subagent) events are not emitted and `stream.subagents` will remain empty.

## Related

- [[filter-subagent-messages]]
- [[get-subagents-by-message]]
- [[subagent-streaming]]
- [[subgraph-streaming]]
- [[deepagents-frontend-overview]]

## Sources

- `raw/langchain/deepagents/frontend/subagent-streaming.md` — import path, filterSubagentMessages usage, streamSubgraphs submit option, stream object shape
