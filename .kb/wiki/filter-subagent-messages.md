---
created: 2026-04-12
updated: 2026-04-12
tags: [deepagents, frontend, filter-subagent-messages, use-stream, subagent]
sources: [raw/langchain/deepagents/frontend/subagent-streaming.md]
---

# filterSubagentMessages

`filterSubagentMessages` is a boolean option on the [[use-stream-hook|`useStream`]] hook from `@langchain/react` that strips all subagent tokens from the coordinator's main message stream. It is the essential first step for rendering clean [[subagent-streaming|subagent cards]] in a multi-agent UI.

## What it does

Without filtering, every token produced by every spawned subagent appears interleaved in `stream.messages`, making the coordinator's reasoning unreadable. With `filterSubagentMessages: true`:

- `stream.messages` contains **only** coordinator messages
- Subagent output is routed to `stream.subagents` (a `Map`) and accessible via `stream.getSubagentsByMessage(messageId)`
- The coordinator's reasoning thread is cleanly separated from specialist work

## Usage

```ts
const stream = useStream<typeof myAgent>({
  apiUrl: AGENT_URL,
  assistantId: "my_agent",
  filterSubagentMessages: true,
} as any);  // 'as any' required — see typing gotcha
```

Always set this to `true` in production UI. The only reason to set it to `false` is during development to verify that subagent tokens are flowing correctly in the raw stream.

## Typing gotcha: requires `as any`

`filterSubagentMessages` is typed on `AnyStreamOptions` but **not** on the `UseStreamOptions` overload that TypeScript resolves when you call `useStream<T>()` with a type parameter. This means TypeScript will reject the property unless you cast the options object:

```ts
// TypeScript error without cast:
// Argument of type '{ filterSubagentMessages: boolean; ... }'
// is not assignable to parameter of type 'UseStreamOptions<...>'

const stream = useStream<typeof myAgent>({
  filterSubagentMessages: true,  // error without 'as any'
} as any);
```

This is a type declaration gap in `@langchain/react` v0.3.x, not a runtime problem. The option works correctly at runtime regardless.

## What happens when `false` (debug mode)

Setting `filterSubagentMessages: false` causes all subagent tokens to appear inline in `stream.messages` interleaved with coordinator tokens. Useful during development to verify that subagent events are arriving, but must not be used in production.

## Related

- [[use-stream-hook]]
- [[get-subagents-by-message]]
- [[subagent-streaming]]
- [[async-subagents]]

## Sources

- `raw/langchain/deepagents/frontend/subagent-streaming.md` — option definition, behaviour, typing limitation, debug mode guidance
