---
created: 2026-04-13
updated: 2026-04-13
tags: [aio-sandbox, jupyter, code]
sources: [raw/aio-sandbox/openapi.json]
---

# AIO Sandbox Jupyter API

The AIO Sandbox exposes a persistent IPython kernel API under `/v1/jupyter/*` that keeps all Python state — variables, imports, loaded dataframes, open file handles — alive across multiple calls within the same session. This is the primary distinction from [[aio-sandbox-code-execution-api]], which executes each snippet in a fresh process. Use the Jupyter API whenever a task requires multi-step computation where later steps depend on earlier results.

> **Note — Stateful vs stateless:** `/v1/jupyter/execute` with a `session_id` runs inside a live IPython kernel. Variables defined in call N are available in call N+1. `/v1/code/execute` is stateless — every call starts with a clean interpreter. Choose based on whether you need state to carry over.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/v1/jupyter/sessions/create` | Create a new kernel session |
| `POST` | `/v1/jupyter/execute` | Execute Python code in a (optionally named) session |
| `GET` | `/v1/jupyter/info` | Query available kernels and service limits |
| `GET` | `/v1/jupyter/sessions` | List all active sessions |
| `DELETE` | `/v1/jupyter/sessions/{session_id}` | Destroy a single session |
| `DELETE` | `/v1/jupyter/sessions` | Destroy ALL active sessions |

### POST /v1/jupyter/sessions/create

Creates a new IPython kernel and returns a `session_id` that subsequent execute calls can reference.

**Request body** (`JupyterCreateSessionRequest`):

| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| `session_id` | `string \| null` | No | auto-generated | Supply a deterministic ID (e.g., `task_<callId>`) to make sessions addressable across tool calls |
| `kernel_name` | `string \| null` | No | `"python3"` | Options: `"python3"`, `"python3.11"`, `"python3.12"` |

**Response data** (`JupyterCreateSessionResponse`):

| Field | Type | Notes |
|-------|------|-------|
| `session_id` | `string` | Use in subsequent execute calls |
| `kernel_name` | `string` | Confirmed kernel name |
| `message` | `string` | Human-readable status |

All responses are wrapped in the generic envelope: `{ success: boolean, message: string | null, data: T | null }`.

---

### POST /v1/jupyter/execute

Executes Python code. When a `session_id` is provided the code runs inside that kernel's namespace and all prior state is available. When `session_id` is omitted the sandbox creates an anonymous session for the call; state from that anonymous session is not reachable by name afterward.

**Request body** (`JupyterExecuteRequest`):

| Field | Type | Required | Default | Constraints |
|-------|------|----------|---------|-------------|
| `code` | `string` | Yes | — | Python source to run |
| `session_id` | `string \| null` | No | — | Omit for anonymous/one-shot execution |
| `kernel_name` | `string \| null` | No | `"python3"` | Ignored when session already exists |
| `timeout` | `integer \| null` | No | `30` | Seconds; range 1–300 |

**Response data** (`JupyterExecuteResponse`):

| Field | Type | Notes |
|-------|------|-------|
| `session_id` | `string` | The session used (useful when auto-generated) |
| `kernel_name` | `string` | Kernel that ran the code |
| `status` | `string` | `"ok"`, `"error"`, or `"timeout"` |
| `execution_count` | `integer \| null` | Kernel-incremented counter |
| `outputs` | `JupyterOutput[]` | Polymorphic output list (see Output handling) |
| `code` | `string` | The code that was executed (echo) |
| `msg_id` | `string \| null` | Jupyter kernel message ID |

> **Note — Session auto-expiry:** Sessions expire after **30 minutes of inactivity**. A subsequent execute call to an expired `session_id` will start a fresh kernel — all prior state is lost. Design long-running data pipelines to either complete within 30 minutes or checkpoint results to the filesystem.

---

### GET /v1/jupyter/info

Returns service metadata: which kernels are installed, session limits, and the current active session count.

**Response data** (`JupyterInfoResponse`):

| Field | Type | Notes |
|-------|------|-------|
| `default_kernel` | `string` | Typically `"python3"` |
| `available_kernels` | `string[]` | All installed kernel names |
| `active_sessions` | `integer` | Current live session count |
| `session_timeout_seconds` | `integer` | Inactivity timeout (1800 = 30 min) |
| `max_sessions` | `integer` | Hard cap on concurrent sessions |
| `description` | `string` | Service description string |
| `kernel_detection` | `string` | Strategy used to discover kernels |

---

### GET /v1/jupyter/sessions

Returns a map of all currently active sessions.

**Response data** (`ActiveSessionsResult`):

```
{ sessions: Record<string, SessionInfo> }
```

Where `SessionInfo` fields are: `kernel_name: string`, `last_used: number` (Unix timestamp), `age_seconds: integer`.

---

### DELETE /v1/jupyter/sessions/{session_id}

Terminates a single kernel session and frees its resources.

**Path parameter:** `session_id` (required, string).

**Response:** generic `Response` envelope (`success`, `message`).

---

### DELETE /v1/jupyter/sessions

Terminates every active kernel session on the sandbox.

> **Warning — Shared sandbox, global delete:** `DELETE /v1/jupyter/sessions` wipes ALL kernels, not just those created by the calling agent. Because all Nexus sub-agents share one AIO Sandbox instance, a general cleanup call will destroy sessions belonging to other concurrently running agents. Prefer `DELETE /v1/jupyter/sessions/{session_id}` to clean up only the session you own.

**Response:** generic `Response` envelope (`success`, `message`).

---

## Session lifecycle

The recommended lifecycle for stateful computation is:

1. **Create** — `POST /v1/jupyter/sessions/create` with a stable `session_id` derived from the task call ID (e.g., `task_<toolCallId>`). Record `session_id` for subsequent calls.
2. **Execute (repeatedly)** — `POST /v1/jupyter/execute` with `session_id` in every call. Variables, imports, and loaded data persist between calls in the same kernel namespace.
3. **Checkpoint** — write intermediate results to the filesystem (`/home/gem/workspace/`) so they survive session expiry and are accessible to other agents.
4. **Cleanup** — `DELETE /v1/jupyter/sessions/{session_id}` when the sub-agent run completes. Do NOT use the bulk-delete endpoint.

Sessions idle for more than 30 minutes are automatically reaped by the sandbox. If the sub-agent makes no further calls for a long period the session may be gone by the time execution resumes.

## Output handling

`JupyterExecuteResponse.outputs` is a list of `JupyterOutput` objects. Each object has a discriminant field `output_type` that determines which other fields are populated:

| `output_type` | Active fields | Meaning |
|---------------|--------------|---------|
| `"stream"` | `name` (`"stdout"` or `"stderr"`), `text` | Print output and stderr |
| `"execute_result"` | `data`, `metadata`, `execution_count` | The `Out[N]` result of an expression |
| `"display_data"` | `data`, `metadata` | Rich output (e.g., matplotlib figures) |
| `"error"` | `ename`, `evalue`, `traceback` | Exception with traceback lines |

For `execute_result` and `display_data`, the `data` object is a MIME-type map. Common keys:

- `"text/plain"` — plain text representation
- `"text/html"` — HTML table (pandas `DataFrame.to_html()`)
- `"image/png"` — base64-encoded PNG (matplotlib, seaborn, etc.)

> **Note — Image output:** Inline images are returned as base64 strings under `data["image/png"]`. The code agent does not need to write plot files to disk; it can read the base64 payload directly from the execute response and pass it to the orchestrator or write it to `/home/gem/workspace/shared/`.

When `status` is `"error"`, the `outputs` list will contain at least one entry with `output_type: "error"`. Check `status` first before inspecting outputs; a `"timeout"` status means the kernel is still alive but the request timed out — the kernel state may be partially modified.

## Schemas

TypeScript type sketches derived from the OpenAPI spec:

```typescript
// POST /v1/jupyter/sessions/create — request
interface JupyterCreateSessionRequest {
  session_id?: string | null;       // auto-generated when omitted
  kernel_name?: string | null;      // default "python3"
}

