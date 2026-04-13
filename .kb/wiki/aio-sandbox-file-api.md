---
created: 2026-04-13
updated: 2026-04-13
tags: [aio-sandbox, filesystem, workspace]
sources: [raw/aio-sandbox/openapi.json]
---

# AIO Sandbox File API

The AIO Sandbox File API exposes 9 HTTP endpoints under `/v1/file/*` for reading, writing, editing, searching, listing, uploading, and downloading files inside the sandbox container. All JSON responses are wrapped in a standard `{ success, message, data }` envelope; the `download` endpoint is the sole exception, returning raw binary (`application/octet-stream`). Sub-agents in Nexus use this API through the [[agent-infra-sandbox-sdk]] TypeScript client — direct HTTP calls are rarely needed.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/v1/file/read` | Read file content, optionally a line range |
| POST | `/v1/file/write` | Write or append text / binary content (JSON body) |
| POST | `/v1/file/replace` | Replace a literal substring inside a file |
| POST | `/v1/file/search` | Grep a regex pattern inside a single file |
| POST | `/v1/file/find` | Find files by name glob inside a directory tree |
| POST | `/v1/file/upload` | Upload a file via multipart form-data |
| GET | `/v1/file/download` | Download a file as raw binary via query param |
| POST | `/v1/file/list` | List directory contents with rich filtering/sorting |
| POST | `/v1/file/str_replace_editor` | Multi-command editor (view / create / str_replace / insert / undo_edit) |

---

### POST `/v1/file/read`

Reads a file and returns its content as a string. Supports optional line range slicing.

**Request body — `FileReadRequest`**

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `file` | `string` | yes | — | Absolute file path |
| `start_line` | `integer \| null` | no | null | 0-based inclusive start line |
| `end_line` | `integer \| null` | no | null | 0-based exclusive end line |
| `sudo` | `boolean \| null` | no | `false` | Read with elevated privileges |

> **Note — `start_line` / `end_line` indexing:** Lines are 0-based and `end_line` is exclusive (similar to Python slice semantics). To read only line 0, send `{ start_line: 0, end_line: 1 }`. Not providing either reads the whole file.

**Response — `Response_FileReadResult_`**

```typescript
{
  success: boolean;          // true on success
  message: string | null;    // "Operation successful"
  data: {
    file: string;            // path of the read file
    content: string;         // full or sliced file content
  } | null;
}
```

---

### POST `/v1/file/write`

Writes content to a file. Supports text and binary (base64) modes, append mode, and auto-added newlines. Overwrites by default. Creates parent directories if they do not exist (sandbox behaviour).

> **Note — `write` vs `upload`:** Use `write` from agent code — it accepts a JSON body with `content` as a string. The `upload` endpoint uses `multipart/form-data` and is suited to human/client transfers of actual file bytes. Agents constructing file content programmatically should always prefer `write`.

**Request body — `FileWriteRequest`**

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `file` | `string` | yes | — | Absolute file path |
| `content` | `string` | yes | — | Text string, or base64-encoded bytes when `encoding: "base64"` |
| `encoding` | `FileContentEncoding \| null` | no | `"utf-8"` | `"utf-8"` / `"base64"` / `"raw"` |
| `append` | `boolean \| null` | no | `false` | Append instead of overwrite |
| `leading_newline` | `boolean \| null` | no | `false` | Prepend `\n` (text mode only) |
| `trailing_newline` | `boolean \| null` | no | `false` | Append `\n` (text mode only) |
| `sudo` | `boolean \| null` | no | `false` | Write with elevated privileges |

> **Note — `trailing_newline` default is `false`:** Files written without `trailing_newline: true` will not end with a newline. This can break POSIX tools that expect a final newline. Set it explicitly when writing source code or config files.

**Response — `Response_FileWriteResult_`**

```typescript
{
  success: boolean;
  message: string | null;
  data: {
    file: string;                // path written
    bytes_written: integer | null;
  } | null;
}
```

---

### POST `/v1/file/replace`

Replaces the first (or all, depending on implementation) occurrence of a literal string inside a file. Simpler than `str_replace_editor` for single targeted substitutions.

**Request body — `FileReplaceRequest`**

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `file` | `string` | yes | — | Absolute file path |
| `old_str` | `string` | yes | — | Literal string to find and replace |
| `new_str` | `string` | yes | — | Replacement string |
| `sudo` | `boolean \| null` | no | `false` | — |

**Response — `Response_FileReplaceResult_`**

```typescript
{
  success: boolean;
  message: string | null;
  data: {
    file: string;
    replaced_count: integer;    // number of replacements made (default 0)
  } | null;
}
```

---

### POST `/v1/file/search`

Searches for a regex pattern inside a **single file**, returning matching lines and their line numbers. This is a grep-within-one-file operation.

> **Note — `search` vs `find`:** These two endpoints are easy to confuse. `/v1/file/search` greps **inside file content** (regex). `/v1/file/find` locates **files by name** using a glob pattern. Using the wrong one silently returns no results.

**Request body — `FileSearchRequest`**

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `file` | `string` | yes | — | Absolute path to the file to search |
| `regex` | `string` | yes | — | Regular expression pattern |
| `sudo` | `boolean \| null` | no | `false` | — |

**Response — `Response_FileSearchResult_`**

```typescript
{
  success: boolean;
  message: string | null;
  data: {
    file: string;
    matches: string[];        // matched line content (default [])
    line_numbers: integer[];  // corresponding line numbers (default [])
  } | null;
}
```

---

### POST `/v1/file/find`

Finds files within a directory tree by **filename glob pattern**. Does not inspect file content. Analogous to `find /path -name "*.py"`.

> **Note — `find` vs `search`:** `/v1/file/find` matches file **names** (glob). `/v1/file/search` matches file **content** (regex). See the warning under `search` above.

**Request body — `FileFindRequest`**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `path` | `string` | yes | Root directory to search from |
| `glob` | `string` | yes | Glob pattern against filenames, e.g. `"*.ts"` |

**Response — `Response_FileFindResult_`**

```typescript
{
  success: boolean;
  message: string | null;
  data: {
    path: string;       // search root echoed back
    files: string[];    // absolute paths of matching files (default [])
  } | null;
}
```

---

### POST `/v1/file/upload`

Uploads a file via `multipart/form-data`. Intended for human clients or browser-based tooling — agent code should use `write` instead.

**Request body — `Body_upload_file`** (multipart/form-data)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `file` | binary | yes | File bytes |
| `path` | `string` | no | Destination path in sandbox; if omitted the server chooses a location |

**Response — `Response_FileUploadResult_`**

```typescript
{
  success: boolean;
  message: string | null;
  data: {
    file_path: string;   // sandbox path where file was stored
    file_size: integer;  // bytes
    success: boolean;    // redundant with envelope but present
  } | null;
}
```

---

### GET `/v1/file/download`

Downloads a file as raw binary. The path is passed as a **query parameter**, not a request body. Response `Content-Type` is `application/octet-stream`.

**Query parameter**

| Name | Type | Required |
|------|------|----------|
| `path` | `string` | yes |

**Response:** raw binary — no envelope wrapper.

> **Note — path traversal:** The `path` field is a freeform string. The sandbox typically restricts writes to `/home/gem/` but there is no validated sanitization visible in the schema. Avoid constructing download paths from untrusted external input.

---

### POST `/v1/file/list`

Lists directory contents with filtering, sorting, and recursion options. Returns `FileInfo` objects with metadata.

**Request body — `FileListRequest`**

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `path` | `string` | yes | — | Directory to list |
| `recursive` | `boolean \| null` | no | `false` | Recurse into subdirectories |
| `show_hidden` | `boolean \| null` | no | `true` | Include dot files |
| `file_types` | `string[] \| null` | no | null | Filter to extensions, e.g. `[".py", ".ts"]` |
| `max_depth` | `integer \| null` | no | null | Cap recursion depth |
| `include_size` | `boolean \| null` | no | `true` | Include file sizes |
| `include_permissions` | `boolean \| null` | no | `false` | Include Unix permissions string |
| `sort_by` | `string \| null` | no | `"name"` | One of: `name`, `size`, `modified`, `type` |
| `sort_desc` | `boolean \| null` | no | `false` | Reverse sort order |

> **Note — `show_hidden` defaults to `true`:** Unlike most `ls` implementations, hidden files are included by default. Pass `show_hidden: false` explicitly if you want to omit dotfiles from the result.

**Response — `Response_FileListResult_`**

```typescript
{
  success: boolean;
  message: string | null;
  data: {
    path: string;
    files: FileInfo[];       // see FileInfo schema below
    total_count: integer;
    directory_count: integer;
    file_count: integer;
  } | null;
}
```

---

### POST `/v1/file/str_replace_editor`

A multi-command filesystem editor modelled after Anthropic's `str_replace_based_edit_tool` / OpenHands ACI. Unlike the simpler `/v1/file/replace`, this is a stateful editor that supports view, create, targeted replacement, line insertion, and undo.

> **Note — not a simple replace endpoint:** The name suggests a string-replace operation, but `str_replace_editor` is a multi-mode editor tool. It can view files with line numbers, create new files, perform context-anchored replacements, insert text after a specific line, and undo the last edit. Tool parameters are defined by Anthropic and are not configurable.

**Request body — `StrReplaceEditorRequest`**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `command` | `enum` | yes | One of: `view`, `create`, `str_replace`, `insert`, `undo_edit` |
| `path` | `string` | yes | Absolute path to file or directory |
| `file_text` | `string \| null` | no | Content for `create` command |
| `old_str` | `string \| null` | no | String to replace (required for `str_replace`) |
| `new_str` | `string \| null` | no | Replacement / insertion string |
| `insert_line` | `integer \| null` | no | Line number after which to insert `new_str` (required for `insert`) |
| `view_range` | `integer[] \| null` | no | `[start, end]` line range for `view`; `[start, -1]` to read to EOF; 1-based |

**Command semantics:**

| Command | Required fields (beyond `command`, `path`) | Effect |
|---------|-------------------------------------------|--------|
| `view` | — (optionally `view_range`) | Returns file content with line numbers, or directory listing |
| `create` | `file_text` | Creates a new file with given content |
| `str_replace` | `old_str` (+ optional `new_str`) | Replaces unique occurrence of `old_str`; omit `new_str` to delete |
| `insert` | `insert_line`, `new_str` | Inserts text after line `insert_line` |
| `undo_edit` | — | Reverts the last edit to the file |

> **Note — `str_replace` requires a unique match:** The `str_replace` command will fail (or behave unexpectedly) if `old_str` appears more than once in the file. Provide enough surrounding context to make the match unique — similar to the constraint in Anthropic's Claude tool.

**Response — `Response_StrReplaceEditorResult_`**

```typescript
{
  success: boolean;
  message: string | null;
  data: {
    output: string;              // command output text (file content, directory listing, etc.)
    error: string | null;        // error message if operation failed
    path: string;                // operated file path
    prev_exist: boolean;         // whether the file existed before the operation
    old_content: string | null;  // file content before edit (for diff/audit)
    new_content: string | null;  // file content after edit
  } | null;
}
```

---

## Schemas

### `FileContentEncoding`

Enum controlling how `content` in `FileWriteRequest` is interpreted.

```typescript
type FileContentEncoding = "utf-8" | "base64" | "raw";
```

- `"utf-8"` — default; content is a plain UTF-8 string written as-is
- `"base64"` — content is base64-encoded; the server decodes it before writing (use for binary files: images, ZIPs, PDFs)
- `"raw"` — content is written without encoding conversion

### `FileInfo`

Returned per-entry by `/v1/file/list`.

```typescript
interface FileInfo {
  name: string;                     // filename only
  path: string;                     // full absolute path
  is_directory: boolean;
  size: integer | null;             // bytes; null for directories
  modified_time: string | null;     // ISO 8601 timestamp
  permissions: string | null;       // Unix permissions string, e.g. "rwxr-xr-x"
  extension: string | null;         // file extension, e.g. ".ts"
}
```

### `FileReadResult`

```typescript
interface FileReadResult {
  file: string;     // path echoed back
  content: string;  // file content (or slice if start_line/end_line given)
}
```

### `FileWriteResult`

```typescript
interface FileWriteResult {
  file: string;
  bytes_written: integer | null;
}
```

### `FileReplaceResult`

```typescript
interface FileReplaceResult {
  file: string;
  replaced_count: integer;  // 0 if old_str not found
}
```

### `FileSearchResult`

```typescript
interface FileSearchResult {
  file: string;
  matches: string[];        // lines matching the regex
  line_numbers: integer[];  // corresponding line numbers
}
```

### `FileFindResult`

```typescript
interface FileFindResult {
  path: string;    // search root
  files: string[]; // absolute paths of matching files
}
```

### `FileListResult`

```typescript
interface FileListResult {
  path: string;
  files: FileInfo[];
  total_count: integer;
  directory_count: integer;
  file_count: integer;
}
```

### `FileUploadResult`

```typescript
interface FileUploadResult {
  file_path: string;
  file_size: integer;
  success: boolean;
}
```

### `StrReplaceEditorRequest` / `StrReplaceEditorResult`

See the `str_replace_editor` endpoint section above for the full field tables. The result includes `old_content` and `new_content` so callers can diff before/after without a second read.

### Response envelope

All JSON endpoints return responses in the same envelope shape:

```typescript
interface Response<T> {
  success: boolean;       // true on success
  message: string | null; // human-readable status, e.g. "Operation successful"
  data: T | null;         // null on failure
}
```

Check `success` before accessing `data` — `data` can be null even with a 200 HTTP status if the operation failed internally.

---

## Use from Nexus

Sub-agents write their outputs under `/home/gem/workspace/{type}/task_{id}/` (e.g., `/home/gem/workspace/research/task_abc123/report.md`) using the `write` endpoint via the [[agent-infra-sandbox-sdk]] client — the JSON body approach is far more ergonomic than multipart upload for programmatically constructed content. The `str_replace_editor` endpoint is the Nexus equivalent of Anthropic's `str_replace_based_edit_tool` and is the preferred mechanism when the [[filesystem-middleware]] delegates file edits to the sandbox, since it handles undo and returns before/after content. When a code sub-agent needs to patch a specific function inside a larger file, `str_replace_editor` with `command: "str_replace"` is safer than a full overwrite via `write`.

---

## Related

- [[aio-sandbox-overview]]
- [[aio-sandbox-openapi-overview]]
- [[aio-sandbox-shell-api]]
- [[aio-sandbox-sandbox-context-api]]
- [[filesystem-middleware]]
- [[backends]]

---

## Sources

- `raw/aio-sandbox/openapi.json` — paths `/v1/file/*`; schemas: `FileReadRequest`, `FileReadResult`, `FileWriteRequest`, `FileWriteResult`, `FileReplaceRequest`, `FileReplaceResult`, `FileSearchRequest`, `FileSearchResult`, `FileFindRequest`, `FileFindResult`, `Body_upload_file`, `FileUploadResult`, `FileListRequest`, `FileListResult`, `FileInfo`, `FileContentEncoding`, `StrReplaceEditorRequest`, `StrReplaceEditorResult`, `Response_FileReadResult_`, `Response_FileWriteResult_`, `Response_FileReplaceResult_`, `Response_FileSearchResult_`, `Response_FileFindResult_`, `Response_FileUploadResult_`, `Response_FileListResult_`, `Response_StrReplaceEditorResult_`, `HTTPValidationError`, `ValidationError`
