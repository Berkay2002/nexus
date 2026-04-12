---
created: 2026-04-12
updated: 2026-04-12
tags: [deepagents, frontend, sandbox, ide, visualization, use-stream]
sources: [raw/langchain/deepagents/frontend/sandbox.md]
---

# Sandbox IDE Pattern

An IDE-like frontend pattern for visualizing a coding agent's sandbox filesystem in real time. Combines [[deepagents-sandboxes]] with a custom API server and a three-panel browser UI showing a file tree, code/diff viewer, and chat panel — updating live as the agent writes files.

## Architecture

Three layers cooperate:

1. **Deep agent with sandbox backend** — `createDeepAgent()` receives a sandbox backend and automatically gets filesystem tools (`read_file`, `write_file`, `edit_file`, `ls`, `glob`, `grep`, `execute`).
2. **Custom API server** — a [Hono](https://hono.dev) app registered in `langgraph.json`'s `http.app` field, exposing file-browsing endpoints (`GET /api/sandbox/:threadId/tree`, `GET /api/sandbox/:threadId/file`). Runs alongside the LangGraph server at the same host/port.
3. **IDE frontend** — a three-panel layout using [[use-stream-hook]] for the agent conversation and fetch calls to the API server for file browsing.

```
IDE Frontend  --useStream()-->           createDeepAgent()
IDE Frontend  --/api/sandbox/:threadId/*-->  API Server (Hono)
createDeepAgent()  --read/write/execute-->  Sandbox
API Server  --ls / read-->               Sandbox
```

## Sandbox Lifecycle Scoping

Four scoping strategies — the chosen strategy determines how long a sandbox lives and how many threads share it.

### Thread-scoped (recommended)
Each LangGraph thread owns exactly one sandbox. The sandbox ID is stored in thread metadata and resolved at runtime via `getConfig()`. Conversations are isolated, state persists across page reloads, and cleanup is simple: delete the thread, delete its sandbox.

### Agent-scoped
All threads under the same assistant share one sandbox. Useful for persistent project environments where file changes should carry across conversations.

```ts
import { getConfig } from "@langchain/langgraph";

function getSandboxBackendForAssistant() {
  const config = getConfig();
  const assistantId = config.metadata?.assistant_id;
  return getOrCreateSandboxForAssistant(assistantId);
}
```

### User-scoped
Each user gets their own sandbox across all threads. Requires custom auth and user identification via `config.configurable?.user_id`.

### Session-scoped (client-side)
The frontend generates a session ID and passes it directly. Does not persist across browser sessions. Best for demos or prototyping.

## Setting Up the Agent

### Choosing a sandbox provider
Any provider implementing `SandboxBackendProtocol` works. `LangSmithSandbox` is the canonical example:

```ts
import { createDeepAgent, LangSmithSandbox } from "deepagents";

const sandbox = new LangSmithSandbox({
  resolve: async () => {
    const config = getConfig();
    const threadId = config.configurable?.thread_id;
    return getOrCreateSandboxForThread(threadId);
  },
});

export const agent = createDeepAgent({
  model: "anthropic:claude-sonnet-4-5",
  backend: sandbox,
  systemPrompt: "You are an expert developer working on a project in /app.",
});
```

Key pattern: do **not** create the sandbox at module level (shared across threads and subject to expiry). Instead, pass a `resolve` function that reads `thread_id` from config and calls `getOrCreateSandboxForThread`.

### Per-thread resolution
`getOrCreateSandboxForThread` reads `metadata.sandbox_id` from the LangGraph thread. If found, reconnects; otherwise creates a new sandbox and stores the ID in thread metadata. The sandbox ID in thread metadata is the single source of truth — no in-memory cache needed.

### Seeding the sandbox
Upload starter files before the agent runs:

```ts
const encoder = new TextEncoder();
await sandbox.uploadFiles(
  Object.entries(SEED_FILES).map(([path, content]) => [`/app/${path}`, encoder.encode(content)]),
);
// Then install dependencies:
await sandbox.execute("cd /app && npm install");
```

For LangSmith sandboxes, the container image and resource limits come from a sandbox template (pass `templateName` to `LangSmithSandbox.create()`). `uploadFiles` seeds project files on top of that image at runtime.

## Custom API Server

The Hono API server exposes two endpoints. Both resolve the sandbox via the same `getOrCreateSandboxForThread` function as the agent — same thread ID → same sandbox:

- `GET /api/sandbox/:threadId/tree?filePath=/app` — runs `find` in the sandbox and returns `{ path, entries: [{name, type, path, size}], sandboxId }`.
- `GET /api/sandbox/:threadId/file?filePath=<path>` — downloads a single file via `sandbox.downloadFiles()` and returns `{ path, content }`.

Register the Hono app in `langgraph.json`:

```json
{
  "graphs": { "coding_agent": "./src/agents/my-agent.ts:agent" },
  "http": { "app": "./src/api/app.ts:app" }
}
```

Custom routes coexist with default LangGraph routes at `http://localhost:2024`. Be careful not to shadow routes like `/threads` or `/runs`.

## Real-Time File Sync

The core of the IDE experience: update files **as the agent works**, not after it finishes. Watch `stream.messages` for `ToolMessage` completions on file-mutating tools:

```ts
const FILE_MUTATING_TOOLS = new Set(["write_file", "edit_file", "execute"]);

useEffect(() => {
  // Build map of file-mutating tool calls from AIMessages
  const toolCallMap = new Map();
  for (const msg of stream.messages) {
    if (!AIMessage.isInstance(msg)) continue;
    for (const tc of msg.tool_calls ?? []) {
      if (tc.id && FILE_MUTATING_TOOLS.has(tc.name)) {
        toolCallMap.set(tc.id, { name: tc.name, args: tc.args });
      }
    }
  }

  // Refresh when ToolMessage appears for a file-mutating call
  for (const msg of stream.messages) {
    if (!ToolMessage.isInstance(msg)) continue;
    const id = msg.id ?? msg.tool_call_id;
    if (!id || processedIds.current.has(id)) continue;
    const call = toolCallMap.get(msg.tool_call_id);
    if (!call) continue;
    processedIds.current.add(id);

    if (call.name === "write_file" || call.name === "edit_file") {
      refreshSingleFile(call.args.path);
    } else if (call.name === "execute") {
      refreshAllFiles(); // shell command may touch any file
    }
  }
}, [stream.messages]);
```

Use a `processedIds` ref to avoid processing the same tool completion twice. Track a `before` snapshot of all files at run start, then compare `current` vs `original` after each refresh to compute the changed-files set.

## Diff Viewing

When the user selects a file modified by the agent, default to the diff view. Recommended libraries by framework:

| Framework | Library | Component |
|-----------|---------|-----------|
| React | `@pierre/diffs` | `<FileDiff>` + `parseDiffFromFile` |
| Vue/Svelte | `@git-diff-view/vue` or `/svelte` | `<DiffView>` + `generateDiffFile` |
| Angular | `ngx-diff` | `<ngx-unified-diff>` |

Show a changed-files summary with per-file addition/deletion line counts (similar to `git status`). Amber dots in the file tree indicate modified files.

## Best Practices

- **Thread-scoped sandboxes in production.** Store sandbox ID in thread metadata; resolve via `getConfig()` at runtime.
- **Share `getOrCreateSandboxForThread`** between agent backend and API server — single source of truth.
- **Persist `threadId` in `sessionStorage`** so page reloads reconnect to the same sandbox.
- **Sync on every relevant tool call**, not just run completion. Watch `write_file`, `edit_file`, `execute`.
- **Default to diff view** for changed files.
- **Show compact tool results** for read-only operations (e.g., `Read router.js L1-42`).
- **Seed with a real project** — an empty sandbox is disorienting for agents and users.
- **Filter `node_modules`** from the file tree.

## Related

- [[frontend-sandbox-components]]
- [[deepagents-sandboxes]]
- [[use-stream-hook]]
- [[deepagents-frontend-overview]]
- [[aio-sandbox-overview]]

## Sources

- `raw/langchain/deepagents/frontend/sandbox.md` — full sandbox IDE pattern: architecture, lifecycle scoping, agent setup, API server, frontend wiring, real-time sync, diff viewing, best practices