// POST /v1/jupyter/sessions/create — response data
interface JupyterCreateSessionResponse {
  session_id: string;
  kernel_name: string;
  message: string;
}

// POST /v1/jupyter/execute — request
interface JupyterExecuteRequest {
  code: string;
  session_id?: string | null;       // omit for anonymous/one-shot
  kernel_name?: string | null;      // default "python3"
  timeout?: number | null;          // seconds, 1–300, default 30
}

// POST /v1/jupyter/execute — response data
interface JupyterExecuteResponse {
  session_id: string;
  kernel_name: string;
  status: "ok" | "error" | "timeout";
  execution_count: number | null;
  outputs: JupyterOutput[];
  code: string;
  msg_id?: string | null;
}

// Polymorphic output — discriminate on output_type
interface JupyterOutput {
  output_type: "stream" | "execute_result" | "display_data" | "error";
  // stream
  name?: string | null;             // "stdout" | "stderr"
  text?: string | null;
  // execute_result / display_data
  data?: Record<string, unknown> | null;   // MIME map, e.g. "image/png" → base64
  metadata?: Record<string, unknown> | null;
  execution_count?: number | null;
  // error
  ename?: string | null;
  evalue?: string | null;
  traceback?: string[] | null;
}

// GET /v1/jupyter/info — response data
interface JupyterInfoResponse {
  default_kernel: string;
  available_kernels: string[];
  active_sessions: number;
  session_timeout_seconds: number;
  max_sessions: number;
  description: string;
  kernel_detection: string;
}

