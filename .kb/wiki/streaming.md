---
created: 2026-04-12
updated: 2026-04-12
tags: [deepagents, streaming, langgraph, subagent]
sources: [raw/langchain/deepagents/streaming.md]
---

# Streaming

Deep Agents build on LangGraph's streaming infrastructure to expose real-time updates from both the main agent and any spawned [[subagents]]. Four stream modes cover distinct use cases: token-by-token LLM output, step-level state updates, full state snapshots, and user-defined progress signals.

## Overview

When you call `agent.stream(input, options)` the return value is an async iterable. With subgraph streaming disabled each iteration yields a single `chunk`. With `subgraphs: true` enabled each iteration yields a `[namespace, chunk]` tuple (or `[namespace, mode, data]` when multiple modes are combined).

Subgraph streaming is the mechanism that lets events from subagent execution surface alongside main-agent events. See [[subgraph-streaming]] for detail on the flag and namespace model.

## Stream modes

Four modes are available; they map directly to [[stream-modes]] for full per-mode detail.

| Mode | What it emits | Typical use |
|------|--------------|-------------|
| `"messages"` | Individual LLM token chunks + tool call/result messages | Typewriter token display, live tool-call inspection |
| `"updates"` | Dict of `{ nodeName: stateSlice }` per graph step | Step progress tracking, subagent lifecycle detection |
| `"values"` | Full graph state snapshot after each step | Inspecting current todos, messages, or accumulated state |
| `"custom"` | Arbitrary objects emitted via `config.writer` inside tools | Fine-grained progress bars, domain-specific signals |

Multiple modes can be combined by passing an array: `streamMode: ["updates", "messages", "custom"]`. The iterator then yields three-element tuples `[namespace, mode, data]` where `mode` identifies which mode produced each event.

## Enabling subgraph streaming

Pass `subgraphs: true` in the stream options:

```typescript
for await (const [namespace, chunk] of await agent.stream(input, {
  streamMode: "updates",
  subgraphs: true,
})) { /* ... */ }
```

Without this flag, only main-agent events are emitted.

## Emitting custom events

Inside any tool, access `config.writer` from the `ToolRuntime` argument and call it with any serializable object. Those objects surface in the `"custom"` stream mode:

```typescript
const myTool = tool(
  async ({ topic }, config: ToolRuntime) => {
    config.writer?.({ status: "starting", progress: 0 });
    // ... do work ...
    config.writer?.({ status: "complete", progress: 100 });
    return result;
  },
  { name: "my_tool", schema: z.object({ topic: z.string() }) }
);
```

## Subagent lifecycle detection

Using `"updates"` mode + `subgraphs: true`, you can track a subagent through three lifecycle phases:

1. **Pending** — main agent's `model_request` node emits a `task` tool call (contains `subagent_type` and `description`)
2. **Running** — events arrive from a `tools:<taskId>` namespace
3. **Complete** — main agent's `tools` node emits a `ToolMessage` whose `tool_call_id` matches the original task call

Note: the pregel task ID in the namespace (`tools:<pregelId>`) differs from the tool call ID used in tool result messages. Matching running→pending requires a heuristic (mark the oldest pending subagent running on first subagent event).

## Related

- [[stream-modes]]
- [[subgraph-streaming]]
- [[subagents]]
- [[async-subagents]]
- [[create-deep-agent]]

## Sources

- `raw/langchain/deepagents/streaming.md` — server-side streaming model, all four modes, lifecycle patterns, custom events
