# MCP Filesystem-of-Tools — Design

**Date:** 2026-04-13
**Status:** Draft, awaiting review
**Owner:** Nexus agents team
**Supersedes:** Memory note `aio_sandbox_mcp.md` (the "right integration is `@langchain/mcp-adapters`" recommendation is explicitly rejected in favor of the filesystem pattern below)

## Problem

The AIO Sandbox container at `localhost:8080` exposes an MCP gateway with **60 native tools** in a flat namespace across three internal servers: `chrome_devtools_*` (27), `browser_*` (23), and `sandbox_*` (10). Verified live on `ghcr.io/agent-infra/sandbox:latest` on 2026-04-13 (see `.kb/wiki/aio-sandbox-mcp-api.md`).

Today, three hand-rolled wrapper tools live under `apps/agents/src/nexus/tools/mcp-{list-servers,list-tools,execute-tool}/` and target the sandbox's `/v1/mcp/*` JSON gateway. The wiki confirms (`.kb/wiki/langchain-mcp-adapters.md` lines 148-150) that this gateway is **half-broken**: it works for streamable-http MCP servers (`browser`, `sandbox`) but fails on stdio servers (`chrome_devtools`) with `MCP server 'chrome_devtools' not found in configuration`. The 27 `chrome_devtools_*` tools are unreachable through the current code path. Even the tools that do reach the gateway are exposed to the model as **three generic dispatch tools** (list-servers, list-tools, execute-tool) instead of 60 statically-named tools with real schemas — a strictly worse shape.

The obvious fix is to install `@langchain/mcp-adapters`, point `MultiServerMCPClient` at `http://localhost:8080/mcp`, call `client.getTools()` once at startup, and bind the resulting 60 LangChain tools to research and code sub-agents. This is what the wiki originally recommended and it is what we are explicitly **not doing**, for two reasons documented in `.kb/wiki/code-execution-with-mcp.md` and `.kb/wiki/anthropic-advanced-tool-use.md`:

1. **Token cost.** Binding 60 tool schemas to research and code sub-agents puts every schema in the system prompt every turn. The wiki's worked example (`.kb/wiki/code-execution-with-mcp.md` line 18) measures a five-server MCP setup at ~55K tokens of definitions before the conversation starts. Sixty tools across three "servers" lands in the same range. The wiki diagnoses Nexus's current direction explicitly (line 130): *"Nexus's current MCP wiring is direct tool calling... This is the worst case the blog describes — every tool definition loaded upfront and every intermediate result passing through the context window."*

2. **Tool selection accuracy degrades past 30-50 tools.** Independent of token cost, the model gets worse at picking the right tool when the catalog is larger than 30-50 entries (`.kb/wiki/tool-search-tool.md` line 16). Sixty tools is over the threshold. Even with infinite context, direct-bind is the wrong shape.

Anthropic shipped three productized features on 2025-11-24 that target these problems (`tool-search-tool`, `programmatic-tool-calling`, `tool-use-examples`), but all three are gated behind a beta header that only works on `ChatAnthropic` Sonnet 4.0+ / Opus 4.0+ models. Nexus is multi-provider (Google / Anthropic / OpenAI / Z.AI), `@langchain/anthropic` support for `defer_loading` and `code_execution` fields is `[unverified]` in the current SDK, the server-side Tool Search Tool variant is not ZDR-eligible (it indexes the catalog), and the `default` tier priority routes to Google before Anthropic on most environments. A provider-conditional code path that only fires when Anthropic is the resolved provider would be load-bearing on a small fraction of runs.

This spec describes a **custom, provider-agnostic equivalent of all three Anthropic features**, built by exposing the MCP catalog as TypeScript wrapper files inside the AIO Sandbox and giving sub-agents a custom search affordance plus the existing code-execution substrate to compose them.

## Goals

- Reach all 60 MCP tools from research and code sub-agents without binding any of them as LangChain tools.
- Zero MCP client code in the `apps/agents` runtime — the agents process never imports `@modelcontextprotocol/sdk` at runtime.
- Provider-agnostic by construction. Same code path on Google, Anthropic, OpenAI, Z.AI. No `defer_loading`, no beta header, no `ChatAnthropic`-only branches.
- Token cost per turn is proportional to **how many MCP wrappers the agent reads on that turn**, not to how many MCP tools exist in the catalog.
- Result data from MCP tool execution stays inside the sandbox by default — only what an agent-written script `console.log`s reaches the conversation.
- Bootstrap failures degrade gracefully so the LangGraph server starts even when the sandbox is unreachable.

## Non-Goals

