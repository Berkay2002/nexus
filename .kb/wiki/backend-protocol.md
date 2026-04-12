---
created: 2026-04-12
updated: 2026-04-12
tags: [deepagents, backends, filesystem]
sources: [raw/langchain/deepagents/backends.md]
---

# Backend Protocol

The backend protocol is the interface a custom [[backends|DeepAgents backend]] must implement. All backends implement `BackendProtocolV2` (the current standard). The older `BackendProtocolV1` is automatically adapted via `adaptBackendProtocol()` at runtime — no manual migration is required to keep existing V1 backends working.

## Required methods (BackendProtocolV2)

| Method | Signature | Notes |
|---|---|---|
| `ls` | `ls(path: string) → LsResult` | List directory (non-recursive). Dirs have trailing `/` and `is_dir: true`. |
| `read` | `read(filePath, offset?, limit?) → ReadResult` | Text: paginated by line. Binary: full `Uint8Array` + `mimeType`. Missing file → `{ error: "File '/x' not found" }`. |
| `readRaw` | `readRaw(filePath) → ReadRawResult` | Raw `FileData` with timestamps. |
| `grep` | `grep(pattern, path?, glob?) → GrepResult` | Literal text search. Binary files (by MIME type) are skipped. Return `{ error }` on failure, do not throw. |
| `glob` | `glob(pattern, path?) → GlobResult` | Glob pattern match. Returns `FileInfo[]`. |
| `write` | `write(filePath, content) → WriteResult` | Create-only — return error on conflict. State backends set `filesUpdate`; external backends use `filesUpdate: null`. |
| `edit` | `edit(filePath, oldString, newString, replaceAll?) → EditResult` | `oldString` must be unique unless `replaceAll: true`. Return error if not found. Include `occurrences` on success. |

## Optional methods

- **`uploadFiles(files: Array<[string, Uint8Array]>) → FileUploadResponse[]`** — multi-file upload (sandbox backends)
- **`downloadFiles(paths: string[]) → FileDownloadResponse[]`** — multi-file download (sandbox backends)

## Result types

All query methods return structured result objects with an optional `error` field. On failure, set `error` and leave the data field undefined. Never throw.

| Type | Success fields | Error field |
|---|---|---|
| `ReadResult` | `content?: string \| Uint8Array`, `mimeType?: string` | `error` |
| `ReadRawResult` | `data?: FileData` | `error` |
| `LsResult` | `files?: FileInfo[]` | `error` |
| `GlobResult` | `files?: FileInfo[]` | `error` |
| `GrepResult` | `matches?: GrepMatch[]` | `error` |
| `WriteResult` | `path?: string` | `error` |
| `EditResult` | `path?: string`, `occurrences?: number` | `error` |

## Supporting types

- **`FileInfo`** — `path` (required), optionally `is_dir`, `size`, `modified_at`.
- **`GrepMatch`** — `path`, `line` (1-indexed), `text`.
- **`FileData`** — see [[backends#FileData format]].

## Sandbox extension

`SandboxBackendProtocolV2` extends `BackendProtocolV2` with:

- **`execute(command: string) → ExecuteResponse`** — run a shell command in the sandbox
- **`readonly id: string`** — unique sandbox instance identifier

## V1 → V2 migration

| V1 method | V2 method | Return type change |
|---|---|---|
| `lsInfo(path)` | `ls(path)` | `FileInfo[]` → `LsResult` |
| `read(...)` | `read(...)` | `string` → `ReadResult` |
| `readRaw(...)` | `readRaw(...)` | `FileData` → `ReadRawResult` |
| `grepRaw(...)` | `grep(...)` | `GrepMatch[] \| string` → `GrepResult` |
| `globInfo(...)` | `glob(...)` | `FileInfo[]` → `GlobResult` |

Use `adaptBackendProtocol(v1Backend)` or `adaptSandboxProtocol(v1Sandbox)` from `deepagents` when calling protocol methods directly on a V1 backend. The framework auto-adapts V1 backends passed to `createDeepAgent()`.

## Custom backend example (S3)

```typescript
import { type BackendProtocolV2, type LsResult, type ReadResult, /* ... */ } from "deepagents";

class S3Backend implements BackendProtocolV2 {
  constructor(private bucket: string, private prefix = "") {}

  async ls(path: string): Promise<LsResult> { /* list objects */ }
  async read(filePath: string, offset?: number, limit?: number): Promise<ReadResult> { /* fetch object */ }
  async readRaw(filePath: string): Promise<ReadRawResult> { /* return FileData */ }
  async grep(pattern: string, path?: string | null, glob?: string | null): Promise<GrepResult> { /* search */ }
  async glob(pattern: string, path = "/"): Promise<GlobResult> { /* apply glob */ }
  async write(filePath: string, content: string): Promise<WriteResult> { /* put object */ }
  async edit(filePath: string, oldString: string, newString: string, replaceAll?: boolean): Promise<EditResult> { /* read-modify-write */ }
}
```

Design guidelines:
- Paths are absolute (`/x/y.txt`). Map them to your storage keys/rows.
- Implement `ls` and `glob` with server-side filtering where possible.
- External backends should return `filesUpdate: null` (not a state update dict) in `write`/`edit` results.

## Related

- [[backends]]
- [[composite-backend]]
- [[store-backend]]
- [[deepagents-sandboxes]]

## Sources

- `raw/langchain/deepagents/backends.md` — protocol reference, V1→V2 migration guide, custom backend examples
