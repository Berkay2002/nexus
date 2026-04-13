---
created: 2026-04-13
updated: 2026-04-13
tags: [langchain, mcp, tool-call, aio-sandbox]
sources: [raw/langchain/langchain/mcp.md]
---

# @langchain/mcp-adapters

`@langchain/mcp-adapters` is the LangChain library that lets an agent consume tools hosted on one or more [Model Context Protocol](https://modelcontextprotocol.io/introduction) servers as ordinary [[langchain-tools|LangChain tools]]. The entry point is `MultiServerMCPClient` — you declare every server in a single config object, call `client.getTools()`, and hand the result to `createAgent` or [[create-deep-agent]]. The adapter handles session lifecycle, transport (stdio or streamable-http), and schema conversion so the agent code never sees raw MCP protocol traffic.

> **Relevance to Nexus:** This is the integration path for reaching the [[aio-sandbox-overview|AIO Sandbox]]'s MCP tool surface. Point `MultiServerMCPClient` at `http://localhost:8080/mcp` with `transport: "http"` and you get all 60 native sandbox tools (`chrome_devtools_*`, `browser_*`, `sandbox_*`) as LangChain tools in one call — see [Use from Nexus](#use-from-nexus) below.

## Installation

```bash
npm install @langchain/mcp-adapters
```

The library is distributed from the [langchainjs monorepo](https://github.com/langchain-ai/langchainjs/tree/main/libs/langchain-mcp-adapters).

## MultiServerMCPClient

`MultiServerMCPClient` is the single public class. Its constructor takes a record where each key is a logical server name and each value is a transport-specific config block. Both transport types can live in the same client — a math server over stdio and a weather server over HTTP coexist in the same map.

```typescript
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { createAgent } from "langchain";

const client = new MultiServerMCPClient({
  math: {
    transport: "stdio",
    command: "node",
    args: ["/absolute/path/to/math_server.js"],
  },
  weather: {
    transport: "http",
    url: "http://localhost:8000/mcp",
  },
});

const tools = await client.getTools();
const agent = createAgent({
  model: "claude-sonnet-4-6",
  tools,
});
```

`client.getTools()` returns a flat array of LangChain tools aggregated across every configured server — tools from `math` and `weather` arrive in the same array, already converted and ready to bind to a chat model (see [[bind-tools]]) or pass into an agent factory.

> **WARNING — Stateless by default:** `MultiServerMCPClient` is stateless. Every tool invocation creates a fresh MCP `ClientSession`, executes the tool, and tears the session down. This matters for stdio servers (each call spawns a subprocess) and for any HTTP server that tracks per-session state. If you need a long-lived session — to amortize connection cost, preserve server-side caches, or maintain a resource subscription — you will need to manage it outside the default path. The source docs do not document an opt-in stateful mode.

## Transports

MCP defines two wire formats. Both are configured per-server inside the `MultiServerMCPClient` constructor map.

### stdio

The client launches the server as a subprocess and reads/writes JSON-RPC frames on its standard I/O. Best for local tools you control — a TypeScript math server, a file-indexing helper, a shell wrapper — where spawning a process per session is acceptable.

```typescript
const client = new MultiServerMCPClient({
  math: {
    transport: "stdio",
    command: "node",
    args: ["/path/to/math_server.js"],
  },
});
```

Required fields: `transport: "stdio"`, `command`, `args`. The command is invoked with the args as argv, and the subprocess's stdout/stdin carry the MCP protocol.

### HTTP (Streamable HTTP)

Also called `streamable-http` — the current HTTP-based MCP transport. The client posts JSON-RPC frames to an HTTP endpoint and reads the server's responses. Use this for remote or daemonized servers, or whenever process-per-invocation is too expensive.

```typescript
const client = new MultiServerMCPClient({
  weather: {
    transport: "http",
    url: "http://localhost:8000/mcp",
  },
});
```

> **Note — `"sse"` vs `"http"` in the docs:** The LangChain docs include a second example under the HTTP section that uses `transport: "sse"` rather than `transport: "http"`. The prose describes the transport as "`http` (also referred to as `streamable-http`)", and the primary quickstart example uses `"http"`. Treat `"http"` as the current spelling; the `"sse"` form may be a legacy alias or a stale example. [unverified — the source does not reconcile the two spellings]. If you hit a transport-resolution error, prefer `"http"`.

The MCP transport spec that governs the wire format is the [Streamable HTTP spec](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http).

#### Passing headers / authentication

The LangChain source docs include empty `#### Passing headers` and `#### Authentication` subsections under the HTTP transport — the content was not filled in upstream. Both features are presumed supported (the underlying MCP client does accept headers) but the TypeScript docs give no concrete syntax. Check the [library source](https://github.com/langchain-ai/langchainjs/tree/main/libs/langchain-mcp-adapters) for the current config shape when you need them.

## Loading tools

Once the client is constructed, `client.getTools()` is the only call you need:

```typescript
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { createAgent } from "langchain";

const client = new MultiServerMCPClient({ /* ... */ });
const tools = await client.getTools();
const agent = createAgent({ model: "claude-sonnet-4-6", tools });
```

The returned tools are standard LangChain tools — they have `name`, `description`, and a Zod/JSON-Schema-derived argument schema, and they can be mixed freely with locally-defined tools built via the [[tool-decorator|`tool()` factory]]. The [[tool-call|tool-call round-trip]] (AI message → ToolCall → execution → ToolMessage) works exactly the same way; agents cannot tell MCP-backed tools apart from native ones.

## Building your own MCP server

`@langchain/mcp-adapters` is strictly a **client** library. To write a server that other LangChain agents can connect to, you use `@modelcontextprotocol/sdk` — the official MCP TypeScript SDK — directly:

```bash
npm install @modelcontextprotocol/sdk
```

The SDK exposes `Server`, request-handler schemas (`ListToolsRequestSchema`, `CallToolRequestSchema`), and transport classes (`StdioServerTransport`, `SSEServerTransport`). A minimal stdio math server registers two tools, handles `tools/list` and `tools/call`, and connects to a `StdioServerTransport`; a minimal HTTP weather server does the same but wraps the transport in an Express `POST /mcp` route. See `raw/langchain/langchain/mcp.md` for the full worked examples of both.

Server-side code is out of scope for Nexus itself — Nexus consumes MCP tools from the AIO Sandbox, it does not host them — but the SDK is the authoritative reference if you ever need to spin up a custom tool server (e.g., to expose a private dataset to a LangGraph agent without routing through the sandbox).

## Use from Nexus

The AIO Sandbox's [Streamable HTTP MCP endpoint at `POST /mcp`](../#) (proxied by nginx to the internal `mcp-hub` on port 8079) exposes **60 tools** in a flat namespace across three internal servers: `chrome_devtools_*` (27), `browser_*` (23), and `sandbox_*` (10). The right way for Nexus sub-agents to reach those tools is a `MultiServerMCPClient` configured with a single streamable-http entry:

```typescript
import { MultiServerMCPClient } from "@langchain/mcp-adapters";

const client = new MultiServerMCPClient({
  aio: {
    transport: "http",
    url: "http://localhost:8080/mcp",
  },
});

const mcpTools = await client.getTools();
// mcpTools now contains all 60 sandbox tools, name-prefixed by internal server:
//   chrome_devtools_navigate, chrome_devtools_list_network_requests, ...
//   browser_click, browser_get_markdown, ...
//   sandbox_execute_code, sandbox_execute_bash, ...
```

Once you have `mcpTools`, split the array by prefix and hand the relevant subset to each sub-agent's `tools` field in its `SubAgent` config. The routing intent (from the 2026-04-13 sandbox-runtime-tools discovery):

- **Research sub-agent** → `tavily_*` (native) + `browser_*` + `chrome_devtools_*` for web automation, performance traces, and network inspection.
- **Code sub-agent** → `sandbox_execute_code` + `sandbox_jupyter_*` + `sandbox_nodejs_*` + `chrome_devtools_*` for UI testing of built apps plus perf/network debugging.
- **Creative sub-agent** → native `generate_image` only; no MCP tools.

> **WARNING — Do NOT use the `/v1/mcp/*` JSON gateway for this.** The AIO Sandbox also exposes a REST-style JSON gateway at `/v1/mcp/servers`, `/v1/mcp/{server}/tools`, and `/v1/mcp/{server}/tools/{tool}` (documented at [[aio-sandbox-mcp-api]]). That gateway is **half-broken** as of the 2026-04-13 verification on `ghcr.io/agent-infra/sandbox:latest`: it successfully proxies streamable-http-backed servers (`browser`, `sandbox`) but **fails on stdio-backed servers** like `chrome_devtools` with the error `MCP server 'chrome_devtools' not found in configuration`. mcp-hub itself has the server connected (`/var/log/gem/mcp-hub.log` shows `'chrome_devtools' MCP server connected` and `3/3 servers started successfully`) — the bug is in the gateway layer. The `/mcp` Streamable HTTP endpoint is the canonical, working interface and returns all 60 tools; the `/v1/mcp/*` gateway tops out at the browser/sandbox subset, and even those are coarser than the native names. Prefer `@langchain/mcp-adapters` + `/mcp` every time.

> **Historical context — the hand-rolled gateway tools are the wrong abstraction:** Nexus previously shipped three hand-rolled tools (`mcp-list-servers`, `mcp-list-tools`, `mcp-execute-tool`) under `apps/agents/src/nexus/tools/` that wrapped the broken `/v1/mcp/*` JSON gateway and exposed it as three generic dispatch tools. Those hide 57 of the 60 available tools behind a dynamic-lookup API the model has to navigate at runtime. The `@langchain/mcp-adapters` path replaces them with 60 statically-named tools whose schemas are visible to the model at bind time — strictly a better shape. When that wiring lands, retire the manual gateway tools.

## Quickstart checklist

1. `npm install @langchain/mcp-adapters` in `apps/agents`.
2. Construct a single `MultiServerMCPClient` at agent-factory time, pointed at `http://localhost:8080/mcp` (or whatever `NEXUS_SANDBOX_URL + "/mcp"` resolves to).
3. `await client.getTools()` once per process startup and cache the result — a fresh session is created per call regardless, but the tool-metadata fetch round-trips the server.
4. Partition the tool array by name prefix and attach the relevant subset to each `SubAgent`'s `tools` field.
5. Do not wrap the tools again — they're already LangChain tools, so they compose directly with [[bind-tools]] and [[create-deep-agent]].
6. When debugging "server not found" errors, check `/var/log/gem/mcp-hub.log` inside the sandbox container to confirm mcp-hub has the server connected.

## Related

- [[aio-sandbox-mcp-api]] — the `/v1/mcp/*` JSON gateway on the sandbox (the alternative, half-broken path; contrast with this article)
- [[aio-sandbox-features]] — umbrella page listing the sandbox's MCP surface alongside shell/file/browser/Jupyter
- [[langchain-tools]] — the tool system the adapter produces
- [[tool-decorator]] — the `tool()` factory for building native LangChain tools side-by-side with MCP-backed ones
- [[tool-call]] — the ToolCall round-trip that MCP-backed tools participate in
- [[bind-tools]] — how tools attach to a chat model
- [[create-deep-agent]] — where the aggregated tool array lands in the Nexus orchestrator setup
- [[subagents]] — how sub-agents receive their partitioned tool subsets

## Sources

- `raw/langchain/langchain/mcp.md` — `@langchain/mcp-adapters` quickstart, `MultiServerMCPClient` API, stateless default note, stdio + HTTP transport config, `client.getTools()` flow, and the `@modelcontextprotocol/sdk` custom-server math/weather examples.
- User auto-memory `aio_sandbox_mcp.md` (2026-04-13) — AIO Sandbox MCP surface verification: 60 tools behind `/mcp`, half-broken `/v1/mcp/*` gateway, mcp-hub internals, and the Nexus routing intent. Cited as the source for the "Use from Nexus" section.
