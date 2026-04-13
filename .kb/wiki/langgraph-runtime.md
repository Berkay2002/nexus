---
created: 2026-04-13
updated: 2026-04-13
tags: [langgraph, pregel, runtime, state]
sources: [raw/langchain/langgraph/runtime.md]
---

# LangGraph Runtime

LangGraph's runtime is implemented by the [[pregel|`Pregel`]] class, which manages the execution of every LangGraph application. Every [[langgraph-application-structure|compiled graph or entrypoint]] produces a `Pregel` instance under the hood. The runtime is named after [Google's Pregel algorithm](https://research.google/pubs/pub37252/), a model for efficient large-scale parallel computation on graphs — not an arbitrary label.

> **Note:** The name "Pregel" is intentional and meaningful. It refers specifically to Google's 2010 paper on bulk synchronous parallel graph computation. Understanding the algorithm helps reason about LangGraph's execution semantics.

## Bulk Synchronous Parallel Model

Pregel organises execution as a sequence of discrete **supersteps** (called "steps" in LangGraph's docs). Each step has three phases that repeat until no actors remain to be scheduled, or a maximum step count is reached:

### 1. Plan

Determine which [[actors-and-channels|actors]] (`PregelNode`s) to execute in this step.

- On the **first step**: select actors subscribed to the special **input** channels.
- On **subsequent steps**: select actors subscribed to channels that were updated in the previous step.

This means only the nodes whose inputs changed are re-executed — idle nodes are skipped entirely.

### 2. Execution

Run all selected actors **in parallel** until:

- All complete, OR
- One fails, OR
- A timeout is reached.

> **Warning:** During the execution phase, channel updates written by actors are **invisible to other actors**. A node cannot see a peer's write within the same superstep. Reads always reflect channel state from the end of the previous superstep.

### 3. Update

Apply all values written by actors in this step to their respective channels. The channel's **reducer** (update function) is called with the accumulated writes. Only after this phase do the new values become visible.

## Termination

The loop terminates when:

- No actors are selected during the Plan phase (no channels were updated, so no nodes subscribe to updated channels), OR
- A configurable maximum step count is exceeded.

## How StateGraph Compiles to Pregel

The high-level [[langgraph-application-structure|`StateGraph`]] API is a builder that, on `.compile()`, produces a `Pregel` instance. You can inspect the result:

```typescript
const graph = builder.compile();
console.log(graph.nodes);    // { __start__: PregelNode, nodeA: PregelNode, ... }
console.log(graph.channels); // { field: LastValue, __start__: EphemeralValue, ... }
```

StateGraph automatically:
- Wraps each node function as a `PregelNode` subscribed to the state keys it reads
- Creates `LastValue` channels for every state field
- Creates `EphemeralValue` channels for edges and branch routing
- Creates the `__start__` and `__end__` sentinel channels

The Functional API (`entrypoint`) follows the same pattern, producing a single-node Pregel with `__start__`, `__end__`, and `__previous__` channels.

## Persistence Integration

[[langgraph-persistence|Checkpointers]] integrate at the Pregel level. After each superstep's Update phase, the runtime can snapshot the full channel state to a [[checkpointer|checkpointer]] backend. On resume, the runtime restores channel state from the checkpoint before the next Plan phase.

## Related

- [[pregel]] — the `Pregel` class API and direct usage
- [[actors-and-channels]] — `PregelNode`, `LastValue`, `Topic`, `BinaryOperatorAggregate`
- [[langgraph-application-structure]] — `StateGraph` and `entrypoint` high-level APIs
- [[langgraph-persistence]] — checkpointer integration with the runtime

## Sources

- `raw/langchain/langgraph/runtime.md` — LangGraph runtime overview, BSP phases, StateGraph compilation
