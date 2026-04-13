---
created: 2026-04-13
updated: 2026-04-13
tags: [langgraph, testing, vitest, state, checkpointer]
sources: [raw/langchain/langgraph/test.md]
---

# LangGraph Testing

Patterns for writing unit tests against LangGraph graphs with custom node/edge structures using `vitest`.

> **Warning — scope:** This guide is for graphs built directly with `StateGraph`. If your agent uses LangChain's `createAgent` helper, use [[langchain-unit-testing]] or [[langchain-integration-testing]] instead — those cover the `createAgent`-based pattern. The patterns here do not apply to `createAgent` workflows.

## Core pattern: per-test graph factory + fresh checkpointer

Because LangGraph agents are stateful, the canonical test setup is:

1. Define a `createGraph()` factory function that returns an **uncompiled** `StateGraph`.
2. Inside each test, call `createGraph()` and compile it with a **new `MemorySaver` instance** for full state isolation between tests.

```ts
import { test, expect } from 'vitest';
import { StateGraph, StateSchema, START, END, MemorySaver } from '@langchain/langgraph';
import * as z from 'zod';

const State = new StateSchema({ my_key: z.string() });

const createGraph = () =>
  new StateGraph(State)
    .addNode('node1', () => ({ my_key: 'hello from node1' }))
    .addNode('node2', () => ({ my_key: 'hello from node2' }))
    .addEdge(START, 'node1')
    .addEdge('node1', 'node2')
    .addEdge('node2', END);

test('basic agent execution', async () => {
  const compiledGraph = createGraph().compile({ checkpointer: new MemorySaver() });
  const result = await compiledGraph.invoke(
    { my_key: 'initial_value' },
    { configurable: { thread_id: '1' } }
  );
  expect(result.my_key).toBe('hello from node2');
});
```

Key points:
- `StateSchema` (from `@langchain/langgraph`) wraps a Zod object schema and is passed directly to `StateGraph`.
- Assert on **state key values** in the returned result object — not on message arrays or model calls.
- Always pass a `thread_id` via `configurable` when using a [[checkpointer]].

## Testing individual nodes

Compiled graphs expose `graph.nodes['<name>']`, allowing isolated node invocation. This bypasses the checkpointer entirely.

```ts
test('individual node execution', async () => {
  const compiledGraph = createGraph().compile({ checkpointer: new MemorySaver() });
  const result = await compiledGraph.nodes['node1'].invoke({ my_key: 'initial_value' });
  expect(result.my_key).toBe('hello from node1');
});
```

Use this to unit-test node logic without running the full graph traversal.

## Partial execution (testing a subpath)

For large graphs you may want to test only a slice of nodes without restructuring the graph into subgraphs. Use LangGraph's persistence mechanism to simulate mid-graph state:

1. Compile the graph with a `MemorySaver` checkpointer.
2. Call `compiledGraph.updateState()` with an `asNode` argument set to the node **before** the target start node — this seeds the checkpointed state as if that node just ran.
3. Invoke with `null` input and `interruptAfter` set to the target end node.

```ts
test('partial execution from node2 to node3', async () => {
  const compiledGraph = createGraph().compile({ checkpointer: new MemorySaver() });

  // Seed state as if node1 just completed
  await compiledGraph.updateState(
    { configurable: { thread_id: '1' } },
    { my_key: 'initial_value' },
    'node1'  // asNode — execution resumes at node2
  );

  const result = await compiledGraph.invoke(null, {
    configurable: { thread_id: '1' },
    interruptAfter: ['node3'],  // stop before node4 runs
  });

  expect(result.my_key).toBe('hello from node3');
});
```

The `null` input signals resume-from-checkpoint rather than a fresh invocation.

## StateSchema and Zod

`StateSchema` accepts a plain Zod object and serves as the typed state definition for `StateGraph`. In tests, importing `StateSchema` directly from `@langchain/langgraph` (not `@langchain/langgraph-sdk`) is required.

## Installation

```bash
npm install -D vitest
```

No additional LangGraph-specific test utilities are needed — `MemorySaver` from `@langchain/langgraph` is the only test helper.

## Related

- [[langchain-testing-overview]]
- [[langchain-unit-testing]]
- [[langchain-integration-testing]]
- [[checkpointer]]

## Sources

- `raw/langchain/langgraph/test.md` — LangGraph-specific testing guide covering per-test graph factory, individual node invocation via `graph.nodes`, and partial execution with `updateState` + `interruptAfter`
