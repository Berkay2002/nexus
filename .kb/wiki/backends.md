---
created: 2026-04-12
updated: 2026-04-12
tags: [deepagents, backends, filesystem]
sources: [raw/langchain/deepagents/backends.md]
---

# DeepAgents Backends

A backend is the pluggable storage layer that powers the filesystem tools a [[deep-agents-overview|DeepAgent]] exposes to the LLM: `ls`, `read_file`, `write_file`, `edit_file`, `glob`, and `grep`. Every `createDeepAgent()` call must have exactly one backend (or a [[composite-backend|CompositeBackend]] that routes to many).

## What a backend does

When the agent calls `write_file("/workspace/plan.md", "...")`, the filesystem middleware delegates that operation to the configured backend. The backend decides where the bytes go — in LangGraph state, on local disk, in a durable store, or inside a sandbox container. From the agent's perspective the filesystem looks the same regardless of which backend is underneath.

All backends implement `BackendProtocolV2` (or the older V1, which is auto-adapted). See [[backend-protocol]] for the full method surface.

## Available backends

| Backend | Persistence | Shell access | Notes |
|---|---|---|---|
| [[state-backend]] | Ephemeral (single thread) | No | Default |
| [[filesystem-backend]] | Local disk | No | Requires `root_dir` |
| [[store-backend]] | Durable across threads | No | LangGraph `BaseStore` |
| [[deepagents-sandboxes]] | Container-scoped | Yes | AIO Sandbox, Modal, Daytona, Deno |
| [[local-shell-backend]] | Local disk | Yes | Dev only — no isolation |
| [[composite-backend]] | Depends on route config | Depends | Routes paths to different backends |

## Binary and multimodal files

V2 backends support binary files natively. `read()` returns a `ReadResult` with `Uint8Array` content and `mimeType` for images, audio, video, and PDFs. Text files return `string` content. The `mimeType` is inferred from the file extension.

## FileData format

Files stored in state or store backends use the `FileData` type:

```typescript
type FileData =
  | { content: string | Uint8Array; mimeType: string; created_at: string; modified_at: string } // v2
  | { content: string[]; created_at: string; modified_at: string }; // v1 (legacy line array)
```

Both formats are handled transparently by the framework. New writes default to v2. Pass `fileFormat: "v1"` to the backend constructor during rolling deployments that need the legacy format.

## Choosing a backend

- **Scratch work within a session** → [[state-backend]] (default)
- **Persist files across threads** (memories, skills, user data) → [[store-backend]]
- **Access local machine files** → [[filesystem-backend]]
- **Run shell commands in isolation** → sandbox backend (see [[deepagents-sandboxes]])
- **Mix ephemeral + durable + sandbox** → [[composite-backend]]

## Related

- [[composite-backend]]
- [[store-backend]]
- [[backend-protocol]]
- [[state-backend]]
- [[deepagents-sandboxes]]

## Sources

- `raw/langchain/deepagents/backends.md` — full backend reference and quickstart table
