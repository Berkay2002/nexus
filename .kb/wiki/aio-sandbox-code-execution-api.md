---
created: 2026-04-13
updated: 2026-04-13
tags: [aio-sandbox, code, execution, nodejs]
sources: [raw/aio-sandbox/openapi.json]
---

# AIO Sandbox Code Execution API

The AIO Sandbox exposes two stateless code execution surfaces: `/v1/code/execute` for language-agnostic one-shot execution (currently Python and JavaScript), and `/v1/nodejs/execute` for a Node.js-specific execution path with richer input options. Both surfaces are deliberately **stateless** — each request spins up a fresh environment that is discarded immediately after the call completes. For stateful, multi-cell Python execution where intermediate values persist between requests, use the [[aio-sandbox-jupyter-api]] instead.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/v1/code/execute` | Execute code in a specified language (Python or JavaScript) |
| `GET` | `/v1/code/info` | List supported languages and per-language runtime metadata |
| `POST` | `/v1/nodejs/execute` | Execute JavaScript code via the Node.js-specific executor |
| `GET` | `/v1/nodejs/info` | Return Node.js and npm version info and runtime directory |

## /v1/code/execute (generic)

Runs code through the unified runtime dispatcher. The language is determined by the `language` field on the request.

**Request — `CodeExecuteRequest`**

| Field | Type | Required | Notes |
|---|---|---|---|
| `language` | `Language` enum | Yes | Target runtime. See Language enum below. |
| `code` | `string` | Yes | Source code to execute. |
| `timeout` | `integer \| null` | No | Seconds. Range: 1–300. Defaults to the per-language default (30 s for both current runtimes). |

**Language enum — valid values**

| Value | Runtime |
|---|---|
| `"python"` | Python interpreter |
| `"javascript"` | Node.js (dispatched to the Node.js executor internally) |

> **Note — Language enum is currently two values:** At the time of writing, the `Language` enum contains only `"python"` and `"javascript"`. The endpoint description mentions "future language executors", so this list may expand. Always call `/v1/code/info` at runtime to get the authoritative list with version details.

**Response — `CodeExecuteResponse`**

Returned inside the standard envelope as `data`.

| Field | Type | Required | Notes |
|---|---|---|---|
| `language` | `Language` | Yes | Echo of the language used. |
| `status` | `string` | Yes | Execution status indicator (e.g. `ok`, `error`, `timeout`). |
| `code` | `string` | Yes | Echo of the submitted code. |
| `outputs` | `object[]` | No | Structured execution output blocks. Array of free-form objects; contents are language-dependent. |
| `stdout` | `string \| null` | No | Captured standard output. |
| `stderr` | `string \| null` | No | Captured standard error. |
| `exit_code` | `integer \| null` | No | Process exit code when applicable. |

> **Note — Stateless execution:** No state persists between `/v1/code/execute` calls. Variables, imports, and file writes inside the execution environment are discarded after each request. If you need to build up state iteratively (e.g., define a dataframe then query it), use [[aio-sandbox-jupyter-api]] which maintains a kernel session.

## /v1/code/info

Returns metadata about every supported code runtime. No request body. Response is `CodeInfoResponse` inside the standard envelope.

**`CodeInfoResponse`**

| Field | Type | Notes |
|---|---|---|
| `languages` | `CodeLanguageInfo[]` | One entry per supported language. |

**`CodeLanguageInfo`**

| Field | Type | Notes |
|---|---|---|
| `language` | `Language` | Identifier (matches the `Language` enum). |
| `description` | `string` | Human-readable runtime description. |
| `runtime_version` | `string \| null` | Primary version string (e.g. `"3.11.2"`). |
| `default_timeout` | `integer` | Default timeout in seconds (default: 30). |
| `max_timeout` | `integer` | Maximum allowed timeout in seconds (default: 300). |
| `details` | `object` | Additional runtime-specific metadata (free-form). |

## /v1/nodejs/execute

Executes JavaScript code using Node.js directly. Functionally equivalent to posting `language: "javascript"` to `/v1/code/execute`, but exposes additional input options: `stdin` and file injection. Each request creates a fresh execution environment that is cleaned up automatically.

**Request — `NodeJSExecuteRequest`**

| Field | Type | Required | Notes |
|---|---|---|---|
| `code` | `string` | Yes | JavaScript source code to execute. |
| `timeout` | `integer \| null` | No | Seconds. Range: 1–300. Default: 30. |
| `stdin` | `string \| null` | No | Standard input piped to the process. |
| `files` | `Record<string, string> \| null` | No | Additional files to create in the execution directory before running. Keys are filenames; values are file contents. |

> **Note — File injection is Node-specific:** The `files` field on `NodeJSExecuteRequest` allows you to seed the execution directory with helper modules or data files before the script runs. This feature is not present on the generic `CodeExecuteRequest`. If your JavaScript code does `require('./utils')`, inject the file as `{ "utils.js": "..." }`.

**Response — `NodeJSExecuteResponse`**

| Field | Type | Required | Notes |
|---|---|---|---|
| `language` | `string` | Yes | Always `"javascript"`. |
| `status` | `string` | Yes | `ok`, `error`, or `timeout`. |
| `code` | `string` | Yes | Echo of submitted code. |
| `exit_code` | `integer` | Yes | Process exit code. `0` = success. |
| `execution_count` | `integer \| null` | No | Execution counter (nullable). |
| `outputs` | `NodeJSOutput[]` | No | Structured output blocks. Default: `[]`. |
| `stdout` | `string` | No | Captured standard output. Default: `""`. |
| `stderr` | `string` | No | Captured standard error. Default: `""`. |

**`NodeJSOutput` — structured output block**

Each entry in the `outputs` array is typed by `output_type`:

| `output_type` | Relevant fields | Notes |
|---|---|---|
| `"stream"` | `name` (stdout/stderr), `text` | A chunk of streamed output. |
| `"error"` | `ename`, `evalue`, `traceback` | An uncaught exception. `traceback` is `string[]`. |
| `"execute_result"` | `data`, `metadata` | A structured return value (free-form object). |

> **Note — stdout/stderr vs outputs:** The top-level `stdout` and `stderr` strings on `NodeJSExecuteResponse` are the aggregated, full-text captures. The `outputs` array provides the same content as typed, structured blocks. For most use cases, reading `stdout`/`stderr` directly is sufficient. The `outputs` array is useful when you need to distinguish between stdout stream content and structured return values.

## /v1/nodejs/info

Returns runtime metadata for the Node.js executor. No request body. Response is `NodeJSRuntimeInfo` inside the standard envelope.

**`NodeJSRuntimeInfo`**

| Field | Type | Required | Notes |
|---|---|---|---|
| `node_version` | `string` | Yes | Node.js version (e.g. `"20.11.0"`). |
| `npm_version` | `string` | Yes | npm version. |
| `supported_languages` | `string[]` | Yes | Languages this executor handles (currently `["javascript"]`). |
| `description` | `string` | Yes | Service description. |
| `runtime_directory` | `string \| null` | No | Filesystem path to the runtime working directory. |
| `error` | `string \| null` | No | Set if runtime info retrieval failed. |

## When to use which

| Need | Use |
|---|---|
| One-shot Python script | `/v1/code/execute` with `language: "python"` |
| One-shot JavaScript (simple) | `/v1/code/execute` with `language: "javascript"` |
| One-shot Node.js with file injection or stdin | `/v1/nodejs/execute` |
| Stateful Python session (iterate over data) | [[aio-sandbox-jupyter-api]] `/v1/jupyter/execute` |
| Bash one-liner | [[aio-sandbox-shell-api]] `/v1/shell/exec` |
| Long-running process (build, server) | [[aio-sandbox-shell-api]] `/v1/shell/exec` + `/v1/shell/wait` |
| Discover available runtimes | `/v1/code/info` or `/v1/nodejs/info` |

## All responses are wrapped in a standard envelope

All four endpoints return a shared envelope schema:

```typescript
interface ApiResponse<T> {
  success: boolean;     // default true
  message: string | null; // default "Operation successful"
  data: T | null;
}
```

Always read from `.data` on a successful response.

## Schemas

TypeScript sketches for all schemas in this surface.

```typescript
// Language enum — all currently valid values
type Language = "python" | "javascript";

