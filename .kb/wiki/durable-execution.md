---
created: 2026-04-13
updated: 2026-04-13
tags: [langgraph, persistence, durable-execution, determinism]
sources: [raw/langchain/langgraph/durable-execution.md]
---

# Durable Execution

Durable execution is a technique in which a workflow saves its progress at key points, allowing it to pause and later resume exactly where it left off — without reprocessing already-completed steps. LangGraph implements this through its built-in [[langgraph-persistence|persistence]] layer: every execution step is written to a durable store, so interrupted workflows (from system failures or [[human-in-the-loop]] interactions) can be recovered from the last recorded state.

## Requirements

Three things are needed to enable durable execution:

1. **A [[checkpointer]]** — attach a checkpointer (e.g., `MemorySaver`, a database-backed saver) when compiling the graph. This activates state persistence.
2. **A thread identifier** — pass a `thread_id` in `config.configurable` on every graph invocation. This key tracks the execution history for one workflow instance. See [[threads]].
3. **Tasks around non-deterministic code** — wrap any side-effecting or non-deterministic operations in `task()` calls (from the [[langgraph-functional-api]]). Without this, resumed workflows will re-execute those operations, causing duplicated side effects.

```typescript
import { MemorySaver, task } from "@langchain/langgraph";
import { v7 as uuid7 } from "uuid";

const checkpointer = new MemorySaver();
const graph = builder.compile({ checkpointer });

const config = { configurable: { thread_id: uuid7() } };
await graph.invoke({ url: "https://example.com" }, config);
```

## Determinism and Consistent Replay

> [!WARNING]
> **Resume does NOT continue from the same line of code.** When a workflow is resumed, LangGraph identifies a _starting point_ and replays all steps from there forward. Any code that runs during replay must produce the same results as the original run.

This replay behaviour has direct consequences for how you write workflow code:

- **Wrap every side effect in a task or node.** API calls, file writes, logging — anything with an external effect must be inside a `task()` (Functional API) or a `node` (StateGraph). On replay, LangGraph retrieves the recorded result instead of re-executing the call.
- **Wrap non-deterministic operations in a task or node.** Random number generation, `Date.now()`, UUID generation — anything that could differ between runs must be captured so replay returns the same value.
- **Use idempotent operations.** A `task` that starts but fails before completing will be retried on resume. If the operation is not idempotent (e.g., a non-idempotent POST), it may execute twice. Use idempotency keys or pre-check for existing results.

> [!WARNING]
> **Do not put multiple side effects inline in one node without tasks.** If a node calls three APIs without wrapping each in a `task`, and the workflow resumes after the second call, all three calls will fire again on replay.

### Converting a node to use tasks

Before — side effect runs bare inside a node:

```typescript
const callApi: GraphNode<typeof State> = async (state) => {
  const response = await fetch(state.url); // will re-execute on replay
  const text = await response.text();
  return { result: text.slice(0, 100) };
};
```

After — side effect wrapped in a `task`:

```typescript
const makeRequest = task("makeRequest", async (url: string) => {
  const response = await fetch(url); // result is stored; replay uses the record
  const text = await response.text();
  return text.slice(0, 100);
});

const callApi: GraphNode<typeof State> = async (state) => {
  const results = await Promise.all(state.urls.map((url) => makeRequest(url)));
  return { results };
};
```

## Starting Points for Resuming Workflows

LangGraph does not resume mid-node. The starting point depends on which API is in use:

| API | Starting point on resume |
|-----|--------------------------|
| StateGraph (Graph API) | Beginning of the **node** where execution stopped |
| Subgraph call inside a node | Beginning of the **parent node** (and inside the subgraph, beginning of the stopped subgraph node) |
| Functional API | Beginning of the **entrypoint** where execution stopped |

This is why every operation inside a node that has side effects must be inside a task — the entire node replays from the top.

## Resuming Workflows

Two scenarios trigger a resume:

- **[[langgraph-interrupts|Human-in-the-loop pause]]** — use `interrupt()` to pause at a specific point, then send a `Command` with updated state to resume.
- **Failure recovery** — re-invoke the graph with the same `thread_id` and `null` as the input value. LangGraph picks up from the last successful checkpoint automatically.

## Durability Modes

LangGraph supports three [[durability-modes]] (`"exit"`, `"async"`, `"sync"`) that trade performance against consistency. Specify via the `durability` option on any graph execution call:

```typescript
await graph.stream({ input: "test" }, { durability: "sync" });
```

See [[durability-modes]] for a full comparison and guidance on when to use each.

## Related

- [[durability-modes]]
- [[langgraph-persistence]]
- [[checkpointer]]
- [[langgraph-functional-api]]
- [[langgraph-interrupts]]

## Sources

- `raw/langchain/langgraph/durable-execution.md` — full durable execution reference including requirements, determinism guidelines, modes, and resume behaviour
