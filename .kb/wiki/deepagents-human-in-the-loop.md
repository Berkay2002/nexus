---
created: 2026-04-13
updated: 2026-04-13
tags: [deepagents, middleware, orchestration, langchain]
sources: [raw/langchain/deepagents/customize.md]
---

# DeepAgents Human-in-the-Loop (interruptOn)

DeepAgents' human-in-the-loop (HITL) mechanism pauses agent execution before a specified tool call and waits for a human decision. It is configured via the `interruptOn` parameter on [[create-deep-agent]] and implemented internally by `HumanInTheLoopMiddleware`.

> [!WARNING]
> `interruptOn` is a TypeScript camelCase parameter. Existing articles may reference the Python-style `interrupt_on` — that name does not exist in the TypeScript `deepagents` package. Use `interruptOn` in all TypeScript/Nexus code.

> [!WARNING]
> A **checkpointer is required** when using `interruptOn`. Without it, the agent cannot pause and resume — the runtime has nowhere to persist the interrupted state. Pass a `checkpointer` (e.g., `new MemorySaver()` or a LangGraph persistence adapter) alongside `interruptOn`.

## interruptOn Parameter Shape

```typescript
interruptOn?: Record<string, boolean | InterruptOnConfig>
```

- **`true`** — interrupt on this tool; present the human with three options: **approve**, **edit** (modify tool inputs), or **reject**
- **`false`** — never interrupt on this tool (useful to explicitly opt a tool out)
- **`InterruptOnConfig`** — object with `allowedDecisions` to restrict which choices the human sees

```typescript
import { createDeepAgent } from "deepagents";
import { MemorySaver } from "@langchain/langgraph";

const checkpointer = new MemorySaver();  // Required!

const agent = createDeepAgent({
  model: "anthropic:claude-sonnet-4-6",
  tools: [deleteFile, readFile, sendEmail],
  interruptOn: {
    delete_file: true,                                       // approve, edit, or reject
    read_file: false,                                        // never interrupt
    send_email: { allowedDecisions: ["approve", "reject"] }, // no edit option
  },
  checkpointer,  // Required!
});
```

## Decision Options

| Decision | Meaning |
|---|---|
| `approve` | Execute the tool call as-is |
| `edit` | Allow the human to modify the tool call inputs before execution |
| `reject` | Cancel the tool call; the agent receives a rejection signal and can decide how to proceed |

When `allowedDecisions` is not specified (i.e., `true` shorthand), all three decisions are available by default.

## When Does the Interrupt Fire?

The interrupt fires **before** the tool call executes. The agent has already decided to call the tool and composed its arguments; the HITL gate runs between the decision and the execution.

This makes `interruptOn` suitable for:
- **Destructive operations**: `delete_file`, `drop_table`, `send_email`
- **Expensive API calls**: calls that incur cost or rate-limit consumption
- **Safety-critical actions**: anything that affects external systems irreversibly

## Subagent-Level interruptOn

Each [[subagent-interface|SubAgent]] can carry its own `interruptOn` configuration that overrides the main agent's defaults for tools that subagent uses:

```typescript
const researchSubagent: SubAgent = {
  name: "research-agent",
  tools: [webSearch, writeReport],
  interruptOn: {
    write_report: true,  // require approval before writing
  },
};
```

## HumanInTheLoopMiddleware

The interrupt behaviour is implemented by `HumanInTheLoopMiddleware`, which is automatically added to the agent's middleware chain when `interruptOn` is provided. You do not add it manually. It is one of three middleware that are conditionally included alongside the six always-present defaults (see [[create-deep-agent]]).

## Checkpointer Types

For development, `MemorySaver` (in-process, non-durable) is sufficient. For production:
- LangGraph persistence adapters (Postgres, Redis, SQLite)
- LangSmith Deployment provisions its own checkpointer automatically

## Distinction from LangGraph interrupt()

`interruptOn` in DeepAgents is a declarative, config-driven gate at the tool boundary. The LangGraph primitive `interrupt()` is a lower-level imperative call that can be placed anywhere in a graph node. DeepAgents' `interruptOn` is implemented on top of LangGraph's interrupt mechanism but abstracts away the graph-level wiring.

## Related

- [[create-deep-agent]]
- [[harness-capabilities]]
- [[subagent-interface]]
- [[deepagents-typescript-reference]]
- [[todo-list-middleware]]

## Sources

- `raw/langchain/deepagents/customize.md` — Human-in-the-loop section: interruptOn shape, boolean vs InterruptOnConfig, checkpointer requirement, allowedDecisions options, FilesystemBackend HITL example
