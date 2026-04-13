---
created: 2026-04-13
updated: 2026-04-13
tags: [aio-sandbox, workspace, tool-call]
sources: [raw/aio-sandbox/openapi.json]
---

# AIO Sandbox OpenAPI Overview

The AIO Sandbox container exposes a single FastAPI HTTP server on port `8080` that brings together every tool an agent needs inside one process: a persistent shell, a virtual filesystem, a Chromium browser controlled via CDP, a Jupyter kernel registry, one-shot code executors for Python and Node, an MCP server gateway, a server-side skills registry, and a document-to-markdown utility. This article is the catalog. Each tag has its own deep-dive article — read those for endpoint-level detail.

OpenAPI metadata: `title: FastAPI`, `version: 1.0.0.152`, OpenAPI 3.1.0. The spec lives at `.kb/raw/aio-sandbox/openapi.json` and is a 6,947-line file with **41 endpoints** across **11 tags** and **133 component schemas**.

> **Note — `home_dir` is `/home/gem/`.** Every Nexus workspace path assumes this. The runtime container ships with user `gem`, and the [[aio-sandbox-sandbox-context-api]] returns this in `SandboxResponse.home_dir`. Don't hard-code `/root/`, `/app/`, or any other home — query it once and trust the answer.

## Tag catalog

| Tag | Endpoints | Article | What it does |
|---|---|---|---|
| `sandbox` | 3 | [[aio-sandbox-sandbox-context-api]] | Read-only environment introspection — OS, runtime, packages, occupied ports |
| `shell` | 10 | [[aio-sandbox-shell-api]] | Persistent shell sessions, exec/view/wait/write/kill, SSE streaming |
| `file` | 9 | [[aio-sandbox-file-api]] | Read/write/replace/search/find/upload/download/list/str_replace_editor |
| `browser` | 4 | [[aio-sandbox-browser-api]] | Chromium-via-CDP automation: info, screenshot, action dispatch, config |
| `jupyter` | 6 | [[aio-sandbox-jupyter-api]] | **Stateful** Python kernel sessions with persistent state |
| `code` | 2 | [[aio-sandbox-code-execution-api]] | One-shot multi-language execute + language info |
| `nodejs` | 2 | [[aio-sandbox-code-execution-api]] | One-shot Node execute + runtime info (merged into the same article) |
| `mcp` | 3 | [[aio-sandbox-mcp-api]] | List MCP servers, list tools per server, execute MCP tools |
| `skills` | 5 | [[aio-sandbox-skills-api]] | Server-side skills registry (register, list, fetch, delete) |
| `util` | 1 | [[aio-sandbox-util-api]] | `convert_to_markdown` — turn PDFs/DOCX/HTML into LLM-ready markdown |
| (untagged) | 1 | — | `GET /terminal` — serves the static terminal UI page |

The OpenAPI `info.description` block also mentions three non-`/v1/` routes that aren't covered by typed endpoints:

- **CDP:** `/cdp/json/version` — Chrome DevTools Protocol entrypoint, used by [[aio-sandbox-browser-api]] under the hood.
- **Notebook UI:** `/jupyter` — the actual Jupyter Lab/Notebook web UI, distinct from the JSON API at `/v1/jupyter/*`.
- **MCP transport:** `/mcp` and `/v1/mcp` — Streamable HTTP transport for direct MCP clients, distinct from the JSON gateway at `/v1/mcp/*`.

## Three execution surfaces, three lifetimes

The sandbox exposes three different ways to run code, and picking the wrong one is the easiest mistake to make:

| Surface | Article | State persistence | When to use |
|---|---|---|---|
| `/v1/shell/exec` | [[aio-sandbox-shell-api]] | **Session-persistent** — env vars, cwd, background processes survive across calls within the same `session_id` | Build commands, long-running processes, anything that needs a real shell |
| `/v1/jupyter/execute` | [[aio-sandbox-jupyter-api]] | **Kernel-persistent** — Python variables, imports, open file handles survive across calls within the same `session_id` | Iterative analysis, data science, anything that needs to keep state between snippets |
| `/v1/code/execute` and `/v1/nodejs/execute` | [[aio-sandbox-code-execution-api]] | **None** — every call is a fresh process | One-shot snippets, validation runs, "compute and return" |

> **Note — stateless ≠ shellless.** `/v1/code/execute` runs in the same container as the shell sessions, so it can read and write the same `/home/gem/workspace/` files. Statelessness applies to in-process state (variables, kernel), not on-disk state.