- Adopting any Anthropic productized feature: no `tool_search_tool_regex_20251119` / `tool_search_tool_bm25_20251119`, no `defer_loading: true` on tool blocks, no `code_execution` capability + `allowed_callers`, no `input_examples`, no `advanced-tool-use-2025-11-20` beta header. None of it.
- Retiring the four hand-rolled `sandbox_browser_{info,screenshot,action,config}` wrappers in favor of `servers/browser/*`. They stay as a hot-path affordance for research; revisit in a follow-up after measuring how the agent actually uses the new pattern.
- Retiring `sandbox_util_convert_to_markdown` in favor of the equivalent MCP `sandbox_convert_to_markdown` tool.
- A LangChain-bound MCP client. There is no `MultiServerMCPClient` anywhere in the runtime.
- Drift detection at startup (manifest hashing). Defer until measurement says it's needed.
- A custom client-side variant of Tool Search Tool layered on Anthropic-tier runs only. Possible Phase 3 work, explicitly out of scope here.
- Live-reload of the wrapper catalog. Wrappers are regenerated by a developer-run script and committed; the runtime treats them as static assets.

## Architecture

Two layers, one mental model.

```
┌──────────────────────────────────────────────────────────────┐
│  HOT LAYER — LangChain tools bound to sub-agents              │
│  Always loaded into the system prompt every turn              │
│                                                                │
│  research:  tavily_search, tavily_extract, tavily_map,        │
│             sandbox_util_convert_to_markdown,                 │
│             sandbox_browser_{info,screenshot,action,config},  │
│             sandbox_nodejs_execute,         ◄── NEW           │
│             mcp_tool_search                 ◄── NEW           │
│                                                                │
│  code:      sandbox_code_execute, sandbox_code_info,          │
│             sandbox_nodejs_execute, sandbox_nodejs_info,      │
│             sandbox_jupyter_{create,exec,info,list,delete},   │
│             mcp_tool_search                 ◄── NEW           │
│                                                                │
│  Deletions: sandbox_mcp_list_servers,                         │
│             sandbox_mcp_list_tools,                           │
│             sandbox_mcp_execute_tool                          │
└──────────────────────────────────────────────────────────────┘
                          │
                          │ agent calls mcp_tool_search → gets paths
                          │ agent reads wrapper files → knows schemas
                          │ agent writes Node script → runs via
                          │   sandbox_nodejs_execute
                          ▼
┌──────────────────────────────────────────────────────────────┐
│  COLD LAYER — Files in /home/gem/workspace/servers/           │
│  Schemas live on disk; only what the agent reads costs tokens │
│                                                                │
│  servers/                                                     │
│  ├── package.json                  (just @modelcontextprotocol/sdk)│
│  ├── tsconfig.json                                            │
│  ├── node_modules/                 (installed once at bootstrap)│
│  ├── _client/                                                 │
│  │   └── callMCPTool.ts            (the one MCP-speaking module)│
│  ├── chrome_devtools/              (27 wrapper .ts files)     │
│  ├── browser/                      (23 wrapper .ts files)     │
│  └── sandbox/                      (10 wrapper .ts files)     │
└──────────────────────────────────────────────────────────────┘
```

**The premise.** The 60 MCP tools stop being LangChain tools and become TypeScript wrapper files inside the sandbox. Sub-agents discover them via a custom `mcp_tool_search` LangChain tool, read wrapper files via the existing filesystem helpers, and execute them by writing Node scripts that import the wrappers and run via the existing `sandbox_nodejs_execute` tool.

**Provider-agnostic by construction.** Nothing in this design touches an Anthropic-specific API field. The whole pattern works identically when the `default` tier resolves to Gemini Pro, GPT-4.1, GLM-4.6, or Sonnet 4.6.

**Zero MCP client in apps/agents at runtime.** A generator script (run manually when the sandbox image bumps) uses `@modelcontextprotocol/sdk` as a **dev dependency** to introspect `/mcp` and write the wrapper files. After commit, the agents process never imports the SDK. At LangGraph startup, the orchestrator copies the static `apps/agents/sandbox-files/servers/` tree into the sandbox via the existing filesystem backend — pure file I/O, no MCP protocol traffic.

**The custom analog of Anthropic's three features.**

| Anthropic productized feature | Custom Nexus equivalent |
|---|---|
| **Tool Search Tool** (server-side regex/BM25 over deferred catalog; returns `tool_reference` blocks the API expands inline) | **`mcp_tool_search` custom LangChain tool** + `using-mcp-tools` SKILL.md. Greps over `/home/gem/workspace/servers/` (file names + JSDoc descriptions), returns a ranked shortlist of paths + summaries. The agent then `read_file`s the wrappers it wants. |
| **`defer_loading: true`** | The wrapper TS files are on disk in the sandbox, not bound LangChain tools. They're "deferred" by being files instead of prompt-resident schemas. Zero tokens until the agent reads one. |
| **`tool_reference` auto-expansion** | The agent reads a wrapper file with the existing `read_file` filesystem helper. The file content (TypeScript types + JSDoc + import statement) IS the expanded reference. |
| **Programmatic Tool Calling** (Python in Anthropic-hosted sandbox; only summary returns) | Agent writes a Node script, runs via `sandbox_nodejs_execute` in our sandbox. Only stdout returns to the model. |
| **Tool Use Examples** (`input_examples`) | Wrapper files include JSDoc with example invocations. |
| **Anthropic-only, Sonnet+/Opus+** | Provider-agnostic, works on any tier. |

