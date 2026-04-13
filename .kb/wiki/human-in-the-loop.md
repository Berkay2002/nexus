---
created: 2026-04-13
updated: 2026-04-13
tags: [langgraph, interrupts, human-in-the-loop, streaming]
sources: [raw/langchain/langgraph/interrupts.md]
---

# Human-in-the-Loop (LangGraph)

Human-in-the-loop (HITL) in LangGraph is the pattern of pausing graph execution mid-run to collect external input — typically a human decision, correction, or approval — before continuing. LangGraph implements this via the [[langgraph-interrupts|`interrupt()` function]], which suspends a node and persists state until the caller resumes with [[command-resume|`Command({ resume })`]].

> For the higher-level DeepAgents approach that wraps this pattern, see [[deepagents-human-in-the-loop]].

## Core Mechanics

When the graph hits an `interrupt()` call:

1. The [[langgraph-persistence|checkpointer]] saves the complete graph state at that exact point.
2. Execution suspends; the caller receives the interrupt payload under `__interrupt__`.
3. The graph waits indefinitely — no timeout, no retry — until the caller invokes again with `Command({ resume: value })` on the same [[threads|thread]].
4. The resume value becomes the return value of `interrupt()` inside the node, and execution continues from there (the node restarts from its top).

This is fundamentally different from a try/catch or a polling loop. The graph is truly paused; the [[checkpoints|checkpoint]] acts as a durable bookmark.

> [!WARNING] `thread_id` is required
> Every invocation in a HITL flow must include `{ configurable: { thread_id: "..." } }`. Without it, the checkpointer cannot identify which saved state to load, and the resume will not find the paused execution.

## Interrupts Are Dynamic, Not Static

`interrupt()` is placed in ordinary TypeScript code and can be conditional:

```typescript
async function reviewNode(state: State) {
  // Only interrupt if confidence is low
  if (state.confidence < 0.7) {
    const correction = interrupt({
      instruction: "Low confidence — please review",
      draft: state.output,
    });
    return { output: correction };
  }
  return {};
}
```

Static breakpoints (configured at compile time to always pause before or after a named node) are a separate concept. Use dynamic `interrupt()` when the pause decision depends on runtime state.

## Detecting an Interrupt

The caller checks the return value for the `__interrupt__` field. Use the `isInterrupted()` helper and the `INTERRUPT` symbol constant from `@langchain/langgraph` to avoid typos:

```typescript
import { INTERRUPT, isInterrupted } from "@langchain/langgraph";

const result = await graph.invoke(input, config);
if (isInterrupted(result)) {
  // result[INTERRUPT] is an array of { id, value } objects
  console.log(result[INTERRUPT][0].value); // the payload passed to interrupt()
}
```

> [!WARNING] `__interrupt__` field name
> The field is `__interrupt__` (double underscores on both sides). Checking for `result.interrupt` or `result._interrupt_` will silently miss it. Prefer the `INTERRUPT` symbol and `isInterrupted()` helper over raw property access.

## Common HITL Patterns

### Approval Workflow

Pause before a side-effectful action; route on the human's decision:

```typescript
const decision = interrupt({ question: "Proceed?", details: state.action });
return new Command({ goto: decision ? "proceed" : "cancel" });
```

Resume with `true` or `false` via `graph.invoke(new Command({ resume: true }), config)`.

### Review and Edit

Expose generated content for human correction; use the corrected version:

```typescript
const edited = interrupt({ instruction: "Edit this", content: state.draft });
return { draft: edited };
```

### Tool Call Inspection

Place `interrupt()` inside a tool function so the LLM can call the tool naturally but a human approves or edits its arguments before the side effect fires. See [[langgraph-interrupts]] for a full example.

### Streaming with HITL

Use multiple stream modes (`"messages"` and `"updates"`) to stream AI responses in real time while also detecting when an interrupt fires. Check for `__interrupt__` in update events, collect user input in your UI, then resume with `Command({ resume })` on the same thread.

## Multi-Interrupt (Parallel Branches)

When multiple parallel nodes each call `interrupt()`, all payloads appear in `result[INTERRUPT]` with distinct IDs. Resume all at once by mapping each ID to its answer:

```typescript
const resumeMap: Record<string, unknown> = {};
for (const item of result[INTERRUPT]) {
  if (item.id != null) resumeMap[item.id] = getUserAnswer(item.value);
}
await graph.invoke(new Command({ resume: resumeMap }), config);
```

## Relationship to DeepAgents HITL

The LangGraph `interrupt()` primitive is the low-level building block. DeepAgents exposes a higher-level `interruptOn` configuration parameter that generates these interrupt calls automatically at defined points in a deep agent's execution cycle. If you are using [[deepagents-human-in-the-loop|DeepAgents HITL via `interruptOn`]], you are still using `interrupt()` and `Command({ resume })` under the hood — the DeepAgents layer just wires them for you.

For Nexus's orchestrator (which uses `createDeepAgent`), prefer the DeepAgents `interruptOn` parameter for standard approval gates. Use raw `interrupt()` directly only when you need fine-grained control that `interruptOn` does not expose.

## Related

- [[langgraph-interrupts]] — `interrupt()` function reference and all call semantics
- [[command-resume]] — `Command({ resume })` and how to feed the return value back
- [[langgraph-persistence]] — checkpointer that makes HITL state durable across process restarts
- [[deepagents-human-in-the-loop]] — higher-level DeepAgents `interruptOn` approach
- [[streaming]] — streaming with HITL to show real-time output while waiting for human input

## Sources

- `raw/langchain/langgraph/interrupts.md` — all HITL patterns, dynamic vs static interrupts, multi-interrupt handling, streaming with HITL