// POST /v1/code/execute
interface CodeExecuteRequest {
  language: Language;       // required
  code: string;             // required
  timeout?: number | null;  // 1–300 seconds; null = use default
}

// Response data for POST /v1/code/execute
interface CodeExecuteResponse {
  language: Language;           // required
  status: string;               // required — e.g. "ok", "error", "timeout"
  code: string;                 // required — echo of submitted code
  outputs?: Record<string, unknown>[]; // structured output blocks
  stdout?: string | null;
  stderr?: string | null;
  exit_code?: number | null;
}

// GET /v1/code/info
interface CodeInfoResponse {
  languages: CodeLanguageInfo[]; // required
}

interface CodeLanguageInfo {
  language: Language;            // required
  description: string;           // required
  runtime_version?: string | null;
  default_timeout?: number;      // default: 30
  max_timeout?: number;          // default: 300
  details?: Record<string, unknown>;
}

// POST /v1/nodejs/execute
interface NodeJSExecuteRequest {
  code: string;                             // required
  timeout?: number | null;                  // 1–300; default: 30
  stdin?: string | null;
  files?: Record<string, string> | null;    // filename → content
}

// Response data for POST /v1/nodejs/execute
interface NodeJSExecuteResponse {
  language: string;             // required — always "javascript"
  status: string;               // required — "ok" | "error" | "timeout"
  code: string;                 // required — echo of submitted code
  exit_code: number;            // required
  execution_count?: number | null;
  outputs?: NodeJSOutput[];     // default: []
  stdout?: string;              // default: ""
  stderr?: string;              // default: ""
}

