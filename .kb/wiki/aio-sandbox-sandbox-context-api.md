---
created: 2026-04-13
updated: 2026-04-13
tags: [aio-sandbox, sandbox]
sources: [raw/aio-sandbox/openapi.json]
---

# AIO Sandbox Sandbox-Context API

`/v1/sandbox/*` is the read-only introspection surface for the AIO Sandbox container. It tells the agent what it's running inside of: OS, user, working directory, open ports, installed Python and Node toolchains, and the catalog of CLI binaries pre-baked into the image. There is no state to mutate here — these endpoints exist so the agent can plan around the environment instead of guessing.

## Endpoints

| Method | Path | Returns |
|---|---|---|
| GET | `/v1/sandbox` | [[#SandboxResponse]] (system + runtime + utils) |
| GET | `/v1/sandbox/packages/python` | Generic [[#Response]] with `data` = pip-list-style payload |
| GET | `/v1/sandbox/packages/nodejs` | Generic [[#Response]] with `data` = npm-list-style payload |

All three are GET, take no parameters, and need no auth header at the protocol level (the gateway in front of the Docker container is what enforces network-level access).

## SandboxResponse

`GET /v1/sandbox` is the primary entry point. It returns:

```jsonc
{
  "success": true,
  "message": "Operation successful",
  "home_dir": "/home/gem",                    // top-level convenience copy
  "version": "1.0.0.152",                     // sandbox image version
  "detail": {
    "system": {                               // SystemEnv
      "os": "linux",
      "os_version": "...",
      "arch": "x86_64",
      "user": "gem",
      "home_dir": "/home/gem",
      "timezone": "UTC",
      "occupied_ports": ["8080", "..."]
    },
    "runtime": {                              // RuntimeEnv
      "python": [
        { "ver": "3.11.x", "bin": "/usr/bin/python3.11", "alias": ["python3", "python"] },
        { "ver": "...",    "bin": "...",                  "alias": ["pip3", "pip", "uv", "jupyter"] }
      ],
      "nodejs": [
        { "ver": "20.x.x", "bin": "/usr/bin/node",        "alias": ["node", "npm", "npx"] }
      ]
    },
    "utils": [                                // ToolCategory[]
      {
        "category": "search",
        "tools": [
          { "name": "ripgrep", "description": "Recursive line-oriented search" }
        ]
      }
    ]
  }
}
```

> **Note — `home_dir` is `/home/gem`.** The Nexus workspace convention assumes this. If a future image changes the user, `/home/gem/workspace/` paths across the orchestrator and sub-agent prompts must change in lockstep.

### Field-by-field

- **`success` / `message`** — universal envelope from the [[#Response]] base shape. Always `true` on a 200; the message is human-readable, ignore it programmatically.
- **`home_dir`** — duplicated at top level *and* inside `detail.system.home_dir`. Prefer reading the top-level copy (less nesting; same value).
- **`version`** — sandbox image version, e.g. `1.0.0.152`. Useful when filing bugs against `agent-infra/sandbox`. Pin this in test fixtures so test breakage caused by image upgrades is loud.
- **`detail.system`** — a [[#SystemEnv]] snapshot. `occupied_ports` is the list of ports already bound when the container started, which is mostly the AIO Sandbox HTTP server itself plus its sub-servers (browser CDP, Jupyter, MCP, terminal). Don't try to bind to anything in this list.
- **`detail.runtime`** — [[#RuntimeEnv]]. Two arrays: `python` and `nodejs`. Each entry is a [[#ToolSpec]] with `ver`, `bin` (absolute path), and `alias` (the names you can call it by from a shell session). The runtime block lets the agent pick the right interpreter without spelunking `which`.
- **`detail.utils`** — array of [[#ToolCategory]]. Each category has a name and a list of [[#AvailableTool]]s. This is the catalog of CLI binaries the image ships with — `ripgrep`, `jq`, `git`, image converters, etc. Treat this as a static manifest of "things you can call from `/v1/shell/exec` without installing first".

## /v1/sandbox/packages/python and /v1/sandbox/packages/nodejs

Both return the generic [[#Response]] envelope. The schema does **not** type the `data` field — it's loosely typed (`anyOf: [{}, null]`) — but in practice it carries the installed-package listing for the named language. If you need a stable shape, run `/v1/shell/exec` with `pip list --format=json` or `npm ls --json` directly; the dedicated endpoints are convenience wrappers, not strongly-typed contracts.

> **Watch out:** the `data` field on `Response` has no schema. Treat it as `unknown` and parse defensively.

## Schemas

### Response

The base envelope every other AIO Sandbox response extends from:

```ts
{
  success: boolean       // default true
  message: string | null // default "Operation successful"
  data: unknown          // operation-specific payload
}
```

### SandboxResponse

Extends [[#Response]] with three required top-level fields:

```ts
{
  ...Response,
  home_dir: string,
  version: string,
  detail: SandboxDetail,
}
```

### SandboxDetail

```ts
{
  system: SystemEnv,
  runtime: RuntimeEnv,
  utils: ToolCategory[],
}
```

### SystemEnv

```ts
{
  os: string,
  os_version: string,
  arch: string,
  user: string,
  home_dir: string,
  timezone: string,
  occupied_ports: string[],   // strings, not numbers
}
```

### RuntimeEnv

```ts
{
  python: ToolSpec[],
  nodejs: ToolSpec[],
}
```

### ToolSpec

```ts
{
  ver: string | null,
  bin: string | null,
  alias: string[],
}
```

### ToolCategory

```ts
{
  category: string,
  tools: AvailableTool[],
}
```

### AvailableTool

```ts
{
  name: string,                  // binary name on PATH
  description: string | null,
}
```

## Use from Nexus

The Nexus orchestrator can hit `GET /v1/sandbox` once at startup and stash the result in [[long-term-memory]] (under `/memories/sandbox-context.json`) so sub-agents don't each re-fetch it. The [[#SandboxDetail]] payload is small and changes only across image upgrades, so caching it is safe for the lifetime of a thread.

The `runtime.python` and `runtime.nodejs` lists are also the right place to look before the [[aio-sandbox-code-execution-api]] tries to call `python` or `node` — the alias arrays tell you exactly which names resolve to which binary.

The Nexus orchestrator system prompt (`apps/agents/src/nexus/prompts/orchestrator-system.ts`) hard-codes `/home/gem/workspace/` paths matching this `home_dir` value. If a future image upgrade changes the user, that prompt must be updated in lockstep.

## Related

- [[aio-sandbox-overview]]
- [[aio-sandbox-features]]
- [[aio-sandbox-openapi-overview]]
- [[aio-sandbox-shell-api]]
- [[aio-sandbox-code-execution-api]]

## Sources

- `raw/aio-sandbox/openapi.json` — paths `/v1/sandbox`, `/v1/sandbox/packages/python`, `/v1/sandbox/packages/nodejs`; schemas `SandboxResponse`, `SandboxDetail`, `SystemEnv`, `RuntimeEnv`, `ToolSpec`, `ToolCategory`, `AvailableTool`, `Response`.
