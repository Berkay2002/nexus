---
created: 2026-04-13
updated: 2026-04-13
tags: [langgraph, interrupts, human-in-the-loop]
sources: [raw/langchain/langgraph/interrupts.md]
---

# Command({ resume })

`new Command({ resume: value })` is the mechanism for resuming a [[langgraph-interrupts|LangGraph interrupt]]. It is passed as the input argument to `graph.invoke()` or `graph.stream()` on the same thread where the interrupt occurred, and the `value` it carries becomes the return value of the `interrupt()` call inside the node.

## Usage

```typescript
import { Command } from "@langchain/langgraph";

// The graph was previously invoked and paused at interrupt()
// Same thread_id as the original invocation — this is mandatory
const config = { configurable: { thread_id: "thread-1" } };

await graph.invoke(new Command({ resume: true }), config);
```

Inside the node, `interrupt()` now returns `true`:

```typescript
async function approvalNode(state: State) {
  const approved = interrupt("Do you approve?");
  // approved === true (whatever was passed to Command({ resume }))
  return { approved };
}
```

## Rules

- **Same thread_id required.** The runtime loads the saved [[checkpoints|checkpoint]] using the thread ID. Using a different thread ID starts a fresh execution with no state.
- **Resume value must be JSON-serializable.** Strings, numbers, booleans, plain objects, and arrays are all valid. Functions, class instances, and circular references are not.
- **Node restarts from the top.** When resumed, the entire node function runs again from its first line. Code before `interrupt()` executes a second time — guard it if it has side effects.
- **Only valid as invoke input.** `Command({ resume })` is the only `Command` form intended as the top-level input to `invoke()` / `stream()`. Do not use `Command({ update })` or `Command({ goto })` as the invoke input for resume flows.

> [!WARNING] Resume payload must be JSON-serializable
> Passing a non-serializable value (e.g., a class instance, a function, or a value with `undefined` fields) as the resume payload will cause serialization errors. Use plain data structures.

## Resuming Multiple Interrupts

When parallel nodes each called `interrupt()`, the result contains multiple entries in `__interrupt__` with distinct IDs. Pass a record mapping each interrupt ID to its resume value:

```typescript
import { Command, INTERRUPT, isInterrupted } from "@langchain/langgraph";

const result = await graph.invoke(initialInput, config);

if (isInterrupted(result)) {
  const resumeMap: Record<string, unknown> = {};
  for (const item of result[INTERRUPT]) {
    if (item.id != null) {
      resumeMap[item.id] = `response for ${item.value}`;
    }
  }
  await graph.invoke(new Command({ resume: resumeMap }), config);
}
```

## Relationship to Other `Command` Parameters

`Command` has other parameters (`update`, `goto`, `graph`) that are designed to be **returned from node functions** to update state or redirect execution within the graph. These are not valid as top-level inputs to `invoke()`. Only `resume` is intended for the call-site resume pattern.

## Related

- [[langgraph-interrupts]] — the `interrupt()` function that Command({ resume }) is answering
- [[human-in-the-loop]] — broader HITL workflow patterns using interrupts and Command
- [[langgraph-persistence]] — checkpointer that stores state between the interrupt and the resume
- [[threads]] — thread_id links the original invocation to the resume invocation

## Sources

- `raw/langchain/langgraph/interrupts.md` — Command({ resume }) API details, multi-interrupt resumption pattern, and warning about other Command forms
