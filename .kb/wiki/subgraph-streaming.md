---
created: 2026-04-12
updated: 2026-04-12
tags: [deepagents, streaming, langgraph, subagent]
sources: [raw/langchain/deepagents/streaming.md]
---

# Subgraph Streaming

Subgraph streaming is the LangGraph mechanism that surfaces events from nested subgraph execution (i.e., [[subagents]]) alongside main-agent events. Without it, only top-level graph events are visible; with it, every step, token, and custom signal from every subagent is independently observable.

## Enabling

Pass `subgraphs: true` in the stream options alongside a `streamMode`:

```typescript
for await (const [namespace, chunk] of await agent.stream(input, {
  streamMode: "updates",  // or "messages", "custom", or an array
  subgraphs: true,
})) { /* ... */ }
```

When enabled, the iterator yields `[namespace, chunk]` tuples instead of bare chunks. When multiple modes are combined, it yields `[namespace, mode, data]` triples.

## Namespace model

Each event carries a **namespace** — an ordered array of strings that encodes the agent hierarchy path from the root graph down to the node that produced the event.

| Namespace | Source |
|-----------|--------|
| `[]` (empty) | Main agent |
| `["tools:abc123"]` | Subagent spawned by tool call `abc123` |
| `["tools:abc123", "model_request:def456"]` | Model request node inside that subagent |

Detect subagent events by checking whether any namespace segment starts with `"tools:"`:

```typescript
const isSubagent = namespace.some((s: string) => s.startsWith("tools:"));
const toolCallId = namespace
  .find((s: string) => s.startsWith("tools:"))
  ?.split(":")[1];
```

Note: the pregel task ID embedded in the namespace (e.g., `abc123`) is a runtime-assigned identifier that is **not** the same as the `tool_call_id` in the corresponding `ToolMessage`. Matching the two requires a heuristic — see the lifecycle tracking pattern in [[streaming]].

## Routing events to UI

Use the namespace to route events to the correct UI component. In the Nexus frontend, the [[subagent-streaming]] pattern in `filterSubagentMessages` performs this routing automatically — it groups messages by their originating subagent so each subagent card shows only its own tokens and tool calls.

On the server side (LangGraph SDK), you pass `streamSubgraphs: true` (snake_case) in Python or `subgraphs: true` (camelCase) in TypeScript. In the Nexus frontend's `useStream` hook the equivalent option is `streamSubgraphs: true` on the submit call (see [[use-stream-hook]]).

## What each mode exposes from subgraphs

| Stream mode | What you see from subagent namespaces |
|-------------|--------------------------------------|
| `"updates"` | Per-step node diffs (`model_request`, `tools`) for each subagent |
| `"messages"` | Token chunks and tool call/result messages from each subagent's LLM |
| `"custom"` | `config.writer` payloads emitted by tools running inside subagents |
| `"values"` | Full subagent state snapshots after each step |

## Subagent lifecycle via subgraph streaming

Using `"updates"` + `subgraphs: true`:

1. **Pending** — `namespace=[]`, `nodeName="model_request"` contains a `task` tool call with `subagent_type` and `description` args
2. **Running** — events arrive with `namespace[0].startsWith("tools:")` — the subagent is executing
3. **Complete** — `namespace=[]`, `nodeName="tools"` emits a `ToolMessage` with `type="tool"` and the matching `tool_call_id`

## Related

- [[streaming]]
- [[stream-modes]]
- [[subagents]]
- [[async-subagents]]

## Sources

- `raw/langchain/deepagents/streaming.md` — `subgraphs: true` flag, namespace table, lifecycle detection pattern
