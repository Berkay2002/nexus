---
created: 2026-04-13
updated: 2026-04-13
tags: [langgraph, pregel, runtime, state]
sources: [raw/langchain/langgraph/runtime.md]
---

# Pregel

`Pregel` is the concrete class that implements the [[langgraph-runtime]] in LangGraph. It is the object you receive when you call `.compile()` on a `StateGraph` or wrap a function with `entrypoint`. Most users never construct `Pregel` directly, but the class is exported for advanced use cases.

> **Note:** The class is named after [Google's Pregel algorithm](https://research.google/pubs/pub37252/) for large-scale parallel graph computation. It is not a generic or arbitrary label — the execution model directly implements the Bulk Synchronous Parallel (BSP) algorithm described in that paper.

## Import Paths

```typescript
import { Pregel, NodeBuilder, ChannelWriteEntry } from "@langchain/langgraph/pregel";
import { LastValue, EphemeralValue, Topic, BinaryOperatorAggregate } from "@langchain/langgraph/channels";
```

## Constructor

```typescript
new Pregel({
  nodes: Record<string, PregelNode>,
  channels: Record<string, BaseChannel>,
  inputChannels: string | string[],
  outputChannels: string | string[],
})
```

- `nodes` — map of node name → `PregelNode` (built via `NodeBuilder`)
- `channels` — map of channel name → channel instance
- `inputChannels` — which channels receive the invocation input
- `outputChannels` — which channels are returned as output

## NodeBuilder

`NodeBuilder` is the fluent API for constructing `PregelNode`s:

```typescript
const node = new NodeBuilder()
  .subscribeOnly("channelName")   // subscribe and read a single channel value
  .subscribeTo("channelName")     // subscribe to channel, read as { channelName: value }
  .do((input) => transform(input))
  .writeTo("outputChannel");
```

- `.subscribeOnly(name)` — node receives the raw channel value as its input
- `.subscribeTo(name)` — node receives `{ name: value }` (useful when subscribing to multiple)
- `.writeTo(name)` or `.writeTo(new ChannelWriteEntry(name, { skipNone: true }))` — route output

`ChannelWriteEntry` with `skipNone: true` skips writing `null` — useful for cycle termination.

## Usage Examples

### Single Node

```typescript
const node1 = new NodeBuilder()
  .subscribeOnly("a")
  .do((x: string) => x + x)
  .writeTo("b");

const app = new Pregel({
  nodes: { node1 },
  channels: {
    a: new EphemeralValue<string>(),
    b: new EphemeralValue<string>(),
  },
  inputChannels: ["a"],
  outputChannels: ["b"],
});

await app.invoke({ a: "foo" }); // { b: 'foofoo' }
```

### Multiple Nodes (Pipeline)

```typescript
const node1 = new NodeBuilder().subscribeOnly("a").do((x) => x + x).writeTo("b");
const node2 = new NodeBuilder().subscribeOnly("b").do((x) => x + x).writeTo("c");

const app = new Pregel({
  nodes: { node1, node2 },
  channels: {
    a: new EphemeralValue<string>(),
    b: new LastValue<string>(),
    c: new EphemeralValue<string>(),
  },
  inputChannels: ["a"],
  outputChannels: ["b", "c"],
});

await app.invoke({ a: "foo" }); // { b: 'foofoo', c: 'foofoofoofoo' }
```

Note: `b` uses `LastValue` here because `node2` reads it in a subsequent superstep; `EphemeralValue` clears after each step.

### Cycle (Self-Loop)

Write `null` to break the loop when `skipNone: true` is set:

```typescript
const node = new NodeBuilder()
  .subscribeOnly("value")
  .do((x: string) => x.length < 10 ? x + x : null)
  .writeTo(new ChannelWriteEntry("value", { skipNone: true }));

const app = new Pregel({
  nodes: { node },
  channels: { value: new EphemeralValue<string>() },
  inputChannels: ["value"],
  outputChannels: ["value"],
});

await app.invoke({ value: "a" }); // { value: 'aaaaaaaaaaaaaaaa' }
```

## Invocation

`Pregel` implements LangChain's `Runnable` interface:

```typescript
await app.invoke(input);
for await (const chunk of app.stream(input)) { ... }
```

## Inspecting a Compiled Graph

After `StateGraph.compile()` or `entrypoint(...)`, the result is a `Pregel` instance:

```typescript
const graph = builder.compile();
graph.nodes;    // { __start__: PregelNode, myNode: PregelNode, ... }
graph.channels; // { field: LastValue, __start__: EphemeralValue, ... }
```

StateGraph also injects `EphemeralValue` channels for each edge and conditional branch route (named `branch:fromNode:__self__:toNode`).

## Related

- [[langgraph-runtime]] — the BSP execution model Pregel implements
- [[actors-and-channels]] — channel types used with Pregel
- [[langgraph-application-structure]] — `StateGraph` and `entrypoint` which compile to Pregel
- [[langgraph-persistence]] — checkpointer hooks into the Pregel runtime

## Sources

- `raw/langchain/langgraph/runtime.md` — Pregel class, NodeBuilder API, all code examples
