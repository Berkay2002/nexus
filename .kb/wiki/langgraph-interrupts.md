---
created: 2026-04-13
updated: 2026-04-13
tags: [langgraph, interrupts, human-in-the-loop, streaming]
sources: [raw/langchain/langgraph/interrupts.md]
---

# LangGraph Interrupts

`interrupt()` pauses a running LangGraph graph at an arbitrary point in node code, surfaces a payload to the caller, and waits indefinitely until the caller resumes with a `Command({ resume: ... })`. This is the primary mechanism for human-in-the-loop workflows in LangGraph.

## How It Works

Calling `interrupt(payload)` inside a node does four things:

1. Suspends graph execution at that exact line.
2. Persists current graph state via the [[langgraph-persistence|checkpointer]].
3. Returns the interrupted result to the caller — the payload is available under the `__interrupt__` field of the result object.
4. Blocks until the caller invokes the graph again with a `Command({ resume: value })` on the same [[threads|thread]].

When execution resumes, the node restarts from its beginning. Any code before the `interrupt()` call runs again, so keep pre-interrupt logic idempotent or guard it.

```typescript
import { interrupt } from "@langchain/langgraph";

async function approvalNode(state: State) {
  // Execution pauses here; payload appears in result.__interrupt__
  const approved = interrupt("Do you approve this action?");
  // approved receives the value from Command({ resume: ... })
  return { approved };
}
```

## Prerequisites

Three things are required for `interrupt()` to work:

1. **A checkpointer** — compiled into the graph via `graph.compile({ checkpointer })`. Use `MemorySaver` for development; use a database-backed checkpointer in production.
2. **A thread ID** — passed as `{ configurable: { thread_id: "..." } }` in the invoke config. Without it the runtime cannot load the saved state.
3. **A JSON-serializable payload** — the value passed to `interrupt()` must serialize cleanly (string, number, object, array).

> [!WARNING] thread_id is required
> Invoking a graph that calls `interrupt()` without a `thread_id` in the config will fail — the checkpointer has no cursor to write to or read from.

## The `__interrupt__` Field

When the graph suspends, `invoke()` / `stream()` returns with an `__interrupt__` array on the result object. Each element has `{ id, value }` where `value` is what was passed to `interrupt()`.

> [!WARNING] Easy to miss
> The field name is `__interrupt__` (double underscores). It is easy to typo as `interrupt` or `_interrupt_`. Always use the exported `INTERRUPT` constant or `isInterrupted()` helper to check for it safely.

```typescript
import { INTERRUPT, isInterrupted } from "@langchain/langgraph";

const result = await graph.invoke({ input: "data" }, config);
if (isInterrupted(result)) {
  for (const item of result[INTERRUPT]) {
    console.log(item.id, item.value);
  }
}
```

## Dynamic vs Static Breakpoints

Interrupts are **dynamic** — they are placed in code and can be conditional based on application logic. This differs from static breakpoints, which pause before or after specific named nodes at compile time and are configured on the graph itself.

Use `interrupt()` when the pause condition depends on runtime state. Use static breakpoints when you always want to pause at a node boundary.

## Interrupts Inside Tools

`interrupt()` can be called inside a tool function, not just in nodes. This lets approval logic live with the tool itself and makes it reusable across graphs. The LLM calls the tool naturally; the interrupt fires and pauses the graph, allowing the human to approve, edit parameters, or cancel before the side effect executes.

```typescript
const sendEmailTool = tool(
  async ({ to, subject, body }) => {
    const response = interrupt({ action: "send_email", to, subject, body });
    if (response?.action === "approve") {
      return `Email sent to ${response.to ?? to}`;
    }
    return "Email cancelled by user";
  },
  { name: "send_email", description: "...", schema: z.object({ ... }) },
);
```

## Multiple Simultaneous Interrupts

When parallel branches each call `interrupt()`, the result contains multiple entries in `__interrupt__`, each with a unique `id`. Resume all of them in one invocation by passing a record mapping each interrupt ID to its resume value:

```typescript
const resumeMap: Record<string, string> = {};
for (const i of result[INTERRUPT]) {
  if (i.id != null) resumeMap[i.id] = `answer for ${i.value}`;
}
await graph.invoke(new Command({ resume: resumeMap }), config);
```

## Common Use Cases

- **Approval workflows** — pause before a critical API call, database write, or financial transaction.
- **Review and edit** — let a human correct or extend LLM-generated content before the graph continues.
- **Tool call inspection** — pause before a tool executes so the human can inspect and optionally override its arguments.
- **Input validation** — pause after user input is collected and before the next pipeline stage.

## Related

- [[command-resume]] — how `Command({ resume })` feeds the return value back into the paused `interrupt()` call
- [[human-in-the-loop]] — broader HITL pattern and workflow design in LangGraph
- [[langgraph-persistence]] — checkpointer that makes interrupts durable
- [[threads]] — thread_id as the persistent cursor that links invocations
- [[deepagents-human-in-the-loop]] — higher-level `interruptOn` parameter in DeepAgents

## Sources

- `raw/langchain/langgraph/interrupts.md` — full interrupt API reference and TypeScript examples