interface NodeJSOutput {
  output_type: "stream" | "error" | "execute_result"; // required
  // stream fields
  name?: string | null;         // "stdout" | "stderr"
  text?: string | null;
  // error fields
  ename?: string | null;
  evalue?: string | null;
  traceback?: string[] | null;
  // execute_result fields
  data?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

// GET /v1/nodejs/info
interface NodeJSRuntimeInfo {
  node_version: string;         // required
  npm_version: string;          // required
  supported_languages: string[]; // required
  description: string;          // required
  runtime_directory?: string | null;
  error?: string | null;
}
```

## Use from Nexus

The [[aio-sandbox-deepagents-integration]] code sub-agent reaches for `/v1/code/execute` when it needs a clean, isolated script run — for example, running a generated snippet to verify output before writing it to the workspace. `/v1/nodejs/execute` is the better choice when the script requires helper modules, because the `files` field allows the agent to inject them in a single request without a separate filesystem write step. For iterative Python data analysis where cell state must accumulate (loading a CSV once, then querying it repeatedly), the [[aio-sandbox-jupyter-api]] is the correct surface. Build commands and shell pipelines go through the [[aio-sandbox-shell-api]]. The [[agent-infra-sandbox-sdk]] TypeScript client wraps all three surfaces with typed methods.

## Related

- [[aio-sandbox-overview]]
- [[aio-sandbox-jupyter-api]]
- [[aio-sandbox-shell-api]]
- [[aio-sandbox-deepagents-integration]]
- [[agent-infra-sandbox-sdk]]

## Sources

- `raw/aio-sandbox/openapi.json` — paths `/v1/code/execute`, `/v1/code/info`, `/v1/nodejs/execute`, `/v1/nodejs/info`; schemas: `CodeExecuteRequest`, `CodeExecuteResponse`, `CodeInfoResponse`, `CodeLanguageInfo`, `Language`, `NodeJSExecuteRequest`, `NodeJSExecuteResponse`, `NodeJSOutput`, `NodeJSRuntimeInfo`, `Response_CodeExecuteResponse_`, `Response_CodeInfoResponse_`, `Response_NodeJSExecuteResponse_`, `Response_NodeJSRuntimeInfo_`
