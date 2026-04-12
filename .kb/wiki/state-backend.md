---
created: 2026-04-12
updated: 2026-04-12
tags: [deepagents, backends, filesystem]
sources: [raw/langchain/deepagents/backends.md]
---

# StateBackend

`StateBackend` is the default [[backends|filesystem backend]] for [[deep-agents-overview|DeepAgents]]. It stores files inside LangGraph agent state for the current thread, making it ephemeral — files survive multiple agent turns on the same thread (via checkpoints) but are lost when the thread ends.

## Usage

```typescript
import { createDeepAgent, StateBackend } from "deepagents";

// Implicitly uses StateBackend
const agent = createDeepAgent();

// Explicit
const agent2 = createDeepAgent({ backend: new StateBackend() });
```

## How it works

Files are serialized into the LangGraph state dict and persisted by the LangGraph checkpointer on each step. When the thread is resumed, state is rehydrated and all files are available again. When a new thread starts, files are gone.

Because state is shared between the orchestrator and subagents, files written by a subagent remain accessible to the orchestrator and other subagents after that subagent finishes.

## Best for

- Scratch pads for intermediate results
- Automatic eviction: large tool outputs can be written to state and read back piecemeal, reducing context window pressure
- Simple single-session agents where cross-thread persistence is not needed

## Limitations

- Data does not survive across threads — no long-term memory
- For persistence across threads, use [[store-backend]]
- For shell execution, use a sandbox (see [[deepagents-sandboxes]]) or [[local-shell-backend]]

## Related

- [[backends]]
- [[composite-backend]]
- [[store-backend]]
- [[backend-protocol]]

## Sources

- `raw/langchain/deepagents/backends.md` — StateBackend section