## Universal response envelope

Almost every endpoint wraps its payload in a generic `Response<T>`:

```ts
{
  success: boolean         // default true
  message: string | null   // default "Operation successful"
  data: T | null           // typed payload — varies per endpoint
}
```

The OpenAPI codegen names instantiations like `Response_ShellCommandResult_`, `Response_FileReadResult_`, etc. — same envelope, different `data` type. Endpoint articles document the inner `T` and skip restating the envelope each time.

> **Note — `success: true` is not the whole story.** A 200 with `success: true` is the universal success signal at the HTTP layer, but tool-style endpoints (notably the [[aio-sandbox-mcp-api]] `CallToolResultModel` and the shell `ShellCommandResult`) carry their own per-result error fields. A successful HTTP call can still wrap a failed tool result. Always check the `data` payload.

The base `Response` schema defines `data` as untyped (`anyOf: [{}, null]`) — wrappers like `Response_ShellCommandResult_` add the typing. Treat the bare `Response` (used by `/v1/sandbox/packages/*`) as having `data: unknown` and parse defensively.

## Auth and transport

The OpenAPI spec defines no `securitySchemes` — there is no token, API key, or OAuth flow at the protocol layer. The container is meant to live behind a trust boundary (typically `localhost` or a private Docker network). The Nexus three-process layout puts AIO Sandbox at `localhost:8080`, accessible only to the LangGraph dev server on the same machine, so this is fine. **If you ever expose port 8080 publicly, the gateway in front of it is the only auth.**

Most endpoints accept `application/json`. Two notable exceptions:

- `POST /v1/file/upload` — multipart form upload (`Body_upload_file`).
- `POST /v1/skills/register` — multipart form upload (`Body_register_skills`).

Two endpoints support **SSE streaming** when the client sends `Accept: text/event-stream`:

- `POST /v1/shell/exec`
- `POST /v1/shell/view`

The Accept header is the only switch — body shape is unchanged. See [[aio-sandbox-shell-api]] for the full ceremony.

## Schema budget

- **133 schemas total.** Roughly half are `Response_*_` envelope wrappers around the same generic shape.
- **Action schemas** make up another large slice — the [[aio-sandbox-browser-api]] discriminated union has 15+ action types (Click, DoubleClick, Drag, Hotkey, Press, Scroll, Typing, Wait, etc.).
- **Content blocks** for MCP results: `TextContent`, `ImageContent`, `AudioContent`, `EmbeddedResource`, `ResourceLink`, plus `BlobResourceContents` and `TextResourceContents`.
- **Validation** errors all flow through `HTTPValidationError` / `ValidationError` (FastAPI default) — not documented per-endpoint.

## Use from Nexus

The Nexus orchestrator and sub-agents talk to AIO Sandbox via the [[agent-infra-sandbox-sdk]] — a thin TypeScript wrapper around the same HTTP surface. The SDK shape mirrors the OpenAPI tag layout (one client per tag), so the wiki articles map 1:1 to the SDK namespaces. Direct HTTP calls work too, but the SDK gives you typed responses and handles the SSE switch on the shell endpoints automatically.

The [[composite-backend]] in the orchestrator routes `/skills/` and `/memories/` to the [[store-backend]] (SQLite) and everything else to the [[#filesystem]]-backed sandbox. The actual filesystem operations land on this OpenAPI surface — every read/write the orchestrator does ultimately becomes a [[aio-sandbox-file-api]] call.

## Related

- [[aio-sandbox-overview]]
- [[aio-sandbox-features]]
- [[aio-sandbox-docker]]
- [[agent-infra-sandbox-sdk]]
- [[aio-sandbox-deepagents-integration]]
- [[aio-sandbox-sandbox-context-api]]
- [[aio-sandbox-shell-api]]
- [[aio-sandbox-file-api]]
- [[aio-sandbox-browser-api]]
- [[aio-sandbox-jupyter-api]]
- [[aio-sandbox-code-execution-api]]
- [[aio-sandbox-mcp-api]]
- [[aio-sandbox-skills-api]]
- [[aio-sandbox-util-api]]

## Sources

- `raw/aio-sandbox/openapi.json` — OpenAPI 3.1.0 spec, version 1.0.0.152, all 41 endpoints across 11 tags, 133 schemas.