## Components

Eight pieces, listed in dependency order.

### 1. Generator script — `apps/agents/scripts/generate-mcp-wrappers.ts`

A standalone TypeScript script run via `tsx`. **Not imported by anything in the agents runtime.** Reads `SANDBOX_URL` from the environment (default `http://localhost:8080`), connects via `@modelcontextprotocol/sdk`'s Streamable HTTP client, calls `client.listTools()`, and writes the wrapper tree to `apps/agents/sandbox-files/servers/`.

For each MCP tool returned by `listTools()`:
- Parses the `inputSchema` (JSON Schema) into a TypeScript interface using a minimal hand-rolled converter. The converter handles only the JSON Schema subset that MCP tools actually use: `object`, `string`, `number`, `boolean`, `array`, `enum`, and `$ref` to local definitions. Unsupported constructs (`oneOf`, `allOf`, external `$ref`) cause the generator to throw with a clear error pointing at the offending tool.
- Determines the namespace from the tool name's prefix: `chrome_devtools_navigate` → `chrome_devtools/`, `browser_click` → `browser/`, `sandbox_execute_code` → `sandbox/`. Strips the prefix from the filename: `chrome_devtools_navigate` → `chrome_devtools/navigate.ts`.
- Renders a `.ts` file containing: a JSDoc block with the tool's description and per-argument docs, the input/output TypeScript interfaces, and an exported async function that calls `callMCPTool(toolName, input)`.

**Idempotent:** Builds the entire wrapper set in memory before flushing to disk. Deletes the existing `servers/{chrome_devtools,browser,sandbox}/` subdirectories before writing fresh content (so removed-upstream tools disappear). Leaves `_client/`, `package.json`, and `tsconfig.json` alone.

**Wired** into `apps/agents/package.json` as `npm run generate:mcp-wrappers`. Documented as the action to take when the sandbox image bumps.

### 2. Static asset tree — `apps/agents/sandbox-files/servers/`

Committed to git. Contents written by the generator, plus three hand-maintained files:

