---
created: 2026-04-12
updated: 2026-04-13
tags: [deepagents, langchain, orchestration, middleware]
sources: [raw/langchain/deepagents/overview.md, raw/langchain/deepagents/customize.md]
---

# createDeepAgent

`createDeepAgent()` is the TypeScript factory function that constructs a [[deep-agents-overview|DeepAgent]]. The Python equivalent is `create_deep_agent()`. It is the single entry point for configuring the full [[harness-capabilities|agent harness]] and returns a runnable LangGraph graph. Exported from the `deepagents` npm package — see [[deepagents-typescript-reference]] for the full type surface.

## Configuration Surface

The function accepts a configuration object. Key parameters:

| Parameter | Type | Purpose |
|---|---|---|
| `model` | `BaseLanguageModel \| string` | The base `BaseChatModel` driving the orchestrator. Accepts `"provider:model"` strings or an initialized instance. Defaults to `"anthropic:claude-sonnet-4-6"`. |
| `tools` | `StructuredTool[]` | Custom tools added to the agent's built-in tool set |
| `systemPrompt` | `string \| SystemMessage` | Appended to the built-in default system prompt |
| `backend` | `AnyBackendProtocol \| ((config) => AnyBackendProtocol)` | A [[backends|backend]] (or [[composite-backend]]) that backs the virtual filesystem |
| `subagents` | `SubAgent[]` | Array of [[subagents|SubAgent]] definitions for custom delegation targets |
| `skills` | `string[]` | Virtual POSIX paths pointing to skill directories (e.g., `["/skills/"]`) |
| `memory` | `string[]` | Paths to `AGENTS.md` memory files; always loaded into every invocation |
| `interruptOn` | `Record<string, boolean \| InterruptOnConfig>` | Tool-name → interrupt configuration map for [[deepagents-human-in-the-loop|HITL]] gates. **Requires `checkpointer`**. |
| `checkpointer` | LangGraph checkpointer | Required when using `interruptOn` or skills/memory with `StoreBackend` |
| `store` | LangGraph Store | Required when using `StoreBackend` for persistence |
| `responseFormat` | Zod schema | Structured output schema; result appears in `state.structuredResponse` |
| `middleware` | `AgentMiddleware[]` | Additional middleware applied to the agent graph |

> [!WARNING]
> The TypeScript parameter is `interruptOn` (camelCase), not `interrupt_on`. The Python package uses `interrupt_on`; they are not interchangeable. Using the wrong name silently omits HITL gates.

> [!WARNING]
> `interruptOn` requires a `checkpointer` to be passed alongside it. Without a checkpointer, the agent cannot pause and resume at interrupt points.

## Built-in Middleware

The harness automatically wires six middleware pieces for all agents:

- **`todoListMiddleware`** — injects the `write_todos` tool and state persistence. See [[todo-list-middleware]].
- **`FilesystemMiddleware`** — injects the `ls`, `read_file`, `write_file`, `edit_file`, `glob`, `grep` tools. See [[filesystem-middleware]].
- **`SubAgentMiddleware`** — injects the `task` delegation tool when subagents are configured. See [[subagents]].
- **`SummarizationMiddleware`** — handles automatic context compression. See [[context-engineering]].
- **`AnthropicPromptCachingMiddleware`** — automatically reduces redundant token processing when using Anthropic models (no-op on other providers).
- **`PatchToolCallsMiddleware`** — auto-repairs message history when tool calls are interrupted or cancelled before receiving results.

Three additional middleware are conditionally included based on parameters:

- **`MemoryMiddleware`** — added when the `memory` parameter is provided
- **`SkillsMiddleware`** — added when the `skills` parameter is provided
- **`HumanInTheLoopMiddleware`** — added when the `interruptOn` parameter is provided

Custom middleware can be passed via the `middleware` array and will run alongside these built-ins. See the middleware customization gotcha below.

> [!WARNING]
> Do not use mutable shared state (module-level variables, closure-captured counters) inside custom middleware. Use LangGraph graph state instead. Many operations run concurrently (subagents, parallel tool calls, concurrent invocations on different threads), and mutations cause race conditions. Update state via `beforeAgent: async (state) => ({ x: (state.x ?? 0) + 1 })` rather than mutating an external variable.

## Nexus Usage

In Nexus, `createDeepAgent` is called in `apps/agents/src/nexus/orchestrator.ts`. The orchestrator is configured with:

- A [[composite-backend]] routing to [[deepagents-sandboxes|AIO Sandbox]] (default) and [[store-backend]] (`/memories/`, `/skills/`)
- Four custom [[subagents]]: research, code, creative, and general-purpose override
- Five [[skills]]: deep-research, build-app, generate-image, data-analysis, write-report
- A configurable-model middleware for per-role runtime model swapping (see [[init-chat-model]])

## General-Purpose Subagent Override

DeepAgents always injects a default general-purpose subagent. Nexus overrides it by defining a `general-purpose` subagent in `agents/general-purpose/agent.ts` with a custom prompt that defers to specialized agents rather than attempting all tasks itself.

## Structured Output

Pass a Zod schema as `responseFormat` to capture a final structured result alongside the message stream. The model generates structured data at the end of its run; it is validated and stored under `state.structuredResponse`:

```typescript
const schema = z.object({ location: z.string(), temperature: z.number() });
const agent = await createDeepAgent({ responseFormat: schema, tools });
const result = await agent.invoke({ messages });
console.log(result.structuredResponse); // { location: "...", temperature: 18 }
```

## Related

- [[deep-agents-overview]]
- [[harness-capabilities]]
- [[deepagents-human-in-the-loop]]
- [[todo-list-middleware]]
- [[filesystem-middleware]]
- [[subagents]]

## Sources

- `raw/langchain/deepagents/overview.md` — factory parameter surface inferred from capabilities and skills/memory configuration sections
- `raw/langchain/deepagents/customize.md` — full parameter table, built-in middleware list (all 9), interruptOn shape, responseFormat/structuredResponse, custom middleware mutation warning
