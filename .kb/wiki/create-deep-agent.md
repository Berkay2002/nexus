---
created: 2026-04-12
updated: 2026-04-12
tags: [deepagents, langchain, orchestration, middleware]
sources: [raw/langchain/deepagents/overview.md]
---

# createDeepAgent

`createDeepAgent()` is the TypeScript factory function that constructs a [[deep-agents-overview|DeepAgent]]. The Python equivalent is `create_deep_agent()`. It is the single entry point for configuring the full [[harness-capabilities|agent harness]] and returns a runnable LangGraph graph. Exported from the `deepagents` npm package — see [[deepagents-typescript-reference]] for the full type surface.

## Configuration Surface

The function accepts a configuration object. Key parameters:

| Parameter | Purpose |
|---|---|
| `backend` | A [[backends|backend]] (or [[composite-backend]]) that backs the virtual filesystem and optionally enables code execution |
| `subagents` | Array of [[subagents|SubAgent]] definitions for custom delegation targets |
| `skills` | Skill files (as a `FileData` map) seeded into the agent's `/skills/` path |
| `memory` | Paths to `AGENTS.md` memory files; always loaded into every invocation |
| `interrupt_on` | Tool-name → interrupt configuration map for [[harness-capabilities#6-human-in-the-loop-hitl|HITL]] gates |
| `middleware` | Array of middleware functions applied to the agent graph (e.g., `todoListMiddleware`, `FilesystemMiddleware`, `SubAgentMiddleware`, `createSummarizationMiddleware`) |
| `model` | The base `BaseChatModel` driving the orchestrator |

## Built-in Middleware

The harness automatically wires several middleware pieces:

- **`todoListMiddleware`** — injects the `write_todos` tool and state persistence. See [[todo-list-middleware]].
- **`FilesystemMiddleware`** — injects the `ls`, `read_file`, `write_file`, `edit_file`, `glob`, `grep` tools. See [[filesystem-middleware]].
- **`SubAgentMiddleware`** — injects the `task` delegation tool when subagents are configured. See [[subagents]].
- **`createSummarizationMiddleware`** — handles automatic context compression. See [[context-engineering]].

## Nexus Usage

In Nexus, `createDeepAgent` is called in `apps/agents/src/nexus/orchestrator.ts`. The orchestrator is configured with:

- A [[composite-backend]] routing to [[deepagents-sandboxes|AIO Sandbox]] (default) and [[store-backend]] (`/memories/`, `/skills/`)
- Four custom [[subagents]]: research, code, creative, and general-purpose override
- Five [[skills]]: deep-research, build-app, generate-image, data-analysis, write-report
- A configurable-model middleware for per-role runtime model swapping (see [[init-chat-model]])

## General-Purpose Subagent Override

DeepAgents always injects a default general-purpose subagent. Nexus overrides it by defining a `general-purpose` subagent in `agents/general-purpose/agent.ts` with a custom prompt that defers to specialized agents rather than attempting all tasks itself.

## Related

- [[deep-agents-overview]]
- [[harness-capabilities]]
- [[todo-list-middleware]]
- [[filesystem-middleware]]
- [[subagents]]

## Sources

- `raw/langchain/deepagents/overview.md` — factory parameter surface inferred from capabilities and skills/memory configuration sections