- **`package.json`** — Minimal; declares `@modelcontextprotocol/sdk` as the only dependency, pinned to an exact version (no caret prefix). The pin is bumped manually when we want a new SDK version. Hand-written, idempotent across regenerations.
- **`_client/callMCPTool.ts`** — The single module that speaks MCP. Hand-written, ~30 lines. Constructs a Streamable HTTP `Client` from `@modelcontextprotocol/sdk`, posts to `http://localhost:8080/mcp`, returns the parsed result. One client per `callMCPTool` invocation (matches the SDK's stateless default — no session pooling). **Throws on `isError: true`** so the calling script gets a clear stack trace instead of a "successful" return value with a hidden error field.
- **`tsconfig.json`** — Minimal, configured for `tsx` execution inside the sandbox. ESM module resolution.

The 60 generated wrapper files live under `chrome_devtools/`, `browser/`, `sandbox/`. Each is a fully self-contained TypeScript file: imports `callMCPTool` from `../_client/callMCPTool.js`, defines its own input/output interfaces, exports one async function. Approximately 20-40 lines per file.

### 3. Sandbox bootstrap — `apps/agents/src/nexus/backend/sandbox-bootstrap.ts`

New module. Exports `ensureSandboxFilesystem(sandbox: AIOSandboxBackend, workspaceRoot: string): Promise<boolean>`. Called once from `createNexusOrchestrator()` after the backend is constructed.

**State machine:**

1. Check whether `/home/gem/workspace/servers/.bootstrap-marker` exists in the sandbox.
2. If yes, return `true` immediately (fast path — skips all subsequent steps).
3. If no:
   - Walk the static `apps/agents/sandbox-files/servers/` tree at module load time using Node `fs.readdir` + `fs.readFile`. (This runs in the agents process, not the sandbox.)
   - For each file, call the filesystem backend's write API to copy it into the sandbox at `/home/gem/workspace/servers/<relative-path>`.
   - Issue `cd /home/gem/workspace/servers && npm install` via `executeBash` against the sandbox to install `@modelcontextprotocol/sdk` into `servers/node_modules/`.
   - Touch `.bootstrap-marker` with a timestamp so subsequent startups skip the bootstrap entirely.
4. Return `true` on success, `false` on any failure (with the failure logged to stderr).

**Concurrency:** A process-level singleton promise dedupes concurrent calls. The first caller starts the bootstrap; subsequent callers `await` the same promise. If it rejects, all waiters see the failure together — no half-bootstrapped state.

**Failure mode:** If any step fails, log the error loudly with the failing path or the captured stderr, set a process-level flag `mcpFilesystemReady = false`, return `false` without throwing. The orchestrator construction continues. The marker is written **only** after every step succeeds, so a partial-write retry is automatic on the next orchestrator construction.

The flag is per-process. A successful retry flips it back to `true`. A clean LangGraph server restart is the recovery path for an unrecoverable failure.

**Module-level state:** The `sandbox-bootstrap.ts` module owns the flag and the singleton bootstrap promise. It exports `isMcpFilesystemReady(): boolean` (read-only accessor used by `mcp-tool-search/tool.ts` to decide whether to short-circuit with the catalog-unavailable error) alongside `ensureSandboxFilesystem()`. No other consumer should mutate the flag — only the bootstrap module flips it based on success/failure of its own steps.

### 4. Custom search LangChain tool — `apps/agents/src/nexus/tools/mcp-tool-search/`

Standard `tool/` subfolder with `prompt.ts` + `tool.ts` matching the existing convention (see `tools/search/`, `tools/extract/`, `tools/map/` for the pattern).

**`tool.ts`** exports `mcpToolSearch` and a Zod schema:

```typescript
const schema = z.object({
  query: z.string().min(1).describe(
    "Keyword or phrase describing the capability you need."
  ),
  namespace: z.enum(["chrome_devtools", "browser", "sandbox"]).optional()
    .describe("Restrict the search to one MCP namespace."),
  limit: z.number().int().min(1).max(10).default(5),
});
```

**Implementation:**
- Reads the wrapper files from the sandbox via the AIO filesystem backend (the same code path the agent would use).
- Lazy-builds an in-process index on first call, cached for the lifetime of the orchestrator instance.
- Ranks by: (1) exact name substring match (highest weight), (2) description keyword match (medium weight), (3) argument name/description keyword match (low weight).
- Returns a JSON array of `{ path, name, summary }` objects, top N by score. The summary is the first sentence of the wrapper file's JSDoc.
- Calls `isMcpFilesystemReady()` from `sandbox-bootstrap.ts` at the start of every invocation. If it returns `false`, short-circuits with a structured error: `{ error: "MCP tool catalog is unavailable in this run. The sandbox bootstrap failed; check stderr for details. Continue with built-in tools." }` — without touching the filesystem backend.
- If the search returns zero hits, returns a structured-not-empty response: `{ results: [], note: "No MCP tools matched '<query>'. The catalog covers browser automation (chrome_devtools/, browser/) and sandbox introspection (sandbox/). See using-mcp-tools skill for what's available." }`.

**`prompt.ts`** exports `MCP_TOOL_SEARCH_NAME` (`"mcp_tool_search"`) and `MCP_TOOL_SEARCH_DESCRIPTION` matching the existing convention.

Approximately 80 lines of implementation. **Bound to both research and code sub-agents.**

### 5. Wiring updates — `apps/agents/src/nexus/tools/index.ts`

- **Delete** all three exports + imports for `sandboxMcpListServers`, `sandboxMcpListTools`, `sandboxMcpExecuteTool`. Delete the `mcpTools` const entirely.
- **Add** `mcpToolSearch` export and import.
- **Modify `researchTools`:** add `sandboxNodejsExecute` and `mcpToolSearch`. New length: 10 entries.
- **Modify `codeTools`:** add `mcpToolSearch`. Drop the `...mcpTools` spread. New length: 10 entries (down from 12).
- **Modify `allTools`:** drop the three deleted MCP wrappers, add `mcpToolSearch`.

**Delete** the three folders: `apps/agents/src/nexus/tools/mcp-list-servers/`, `mcp-list-tools/`, `mcp-execute-tool/`.

### 6. Skill — `apps/agents/src/nexus/skills/using-mcp-tools/`

Three files following the existing skill convention (see `skills/deep-research/`, `skills/build-app/`, etc.):

- **`SKILL.md`** — Frontmatter (name, description under 1024 chars) + a body explaining the pattern: when to reach for MCP tools, how to use `mcp_tool_search`, how to read wrapper files, how to write a Node script that imports them, how to run via `sandbox_nodejs_execute`. Includes the explicit advice "print only what you need — script output is what reaches the conversation, not the raw tool result." Includes a section on reading script errors with three example failure modes (wrong args, MCP tool error, stale wrapper) and the recovery action for each.
- **`examples.md`** — Three worked examples: (a) take a screenshot via `chrome_devtools/take_screenshot`, (b) inspect network requests on a page, (c) execute Python via `sandbox/execute_code` from a Node script (showing nested capability).
- **`templates/screenshot-script.ts`** — A copy-pasteable script template the agent can adapt.

Seeded into the orchestrator filesystem at startup via the existing `nexusSkillFiles` barrel export in `skills/index.ts` — same as every other skill. Zero new wiring.

### 7. System prompt updates — three files

- **`apps/agents/src/nexus/agents/research/prompt.ts`** — Add a "Discovering additional capabilities" section pointing at `mcp_tool_search` and `/home/gem/workspace/servers/`. Keep the existing tool descriptions for the hot-layer 8 tools intact.
- **`apps/agents/src/nexus/agents/code/prompt.ts`** — Same addition. Plus: remove any existing references to the three deleted MCP wrappers if mentioned by name.
- **`apps/agents/src/nexus/prompts/orchestrator-system.ts`** — Replace the long "research" and "code" bullets at lines 28-29 (which we just rewrote in the previous task to enumerate ~20 tools) with shorter capability-flavored descriptions. The hot-layer tools get a brief mention; the cold layer gets one sentence: *"plus a deferred catalog of ~60 MCP tools (browser automation, devtools, sandbox introspection) accessible via `mcp_tool_search` and `sandbox_nodejs_execute` — see `using-mcp-tools` skill."* Do not enumerate the 60.

### 8. Tests — `apps/agents/src/nexus/__tests__/`

Five new test files. Detailed cases in the **Testing** section below.

## Data Flow

Three flows worth tracing.

### Flow A — Generator script (one-shot, manual, dev-time)

```
Developer ──npm run generate:mcp-wrappers──▶  generate-mcp-wrappers.ts
                                                     │
                                                     │ 1. Construct StreamableHTTPClientTransport
                                                     │ 2. await client.connect()
                                                     │ 3. await client.listTools()
                                                     ▼
                                              AIO Sandbox /mcp
                                                     │ ◄── 60 Tool defs returned
                                                     │
                                                     │ 4. For each tool:
                                                     │    parse inputSchema → TS interface
                                                     │    resolve namespace from prefix
                                                     │    render wrapper template
                                                     │ 5. Build the entire tree in memory
                                                     │ 6. Delete the three target subdirs
                                                     │ 7. Write all files to sandbox-files/servers/
                                                     ▼
                                              apps/agents/sandbox-files/servers/
                                                     │ ◄── Developer reviews diff
                                                     │
                                              git commit + push
```

Runs only when the upstream sandbox image bumps. The agents process never executes this script. There's a small staleness risk (forgotten regeneration) but it surfaces at runtime when the MCP server rejects an unknown tool name — `callMCPTool` re-throws on `isError: true` and the agent sees the failure in the next turn's stderr.

### Flow B — LangGraph startup → sandbox bootstrap (per-process, automatic)

```
npm run dev
    │
    ▼
graph.ts module load
    │  - logPreflight()  (unchanged — no MCP knowledge)
    │  - exports compiled graph
    ▼
First user prompt arrives
    │
    ▼
orchestratorNode() → getOrchestrator(threadId) → cache miss
    │
    ▼
createNexusOrchestrator(undefined, workspaceRoot)
    │  1. construct AIOSandboxBackend
    │  2. construct CompositeBackend
    │  3. ◄── NEW: await ensureSandboxFilesystem(sandbox, workspaceRoot)
    │
    ▼
ensureSandboxFilesystem
    │
    │  Step 1: sandbox.read("/home/gem/workspace/servers/.bootstrap-marker")
    │          - exists? → return true (fast path)
    │          - missing? → continue
    │
    │  Step 2: walk apps/agents/sandbox-files/servers/ in apps/agents process
    │
    │  Step 3: for each file → sandbox.write(target_path, contents)
    │
    │  Step 4: sandbox.executeBash("cd /home/gem/workspace/servers && npm install")
    │
    │  Step 5: sandbox.write(".bootstrap-marker", timestamp)
    │
    │  Returns true on success, false on any failure
    │
    ▼
createDeepAgent() proceeds → orchestrator returned (cached per thread)
```

**Cost:** ~60 `sandbox.write` calls + 1 `npm install` + 1 marker write. The first-time bootstrap is dominated by the npm install (~10-30 seconds). Subsequent thread constructions hit the marker fast path and add ~1ms.

### Flow C — Agent uses an MCP tool (the hot path during a normal turn)

```
Research agent receives task: "Take a screenshot of github.com/anthropics
                               after logging in"
    │
    ▼
Model emits ToolCall: mcp_tool_search({ query: "screenshot login" })
    │
    ▼
mcp_tool_search runs in apps/agents process
    │  - Lazy-builds index from sandbox files (one-time per orchestrator)
    │  - Ranks: name > description > arg metadata
    │  - Returns top 5 as JSON
    ▼
ToolMessage back to model:
    [
      {"path": "servers/chrome_devtools/take_screenshot.ts",
       "name": "chrome_devtools_take_screenshot",
       "summary": "Capture a screenshot..."},
      {"path": "servers/browser/take_screenshot.ts", ...},
      {"path": "servers/chrome_devtools/navigate.ts", ...},
      ...
    ]
    │
    ▼
Model emits ToolCall: read_file({
    path: "/home/gem/workspace/servers/chrome_devtools/take_screenshot.ts"
})
    │  → DeepAgents auto-provisioned filesystem helper
    │  → AIOSandboxBackend.read(path)
    ▼
Model now sees the JSDoc + types + function signature.
    THIS is the "deferred-tool-definition reveal" — the analog of
    Anthropic's tool_reference auto-expansion, except the "expansion"
    is just a file read.
    │
    │  Model may also read additional wrapper files (navigate.ts, click.ts, etc.)
    │  if it needs more than one tool for the task.
    │
    ▼
Model emits ToolCall: sandbox_nodejs_execute({
    code: `
        import { takeScreenshot } from './chrome_devtools/take_screenshot.js';
        // login flow, navigate, screenshot
        const r = await takeScreenshot({ ... });
        console.log(r);
    `,
    cwd: "/home/gem/workspace/servers"
})
    │
    ▼
HTTP POST to AIO Sandbox /v1/nodejs/execute
    │
    ▼
AIO Sandbox runs the Node script
    │  - Resolves './chrome_devtools/take_screenshot.js' against cwd
    │  - import calls the wrapper function
    │  - wrapper calls callMCPTool('chrome_devtools_take_screenshot', {...})
    │  - callMCPTool constructs a Streamable HTTP MCP Client,
    │    POSTs to localhost:8080/mcp (loopback inside the same container)
    │  - mcp-hub routes to chrome_devtools server
    │  - MCP server takes the screenshot
    │  - returns image data + metadata via JSON-RPC
    │  - wrapper returns the structured result
    │  - script does whatever filtering + console.log()
    │  - sandbox returns stdout/stderr + exit code
    ▼
ToolMessage back to model:
    stdout: "{ url: ..., width: ..., height: ...,
              saved_to: '/home/gem/workspace/research/task_xxx/screenshot.png' }"
    │
    ▼
Model continues with only the script's printed output in context.
    The raw base64 image data, the full network trace, the cookie jar —
    none of it ever reaches the conversation.
```

**Token accounting for one screenshot task:**

- `mcp_tool_search` result: ~5 entries × ~30 tokens = ~150 tokens
- `read_file` of one wrapper: ~200-400 tokens (JSDoc + types + function signature)
- `sandbox_nodejs_execute` script: ~150 tokens of code
- Result: ~50-100 tokens of structured output
- **Total prompt cost for using the cold-layer tool: ~600 tokens**

Direct-bind would put 30+ schemas in the system prompt every turn whether they're used or not. The break-even is the first turn that doesn't read any cold-layer tool.

**Three subtleties worth noting:**

1. **`callMCPTool` runs inside the sandbox, not in apps/agents.** The MCP traffic stays on the loopback interface inside the Docker container. The agents process never sees it. This is what makes the design provider-agnostic.

2. **No statelessness penalty in practice.** Each `callMCPTool` call constructs a fresh MCP `Client`. It's loopback Streamable HTTP — sub-millisecond connect time. A script that calls 5 wrappers makes 5 client constructions; the overhead is noise relative to the actual MCP tool execution time (browser navigation is hundreds of ms).

3. **The script can compose tools cheaply.** The agent isn't paying a model turn per MCP call. A "navigate, click login, fill form, screenshot" workflow is 4 MCP tool calls but **one** `sandbox_nodejs_execute` invocation, which is **one** model turn. PTC's premise — one model turn for an arbitrary chain — falls out for free.

## Error Handling

Six failure surfaces.

### Failure 1: Generator script can't reach a sandbox

**What fails:** `npm run generate:mcp-wrappers` is run with no sandbox at `localhost:8080` (or wrong `SANDBOX_URL`).

**How it surfaces:** `@modelcontextprotocol/sdk` throws during `client.connect()`. Process exits non-zero before any files are touched.

**What we do:** Catch the error, print `"Couldn't reach sandbox at <URL>. Start one with: docker run ... ghcr.io/agent-infra/sandbox:latest"`. Exit code 1. **No partial wrapper writes** — the generator builds the entire tree in memory first and only flushes after `listTools()` returns successfully.

### Failure 2: `ensureSandboxFilesystem` can't write files

**What fails:** Mid-bootstrap `sandbox.write` failure (permission denied, disk full, container restart, network blip).

**How it surfaces:** Filesystem backend throws. Bootstrap is mid-flight — some files written, marker not yet touched.

**What we do:**
1. **No marker on partial failure.** The marker is the last action, like a transaction commit. Partial-write retry is automatic on the next orchestrator construction because the marker isn't there.
2. **Catch the error in `ensureSandboxFilesystem`**, log it loudly with the failing path, set `mcpFilesystemReady = false`, return `false`. Orchestrator construction continues.
3. **`mcp_tool_search` checks the flag at call time.** If `false`, returns the structured "MCP tool catalog is unavailable" error so the agent falls back to its hot-layer tools.

### Failure 3: `npm install` inside the sandbox fails

**What fails:** Files copied successfully, but `npm install --prefix /home/gem/workspace/servers` fails — no internet, npm registry slow, sandbox missing `npm`, etc.

**How it surfaces:** `executeBash` returns non-zero exit code with stderr containing the npm error.

**What we do:** Same path as Failure 2. **Critical: log the captured stderr.** npm errors are unhelpful without the actual output. The mitigation in Component 2 (pinning the SDK version exactly) prevents transitive-dep "it worked yesterday" failures.

### Failure 4: Wrapper script throws at runtime

**What fails:** Agent has read a wrapper, written a script, called `sandbox_nodejs_execute`, the script crashes. Causes: `callMCPTool` threw on `isError: true`, agent passed wrong arguments, stale wrapper, typo'd import path.

**How it surfaces:** Stack trace lands in `sandbox_nodejs_execute`'s stderr, which becomes part of the ToolMessage the model sees.

**What we do:** **Nothing special at the wiring layer.** This is exactly the surface the model is supposed to see and react to. The agent reads the stderr, fixes its script, retries.

**Two design implications:**
1. `callMCPTool` lets `isError: true` throw, not silently return error data. Burying errors in success paths is a known anti-pattern in agent loops.
2. The `using-mcp-tools` SKILL.md tells the agent how to read script errors with three example failure modes and recovery actions for each.

### Failure 5: `mcp_tool_search` finds nothing

**What fails:** Query has no matches in the catalog.

**How it surfaces:** ToolMessage to the model contains an empty results array (or low-scored irrelevant entries).

**What we do:** Return a structured response with guidance, not a bare empty array. The note tells the agent what categories exist (without enumerating the 60 tools) so it can reformulate or give up gracefully. See Component 4 for the exact response shape.

### Failure 6: Stale wrappers (the silent killer)

**What fails:** Dev pulled a new sandbox image but forgot to re-run `npm run generate:mcp-wrappers`. Committed wrappers reference tool names or argument shapes that no longer exist.

**How it surfaces:** Bootstrap succeeds, search succeeds, agent reads a stale wrapper, agent writes a script, `callMCPTool` is called with a tool name the MCP server doesn't recognize. The MCP server returns a response with `isError: true`, `callMCPTool` re-throws, and the script exits non-zero with the MCP error message in stderr — Failure 4 path triggers.

**What we do for v1:** The agent sees the runtime error from Failure 4 and recovers. Acceptable for v1 because (1) sandbox image bumps are rare, (2) the error is loud and obvious in stderr, (3) the fix is "run the generator and commit the diff" — a normal PR-shaped task.

**What we'd add for v2 if drift becomes a real problem:** A startup-time hash check. The generator writes a `.manifest-hash` file containing a hash of the tool names + schemas it saw at generation time. The bootstrap step calls `tools/list` once via the MCP client, hashes the live catalog, and compares. If they diverge, log a loud warning at startup. Doesn't block, just warns. **Not in v1** — defer until measurement says it's needed.

**Error-handling philosophy in one sentence:** *Bootstrap failures degrade gracefully and stay out of the orchestrator's way; runtime failures inside scripts are exactly what the model is supposed to see and recover from.*

## Testing

Five test files. Anything that touches the live sandbox is gated behind an integration flag; everything else is a fast unit test.

### Test 1 — `__tests__/generate-mcp-wrappers.test.ts`

Covers the rendering pipeline. Fixture: `__tests__/fixtures/mcp-tools-manifest.json`, ~6 representative tools (two per namespace) covering the schema variations the generator must handle.

Cases:

1. Renders the right directory structure (six tools → three subdirs → six files).
2. Strips namespace prefix from filenames (`chrome_devtools_navigate` → `chrome_devtools/navigate.ts`).
3. JSON Schema → TS interface (required/optional `?` markers, enums → string unions).
4. JSDoc rendering (description, `@param` per arg, example block).
5. Idempotence (running twice produces byte-identical output).
6. Removed tools disappear (run with 6, then 5, verify the 6th file is gone).
7. Unsupported schema constructs (`oneOf`, `allOf`, external `$ref`) throw with a clear error pointing at the offending tool.

Approximately 10-12 cases. Sub-100ms.

### Test 2 — `__tests__/mcp-tool-search.test.ts`

Covers the search/ranking logic. Fixture: `__tests__/fixtures/wrapper-files/`, ~10 hand-written stub wrapper files matching the real generator's format, including intentional name collisions.

Cases:

1. Exact name substring match wins.
2. Description match works for capability-flavored queries.
3. Argument names contribute to the score.
4. `namespace` parameter restricts the search.
5. `limit` is honored.
6. Empty result returns the structured-not-empty response with the category note.
7. Zero-score entries are filtered, not padded.
8. Index built lazily once and cached across multiple search invocations.

Approximately 8 cases.

### Test 3 — `__tests__/sandbox-bootstrap.test.ts`

Covers the `ensureSandboxFilesystem` state machine. Mocks: `FakeSandboxBackend` class implementing `read` / `write` / `executeBash` against an in-memory `Map<string, string>`.

Cases:

1. Cold start writes everything, issues npm install, writes marker.
2. Marker present → fast path returns immediately, zero writes.
3. Concurrent calls dedupe (two simultaneous calls → one bootstrap, both promises resolve to the same result).
4. Write failure mid-way → no marker, error logged with the failing path, no exception propagated, flag set false.
5. `npm install` failure → no marker, error logged with the captured stderr, flag set false.
6. Retry after partial failure → second run succeeds, marker present, flag flips to true.
7. Flag tracks current state, not "ever failed."

Approximately 7 cases.

### Test 4 — `__tests__/call-mcp-tool.integration.test.ts`

The only test that requires a live sandbox. Matches the existing repo convention from `models/__tests__/zai-chat-model.integration.test.ts`: filename ends in `.integration.test.ts` and the entire `describe` block is gated with `describe.skipIf(!process.env.SANDBOX_INTEGRATION)`. The bespoke `SANDBOX_INTEGRATION=true` env var is the opt-in (the sandbox URL has a default, so we can't gate on its presence — we need an explicit "yes I have a sandbox running" signal).

Cases:

1. **Smoke test against `sandbox_get_context`.** No-arg, side-effect-free MCP tool. Bootstrap a sandbox, run the bootstrap step against the real backend, execute a one-line Node script, assert the parsed stdout has the expected shape.
2. **Roundtrip with a non-trivial argument.** `sandbox_convert_to_markdown` against a fixture HTML file pre-written into the workspace. Verifies argument marshaling.
3. **Error path: `isError: true` from MCP throws cleanly.** Call a tool with deliberately invalid arguments. Verify the script exits non-zero, stderr contains the MCP error message, `callMCPTool` rethrew rather than silently returning error data.

Approximately 3 cases. Slow but the only thing that catches wiring drift.

### Test 5 — `__tests__/tool-wiring.test.ts`

Covers the structural invariants of `tools/index.ts` after the deletions and additions.

Cases:

1. `researchTools` contains the expected 10 entries by name (Tavily 3 + convert + 4 browser + nodejs_execute + mcp_tool_search).
2. `codeTools` contains the expected 10 entries (9 sandbox runtime + mcp_tool_search), with the deleted gateway wrappers absent.
3. `allTools` is the union with no duplicates.
4. The 3 deleted symbols are not exported from `tools/index.ts`.
5. The 3 deleted folders don't exist on disk.

Approximately 5 cases.

### Test budget summary

| Test | Cases | Type | Runs in CI? |
|---|---:|---|---|
| Generator | 10-12 | Unit (fixture) | Yes |
| Tool search ranking | ~8 | Unit (fixture) | Yes |
| Bootstrap idempotence | ~7 | Unit (fakes) | Yes |
| `callMCPTool` integration | 3 | Integration (live sandbox) | Behind `SANDBOX_INTEGRATION=true` env var |
| Tool wiring snapshot | ~5 | Unit (metadata) | Yes |

**Total automated cases: ~33-35.** The existing `apps/agents/__tests__/` suite has 46 unit tests + 3 Tavily integration tests, so this is roughly a 70% addition.

## Verify Before Claiming Done

Three manual checks no automated test can validate. The implementer must do these by hand before declaring the work complete:

1. **Run the generator against a live sandbox** and visually review the diff of the committed wrapper files. Look for: weird type names, missing JSDoc, namespace-routing surprises (a tool whose name doesn't follow the prefix convention).
2. **`npm run dev` end to end with a real prompt.** Submit a research task that requires the cold layer (e.g., "screenshot github.com/anthropics from a logged-in session"). Watch the LangGraph stream — confirm `mcp_tool_search` is called, a wrapper is read, a script is executed, and the result lands in the conversation without the raw MCP payload bleeding through.
3. **Bootstrap on a fresh sandbox container.** Stop the existing sandbox, start a fresh one, send a prompt — verify the bootstrap takes ~10-30s and subsequent prompts are instant.

## Open Questions

None blocking. Two items deferred to follow-up specs:

1. **Retire the four hand-rolled `sandbox_browser_*` wrappers in favor of `servers/browser/*`?** Decision deferred until we measure how the agent actually uses the new pattern. The hand-rolled wrappers stay in v1 as a hot-path affordance.
2. **Custom client-side variant of Tool Search Tool as an Anthropic-only optimization layer?** Possible Phase 3 work. Provider-conditional, additive, optional. Out of scope here.

## Out of Scope

- Adopting any Anthropic productized feature (`tool_search_tool_*`, `defer_loading`, `code_execution`, `input_examples`, `advanced-tool-use-2025-11-20` beta header).
- LangChain-bound MCP client (`MultiServerMCPClient` or any equivalent) in `apps/agents` runtime.
- Drift detection at startup (manifest hashing).
- Live-reload of the wrapper catalog.
- Retiring `sandbox_util_convert_to_markdown` or `sandbox_browser_*` hand-rolled wrappers.
- Re-architecting how skills are seeded into the orchestrator (`using-mcp-tools` slots into the existing barrel export).
- Any change to `meta-router.ts`, `state.ts`, `graph.ts`, the model tier registry, or the LangGraph node structure. This spec only touches tools, agents, prompts, skills, and the new bootstrap module.
