---
created: 2026-04-13
updated: 2026-04-13
tags: [aio-sandbox, shell, workspace]
sources: [raw/aio-sandbox/openapi.json]
---

# AIO Sandbox Shell API

The AIO Sandbox Shell API (`/v1/shell/*`) exposes a persistent, session-based shell environment running inside the sandbox container. Each session behaves like a named tmux pane — it retains working directory, environment state, and buffered terminal output between calls. Sub-agents in Nexus use this API to run build commands, scripts, and filesystem operations in an isolated Linux environment whose home directory is `/home/gem/`.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/v1/shell/sessions/create` | Create a named shell session (idempotent) |
| GET | `/v1/shell/sessions` | List all active sessions with metadata |
| DELETE | `/v1/shell/sessions` | Tear down all active sessions |
| DELETE | `/v1/shell/sessions/{session_id}` | Tear down one specific session |
| GET | `/v1/shell/terminal-url` | Get a browser-accessible terminal URL |
| POST | `/v1/shell/exec` | Execute a command in a session (sync or async; SSE-capable) |
| POST | `/v1/shell/view` | Read buffered terminal output of a session (SSE-capable) |
| POST | `/v1/shell/wait` | Block until the current process in a session finishes |
| POST | `/v1/shell/write` | Write stdin input to the running process |
| POST | `/v1/shell/kill` | Terminate the running process in a session |

## Response Envelope

All endpoints return a `Response<T>` envelope:

```typescript
interface Response<T> {
  success: boolean;       // default: true
  message: string | null; // default: "Operation successful"
  data: T | null;
}
```

Every section below describes only the `data` payload type. A `success: false` response signals an error; check `message` for the reason.

## Session Lifecycle

The recommended lifecycle for running a command to completion:

```
1. POST /v1/shell/sessions/create  → get session_id
2. POST /v1/shell/exec             → dispatch command (async_mode: true for long jobs)
3. POST /v1/shell/wait             → block until process exits (or use view to poll)
4. POST /v1/shell/view             → inspect full buffered output
5. DELETE /v1/shell/sessions/{id}  → release the session when done
```

For interactive processes (e.g., a Python REPL or an `apt` prompt), use `/v1/shell/write` to send stdin between `exec` and `wait`.

> **Note — session auto-creation on exec:** If you omit the `id` field on `POST /v1/shell/exec`, a new session is created automatically and its ID appears in the response. This is convenient for one-shot commands but leaves an unnamed session that must be cleaned up separately. For multi-step workflows always create the session explicitly first.

> **Note — create is idempotent:** `POST /v1/shell/sessions/create` returns the existing session if the requested `id` already exists rather than erroring. This means agents can safely call create at startup without checking first.

---

## `POST /v1/shell/sessions/create`

Creates a new shell session (or returns the existing one if `id` already exists).

**Request — `ShellCreateSessionRequest`**

```typescript
interface ShellCreateSessionRequest {
  id?: string;        // desired session ID; auto-generated if omitted
  exec_dir?: string;  // initial working directory; must be absolute path
}
```

**Response data — `ShellCreateSessionResponse`**

```typescript
interface ShellCreateSessionResponse {
  session_id: string;  // ID of the created (or existing) session
  working_dir: string; // active working directory for the session
}
```

**Example**

```json
// Request
{ "id": "research-task-42", "exec_dir": "/home/gem/workspace/research/task_42" }

// Response data
{ "session_id": "research-task-42", "working_dir": "/home/gem/workspace/research/task_42" }
```

---

## `GET /v1/shell/sessions`

Lists all currently active sessions. No request body.

**Response data — `ActiveShellSessionsResult`**

```typescript
interface ActiveShellSessionsResult {
  sessions: Record<string, ShellSessionInfo>;
  // key = session_id, value = session metadata
}

