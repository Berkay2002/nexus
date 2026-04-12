---
created: 2026-04-12
updated: 2026-04-12
tags: [deepagents, streaming, langgraph, stream-modes]
sources: [raw/langchain/deepagents/streaming.md]
---

# Stream Modes

LangGraph (and therefore [[streaming|Deep Agents]]) exposes four distinct stream modes that control the granularity and type of data emitted during agent execution. Choosing the right mode determines what your consumer code sees: raw tokens, step-level diffs, full state, or custom progress signals.

## `"messages"` — LLM token chunks

Emits individual token chunks produced by the LLM as well as complete tool-call and tool-result messages. Each chunk is a LangChain message object (typically `AIMessageChunk` or `ToolMessage`).

Use when you need:
- Typewriter-style token streaming in a UI
- Live visibility into tool calls and their arguments as they stream in
- Per-source attribution (main agent vs [[subagents|subagent]]) for token display

Tool call events arrive as `AIMessageChunk` with a non-empty `tool_call_chunks` array. The `name` field on a chunk signals the start of a new tool call; subsequent chunks carry `args` fragments that must be accumulated. Tool results arrive as `ToolMessage` instances.

## `"updates"` — per-step state diffs

Emits a dict `{ nodeName: stateSlice }` each time a graph node completes. The value for each key is only the portion of state that node wrote — not the full accumulated state.

Use when you need:
- Subagent lifecycle tracking (pending → running → complete)
- Step-level progress display ("main agent: model_request", "subagent: tools")
- Detecting when subagents start (task tool calls in `model_request`) and finish (tool messages in `tools`)

This is the most useful mode for [[subgraph-streaming]] because namespace filtering maps cleanly onto subagent identity.

## `"values"` — full state snapshots

Emits the entire graph state object after each step. More expensive than `"updates"` but gives a complete picture at each point in time — useful for reading accumulated `messages`, `todos`, or any other state key without needing to merge diffs yourself.

Use when you need:
- Reading the current todo list mid-run
- Debugging the full message history at each step
- Consumers that need a consistent state snapshot rather than incremental diffs

## `"custom"` — user-defined signals

Emits arbitrary serializable objects pushed by tools via `config.writer`. These events are completely decoupled from the graph's state model; the tool author decides what to emit and when.

Use when you need:
- Fine-grained progress indicators inside a long-running tool (e.g., `{ status: "analyzing", progress: 50 }`)
- Domain-specific signals that don't fit LangGraph's message/state model
- Sub-step visibility within a single tool call

Access `config.writer` from the second argument of a `tool()` callback (typed as `ToolRuntime`).

## Combining modes

Pass an array to `streamMode` to receive events from multiple modes simultaneously:

```typescript
agent.stream(input, {
  streamMode: ["updates", "messages", "custom"],
  subgraphs: true,
})
```

The iterator yields `[namespace, mode, data]` triples. The `mode` string identifies which mode produced each event, letting a single loop branch on both source agent (via namespace) and event type (via mode).

## `"messages-tuple"` mode

A lower-level variant of `"messages"` that yields `[messageChunk, metadata]` pairs. The `metadata` object contains `langgraph_node`, `langgraph_step`, and related fields for precise source attribution without relying solely on namespace. Less commonly needed — use standard `"messages"` unless you need raw metadata access.

## Related

- [[streaming]]
- [[subgraph-streaming]]
- [[subagents]]
- [[create-deep-agent]]

## Sources

- `raw/langchain/deepagents/streaming.md` — mode descriptions, code examples for all four modes, multi-mode combination pattern
