---
created: 2026-04-12
updated: 2026-04-12
tags: [deepagents, typescript, npm, langchain, langchain-core]
sources: [raw/references/deepagents-reference.md]
---

# deepagents TypeScript Package Reference

The `deepagents` npm package is the TypeScript/JavaScript implementation of the [[deep-agents-overview]] harness. It exposes [[create-deep-agent|`createDeepAgent`]], the full class hierarchy for backends and sandboxes, and the TypeScript types that Nexus imports directly. Full API docs live at [reference.langchain.com/javascript/deepagents](https://reference.langchain.com/javascript/deepagents).

## Installation

```bash
npm install deepagents
# or
yarn add deepagents
pnpm add deepagents
```

Requires TypeScript 5.0+. MIT licensed.

## Main Entry Point

`createDeepAgent()` is the primary factory. It returns a compiled LangGraph graph that can be invoked or streamed like any other LangGraph agent:

```typescript
import { createDeepAgent } from "deepagents";

const agent = createDeepAgent({
  model,          // BaseChatModel or model string; defaults to claude-sonnet-4-5-20250929
  systemPrompt,   // appended to the built-in Claude Code-inspired default prompt
  tools,          // StructuredTool[] available to the orchestrator
  middleware,     // AgentMiddleware[] — adds todoListMiddleware, FilesystemMiddleware, SubAgentMiddleware automatically
  subagents,      // SubAgent[] — custom sub-agents (see below)
  backend,        // backend instance or factory; defaults to StateBackend
  skills,         // string[] of paths — e.g. ["/skills/"]
  interruptOn,    // Record<toolName, bool | InterruptOnConfig> for HITL
  store,          // LangGraph Store for StoreBackend / long-term memory
  checkpointer,   // LangGraph checkpointer for conversation persistence
});
```

See [[create-deep-agent]] for full parameter semantics.

## Exported Classes

All classes are also re-exported from the top-level `deepagents` index:

| Class | Path | Purpose |
|---|---|---|
| `BaseSandbox` | `backends/BaseSandbox` | Abstract base for custom sandbox implementations; only `execute()` is required |
| `CompositeBackend` | `backends/CompositeBackend` | Routes file operations to different backends by path prefix |
| `FilesystemBackend` | `backends/FilesystemBackend` | Stores files on the real local filesystem |
| `LocalShellBackend` | `backends/LocalShellBackend` | Filesystem + local shell execution |
| `StateBackend` | `backends/StateBackend` | In-memory, ephemeral; the default when no backend is specified |
| `StoreBackend` | `backends/StoreBackend` | Persistent storage backed by a LangGraph Store |
| `LangSmithSandbox` | `backends/LangSmithSandbox` | LangSmith-hosted sandbox |
| `SandboxError` | `backends/SandboxError` | Error class for sandbox failures |
| `ConfigurationError` | `errors/ConfigurationError` | Error class for configuration mistakes |

See [[backends]] for routing and usage patterns; see [[deepagents-sandboxes]] for `BaseSandbox` extension details.

## Key Exported Interfaces

```typescript
// Defines a custom sub-agent passed to createDeepAgent({ subagents })
interface SubAgent {
  name: string;
  description: string;
  systemPrompt: string;
  tools?: StructuredTool[];
  model?: LanguageModelLike | string;
  middleware?: AgentMiddleware[];
  interruptOn?: Record<string, boolean | InterruptOnConfig>;
  skills?: string[];   // explicit paths; NOT inherited from main agent automatically
}
```

Other interfaces Nexus uses: `BackendProtocol`, `BackendRuntime`, `ExecuteResponse`, `FileUploadResponse`, `FileDownloadResponse`, `CreateDeepAgentParams`.

See [[subagent-interface]] for detailed field semantics.

## FileData Type — V1 vs V2 Gotcha

`FileData` is a **discriminated union** of two versions:

```typescript
// V1 — content is a string array (one element per line)
type FileDataV1 = { content: string[]; ... }

// V2 — content is a string or binary Uint8Array
type FileDataV2 = { content: string | Uint8Array; ... }

type FileData = FileDataV1 | FileDataV2;
```

**Nexus uses V1 format for skills.** The skills barrel export at `skills/index.ts` builds a `FileData` map with `content: string[]` (line arrays). If you pass a V2-shaped object where V1 is expected, the skill files will not load correctly. Use the `isFileDataV1()` type guard (exported from `deepagents`) to discriminate at runtime.

Helper functions exported for working with `FileData`: `createFileData()`, `fileDataToString()`, `updateFileData()`, `isFileDataBinary()`, `migrateToFileDataV2()`.

## Middleware Exports

`createDeepAgent` automatically attaches these three middleware — but each is also importable standalone:

| Export | Purpose |
|---|---|
| `todoListMiddleware` (from `langchain`) | `write_todos` planning tool |
| `createFilesystemMiddleware()` | `ls`, `read_file`, `write_file`, `edit_file`, `glob`, `grep`, `execute` tools |
| `createSubAgentMiddleware()` | `task` tool for spawning [[subagent-interface\|sub-agents]] |
| `createSummarizationMiddleware()` | Summarizes old messages to prevent context overflow |
| `createMemoryMiddleware()` | Cross-thread long-term memory |
| `createSkillsMiddleware()` | Injects skill files into agent context |
| `createAgentMemoryMiddleware()` | Structured memory with Store |

## Skills Inheritance Rule

When `skills` paths are set on `createDeepAgent`, the general-purpose sub-agent inherits them automatically. **Custom sub-agents do NOT inherit skills from the main agent** — they receive only the `skills` paths explicitly listed on their own `SubAgent` definition. This is intentional context isolation.

## ACP Support

The companion package `deepagents-acp` wraps any deep agent as an [Agent Client Protocol](https://agentclientprotocol.com) server (JSON-RPC 2.0 over stdio), enabling IDE integrations with Zed and JetBrains:

```bash
npm install deepagents-acp
npx deepagents-acp --name my-agent --workspace /path/to/project
```

## External References

- npm: [npmjs.com/package/deepagents](https://www.npmjs.com/package/deepagents)
- API reference: [reference.langchain.com/javascript/deepagents](https://reference.langchain.com/javascript/deepagents)
- Source repo: [github.com/langchain-ai/deepagentsjs](https://github.com/langchain-ai/deepagentsjs)
- Examples: [github.com/langchain-ai/deepagentsjs/tree/…/examples](https://github.com/langchain-ai/deepagentsjs/tree/bb1aaf0fb6d15c162c5c8c8e76e7fd2207b32b2b/libs/deepagents/examples)

## Related

- [[create-deep-agent]]
- [[subagent-interface]]
- [[backends]]
- [[deepagents-sandboxes]]
- [[deep-agents-overview]]

## Sources

- `raw/references/deepagents-reference.md` — README from the deepagentsjs repo; install instructions, all `createDeepAgent` parameters, class/function/interface/type surface, middleware list, FileData V1/V2 union definition, skills inheritance behaviour