// GET /v1/jupyter/sessions — response data
interface ActiveSessionsResult {
  sessions: Record<string, SessionInfo>;
}

interface SessionInfo {
  kernel_name: string;
  last_used: number;    // Unix timestamp
  age_seconds: number;
}

// Generic response envelope (all endpoints)
interface Response<T = unknown> {
  success: boolean;
  message: string | null;
  data: T | null;
}
```

## Notebook UI vs JSON API

The AIO Sandbox also serves a classic Jupyter Notebook web interface at the `/jupyter` path (e.g., `http://localhost:8080/jupyter`). This is a browser-facing UI route, not a JSON API endpoint. Agent code should always use the `/v1/jupyter/*` API routes, not the UI path.

## Use from Nexus

The `data-analysis` skill uses Jupyter sessions as its primary execution environment because data analysis workflows are inherently multi-step: load data, clean, aggregate, plot, interpret. A single `session_id` is created at the start of the skill using the sub-agent's task call ID (e.g., `task_<toolCallId>`) so that all execute calls within that run share one kernel namespace. Kernel state — loaded dataframes, fitted models, computed figures — survives across tool calls for the duration of the sub-agent run. The code agent uses the [[aio-sandbox-shell-api]] for one-shot shell commands and the Jupyter API for any Python work that requires accumulated state.

## Related

- [[aio-sandbox-overview]]
- [[aio-sandbox-features]]
- [[aio-sandbox-code-execution-api]]
- [[aio-sandbox-shell-api]]
- [[agent-infra-sandbox-sdk]]

## Sources

- `raw/aio-sandbox/openapi.json` — paths `/v1/jupyter/*`; schemas: `JupyterCreateSessionRequest`, `JupyterCreateSessionResponse`, `JupyterExecuteRequest`, `JupyterExecuteResponse`, `JupyterInfoResponse`, `JupyterOutput`, `ActiveSessionsResult`, `SessionInfo`, `Response`, `Response_JupyterCreateSessionResponse_`, `Response_JupyterExecuteResponse_`, `Response_JupyterInfoResponse_`, `Response_ActiveSessionsResult_`
