---
created: 2026-04-13
updated: 2026-04-13
tags: [langgraph, pregel, runtime, state]
sources: [raw/langchain/langgraph/runtime.md]
---

# Actors and Channels

In LangGraph's [[langgraph-runtime]], computation is expressed as **actors** that read from and write to **channels**. These two primitives are the building blocks that [[pregel|`Pregel`]] assembles into a running application.

## Actors (PregelNode)

An actor is a `PregelNode` — the unit of computation in [[pregel|Pregel]]. Each actor:

- **Subscribes** to one or more channels (its inputs)
- **Executes** a transform function on the subscribed values
- **Writes** results to one or more output channels

`PregelNode` implements LangChain's `Runnable` interface, so actors are composable with standard LangChain chains.

Actors are constructed via `NodeBuilder` (see [[pregel]] for the fluent API). When `StateGraph` compiles a graph, each node function is automatically wrapped as a `PregelNode`.

### Scheduling

Actors are not always-on. The [[langgraph-runtime|Plan phase]] selects only actors whose subscribed channels received updates in the previous superstep. Actors with no new inputs are skipped that step.

## Channels

Channels are the shared memory that actors communicate through. Every channel has three properties:

| Property | Description |
|---|---|
| **Value type** | The type of the stored value (e.g., `string`, `number[]`) |
| **Update type** | The type of each individual write (may differ from the value type) |
| **Reducer** | A function `(current, updates[]) => newValue` applied during the Update phase |

> **Warning:** A channel has a value type AND an update type AND a reducer — these are three distinct concepts. Writing to a channel is not the same as replacing its value; the reducer decides how writes accumulate.

> **Warning:** Channel updates written during a superstep's Execution phase are **not visible to other actors until the next superstep**. The Update phase must complete before any actor can read new values.

### Built-in Channel Types

#### `LastValue<T>`

```typescript
import { LastValue } from "@langchain/langgraph/channels";
new LastValue<string>()
```

- The default channel type. Stores the most recent value written.
- Overwrites on each update — no accumulation.
- Used for standard state fields in `StateGraph` (all named fields default to `LastValue`).
- Suitable for passing data from one step to the next.

#### `EphemeralValue<T>`

```typescript
import { EphemeralValue } from "@langchain/langgraph/channels";
new EphemeralValue<string>()
```

- Stores a value for exactly one superstep, then clears.
- Used for input channels, edge routing channels, and any value that should not persist.
- `StateGraph` uses `EphemeralValue` for `__start__`, per-node trigger channels, and branch routing channels.

#### `Topic<T>`

```typescript
import { Topic } from "@langchain/langgraph/channels";
new Topic<string>({ accumulate: true })
```

- A configurable pub/sub topic.
- With `accumulate: true`: collects all writes across a superstep into an array.
- Can also be configured to deduplicate values.
- Useful when multiple actors write to the same channel and you want all values, not just the last.

**Example — two actors writing to a Topic:**

```typescript
// node1 writes "foofoo", node2 writes "foofoofoofoo" to channel "c"
// Topic accumulates both:
{ c: ['foofoo', 'foofoofoofoo'] }
```

#### `BinaryOperatorAggregate<T>`

```typescript
import { BinaryOperatorAggregate } from "@langchain/langgraph/channels";

const reducer = (current: string, update: string) =>
  current ? current + " | " + update : update;

new BinaryOperatorAggregate<string>({ operator: reducer })
```

- Stores a persistent value updated by a binary operator applied to each incoming write.
- The operator receives `(currentValue, newWrite)` and returns the next stored value.
- Useful for running aggregates: counters, concatenation, scoring totals.
- Analogous to a `reduce()` call that accumulates over multiple supersteps.

## Channel Lifecycle in StateGraph

When `StateGraph` compiles, it maps state schema to channels automatically:

```typescript
// StateGraph with typed state fields → each becomes a LastValue channel
const graph = new StateGraph<{ topic: string; content?: string; score?: number }>({ ... });
// After compile():
graph.channels.topic   // LastValue<string>
graph.channels.content // LastValue<string | undefined>
graph.channels.score   // LastValue<number | undefined>

// Edge infrastructure channels (EphemeralValue):
graph.channels.__start__
graph.channels['branch:__start__:__self__:writeEssay']
// etc.
```

To use reducers (e.g., for message lists that append rather than overwrite), annotate state fields with a reducer when defining the `StateGraph` schema.

## Summary Table

| Channel | Persists across steps | Multiple writers | Use case |
|---|---|---|---|
| `LastValue` | Yes | Last write wins | Standard state fields |
| `EphemeralValue` | No (clears each step) | Last write wins | Input, edge triggers |
| `Topic` | Configurable | Accumulates all | Fan-in, pubsub |
| `BinaryOperatorAggregate` | Yes | Folded with operator | Running totals, reducers |

## Related

- [[langgraph-runtime]] — the BSP execution model that schedules actors and applies channel updates
- [[pregel]] — the `Pregel` class and `NodeBuilder` for constructing actors directly
- [[langgraph-application-structure]] — `StateGraph` which automates actor and channel creation
- [[langgraph-persistence]] — how channel state is checkpointed between supersteps

## Sources

- `raw/langchain/langgraph/runtime.md` — actor/channel definitions, built-in channel types, code examples