interface ShellSessionInfo {
  working_dir: string;       // current working directory
  created_at: string;        // ISO timestamp
  last_used_at: string;      // ISO timestamp
  age_seconds: number;       // seconds since creation
  status: string;            // e.g., "idle", "running"
  current_command?: string;  // command currently executing, if any
}
```

---

## `DELETE /v1/shell/sessions`

Destroys all active sessions. No request body. Returns the base `Response` envelope with `data: null`.

---

## `DELETE /v1/shell/sessions/{session_id}`

Destroys a single session identified by the path parameter `session_id`. Returns the base `Response` envelope with `data: null`.

---

## `GET /v1/shell/terminal-url`

Returns a URL string (in `data`) pointing to a browser-accessible terminal UI for the sandbox. Useful for debugging; not typically called by agents programmatically.

**Response data** — `string` (URL).

---

## `POST /v1/shell/exec`

Executes a shell command inside a session.

> **Note — SSE streaming mode:** If the client sends `Accept: text/event-stream`, this endpoint switches from returning a single JSON response to emitting a Server-Sent Events stream. Each SSE event carries a partial `ShellCommandResult` payload so the caller can observe output as it is produced. The `Content-Type` of the request body remains `application/json` regardless — only the `Accept` header changes the response mode. Most HTTP clients default to `Accept: */*` which is treated as JSON; you must opt in to SSE explicitly.

**Request — `ShellExecRequest`**

```typescript
interface ShellExecRequest {
  command: string;      // required — shell command to execute
  id?: string;          // session ID; auto-created if omitted
  exec_dir?: string;    // override working directory (absolute path)
  async_mode?: boolean; // default: false — if true, returns immediately with status "running"
  timeout?: number;     // seconds before returning "no_change_timeout" or "hard_timeout"
}
```

> **Note — `async_mode` default is false (synchronous):** The schema description reads "default: False for async, False for synchronous" — this appears to be a doc typo; the effective default is `false`, meaning the call blocks until the command finishes or times out. Set `async_mode: true` for long-running commands and then use `wait` or `view` to poll for completion.

**Response data — `ShellCommandResult`**

```typescript
interface ShellCommandResult {
  session_id: string;
  command: string;
  status: BashCommandStatus;
  output?: string;          // populated only when status === "completed"
  exit_code?: number;       // populated only when status === "completed"
  console?: ConsoleRecord[]; // structured command history with prompts
}
```

**Example (synchronous)**

```json
// Request
{
  "id": "research-task-42",
  "command": "ls /home/gem/workspace/research/task_42",
  "async_mode": false
}

// Response data
{
  "session_id": "research-task-42",
  "command": "ls /home/gem/workspace/research/task_42",
  "status": "completed",
  "output": "report.md\ndata.json\n",
  "exit_code": 0
}
```

---

## `POST /v1/shell/view`

Reads the current buffered terminal output of a session without executing a new command. Useful for polling async commands started with `async_mode: true`.

> **Note — SSE streaming mode:** Like `exec`, this endpoint also supports `Accept: text/event-stream`. In that mode it streams terminal output as it arrives, which is useful for watching a long-running build log in real time.

**Request — `ShellViewRequest`**

```typescript
interface ShellViewRequest {
  id: string; // required — session ID to inspect
}
```

**Response data — `ShellViewResult`**

```typescript
interface ShellViewResult {
  session_id: string;
  output: string;            // full buffered terminal output so far
  status: BashCommandStatus;
  command?: string;          // last executed or currently running command
  exit_code?: number;        // set only when status === "completed"
  console?: ConsoleRecord[];
}
```

---

## `POST /v1/shell/wait`

Blocks the calling request until the process currently running in the session exits, then returns its status.

**Request — `ShellWaitRequest`**

```typescript
interface ShellWaitRequest {
  id: string;       // required — session ID
  seconds?: number; // max seconds to wait before returning
}
```

**Response data — `ShellWaitResult`**

```typescript
interface ShellWaitResult {
  status: BashCommandStatus;
}
```

---

## `POST /v1/shell/write`

Sends stdin input to the process currently running in a session. Useful for interactive programs (prompts, REPLs, package managers asking for confirmation).

**Request — `ShellWriteToProcessRequest`**

```typescript
interface ShellWriteToProcessRequest {
  id: string;          // required — session ID
  input: string;       // required — text to write to stdin
  press_enter: boolean; // required — whether to append a newline / press Enter
}
```

> **Note — `press_enter` is required and has no default:** Unlike most boolean flags in this API, `press_enter` is a required field with no schema default. Omitting it causes a 422 validation error. For confirming prompts (e.g., `y\n` to apt), set `input: "y"` and `press_enter: true`.

**Response data — `ShellWriteResult`**

```typescript
interface ShellWriteResult {
  status: BashCommandStatus;
}
```

---

## `POST /v1/shell/kill`

Terminates the process running inside the named session. The session itself is not destroyed; it can accept new `exec` calls afterward.

**Request — `ShellKillProcessRequest`**

```typescript
interface ShellKillProcessRequest {
  id: string; // required — session ID
}
```

**Response data — `ShellKillResult`**

```typescript
interface ShellKillResult {
  status: BashCommandStatus; // typically "terminated"
  returncode: number;
}
```

---

## Schemas

### `BashCommandStatus`

An enum (compatible with the OpenHands agent protocol) describing the state of a shell process:

```typescript
type BashCommandStatus =
  | "running"            // process is still executing
  | "completed"          // process exited normally
  | "no_change_timeout"  // timed out because output stopped changing
  | "hard_timeout"       // timed out by wall-clock deadline
  | "terminated"         // process was killed
```

> **Note — two distinct timeout modes:** `no_change_timeout` fires when output has not changed for the timeout window (useful for detecting stalled commands). `hard_timeout` fires when the absolute elapsed time exceeds the limit. Both leave the process in a `running` or `terminated` state — inspect via `view` before assuming the command succeeded.

### `ConsoleRecord`

A structured record of a single executed command with its prompt and output:

```typescript
interface ConsoleRecord {
  ps1: string;      // required — shell prompt string (e.g., "gem@sandbox:~$")
  command: string;  // required — the command that was run
  output?: string;  // default: "" — stdout/stderr captured for this command
}
```

### `ShellSessionInfo`

Metadata snapshot of a single session as returned by the list endpoint. See the `GET /v1/shell/sessions` section above for the full shape.

### `Response<T>` envelope

Documented once in the [Response Envelope](#response-envelope) section above. All `Response_*_` schema names in the OpenAPI spec are specializations of this pattern with a concrete `data` type.

---

## Use from Nexus

Nexus sub-agents interact with the AIO Sandbox filesystem via this Shell API. Each sub-agent should create a dedicated session whose `exec_dir` is set to its task workspace under `/home/gem/workspace/{research|code|creative}/task_{id}/` — the session then retains that working directory for all subsequent `exec` calls without needing to pass `exec_dir` repeatedly. Long-running operations (package installs, test runs, multi-file builds) should use `async_mode: true` followed by `wait` so the agent graph node does not block indefinitely on the HTTP call. The `view` endpoint serves as a non-blocking progress check. When a task is complete, the agent should `DELETE /v1/shell/sessions/{session_id}` to free the session slot. The [[agent-infra-sandbox-sdk]] TypeScript SDK wraps these raw HTTP calls and is the preferred interface for code in `apps/agents/`.

## Related

- [[aio-sandbox-overview]]
- [[aio-sandbox-features]]
- [[aio-sandbox-openapi-overview]]
- [[aio-sandbox-sandbox-context-api]]
- [[aio-sandbox-file-api]]
- [[aio-sandbox-jupyter-api]]
- [[agent-infra-sandbox-sdk]]
- [[aio-sandbox-deepagents-integration]]

## Sources

- `raw/aio-sandbox/openapi.json` — paths `/v1/shell/*`; schemas: `ShellExecRequest`, `ShellCommandResult`, `ShellViewRequest`, `ShellViewResult`, `ShellWaitRequest`, `ShellWaitResult`, `ShellWriteToProcessRequest`, `ShellWriteResult`, `ShellKillProcessRequest`, `ShellKillResult`, `ShellCreateSessionRequest`, `ShellCreateSessionResponse`, `ActiveShellSessionsResult`, `ShellSessionInfo`, `BashCommandStatus`, `ConsoleRecord`, `Response`, `Response_ShellCommandResult_`, `Response_ShellViewResult_`, `Response_ShellWaitResult_`, `Response_ShellWriteResult_`, `Response_ShellKillResult_`, `Response_ShellCreateSessionResponse_`, `Response_ActiveShellSessionsResult_`, `Response_str_`, `HTTPValidationError`, `ValidationError`
