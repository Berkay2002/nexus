---
created: 2026-04-13
updated: 2026-04-13
tags: [aio-sandbox, mcp, tool-call]
sources: [raw/aio-sandbox/openapi.json]
---

# AIO Sandbox MCP API

The [[aio-sandbox-overview|AIO Sandbox]] bundles an MCP (Model Context Protocol) gateway that manages a registry of MCP servers on behalf of the agent. Three JSON API endpoints — accessible under `/v1/mcp/*` — let a Nexus sub-agent enumerate registered servers, discover the tools each server exposes, and invoke those tools by name, all without instantiating its own MCP client or managing transport lifecycle.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/v1/mcp/servers` | List all MCP servers registered in the sandbox |
| `GET` | `/v1/mcp/{server_name}/tools` | List tools exposed by one named server |
| `POST` | `/v1/mcp/{server_name}/tools/{tool_name}` | Execute a named tool with JSON arguments |

> **Note — Streamable HTTP transport vs. JSON API:** The spec's info block describes `/mcp` and `/v1/mcp` (without trailing path segments) as the Streamable HTTP MCP transport endpoints — these implement the low-level MCP protocol wire format and are NOT the same as the `/v1/mcp/*` JSON convenience API documented here. Use the JSON API for agent-side tool calls; use the Streamable HTTP endpoints only if you need direct MCP protocol access.

## Endpoint Detail

### GET /v1/mcp/servers

Returns a flat list of all configured MCP server names. The response is wrapped in the standard sandbox envelope (`success`, `message`, `data`), where `data` is a `string[]`.

**Parameters:** none.

**Response — `Response_List_str_`:**
```json
{
  "success": true,
  "message": "Operation successful",
  "data": ["github", "filesystem", "brave-search"]
}
```

> **Note — Server registration is config-time:** The OpenAPI spec does not describe a registration endpoint. Servers are presumed to be configured at sandbox startup via `mcp-servers.json` (referenced in the endpoint descriptions). The `GET /v1/mcp/servers` call reports the filtered list of what was configured; you cannot register servers at runtime through this API.

---

### GET /v1/mcp/{server_name}/tools

Returns the full tool manifest for one server, including each tool's name, description, and JSON Schema for its input parameters.

**Path parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `server_name` | `string` | yes | Name of the MCP server as defined in `mcp-servers.json` |

**Response — `Response_ListToolsResultModel_`:**
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    "tools": [ /* Tool[] */ ],
    "nextCursor": null,
    "_meta": null
  }
}
```

The `data` object is a `ListToolsResult`. `nextCursor` is present for paginated tool lists (pass it as a query parameter on a subsequent call if the server supports pagination — the OpenAPI spec does not define the parameter but the field appears in the schema). `tools` is an array of `Tool` objects (see Schemas).

---

### POST /v1/mcp/{server_name}/tools/{tool_name}

Executes a single MCP tool synchronously and returns the result content blocks.

**Path parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `server_name` | `string` | yes | Name of the MCP server |
| `tool_name` | `string` | yes | Name of the tool to execute |

**Request body:** A JSON object with arbitrary key/value pairs matching the tool's `inputSchema`. An empty object `{}` is the default if no arguments are needed.

```json
{ "query": "typescript MCP sdk" }
```

**Response — `Response_CallToolResultModel_`:**
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    "content": [ /* content blocks — see Tool Result Model */ ],
    "structuredContent": null,
    "isError": false,
    "_meta": null
  }
}
```

> **Warning — `isError` is NOT reflected in HTTP status:** A `200 OK` response can carry `data.isError: true`. This means the HTTP call succeeded but the MCP tool itself reported an error. Always check `data.isError` before processing content blocks — do not assume a 200 means the tool produced valid output.

## Tool Result Model

The `data` field of a `CallToolResult` contains:

| Field | Type | Description |
|-------|------|-------------|
| `content` | `ContentBlock[]` | Required. Array of polymorphic content blocks (see below). |
| `structuredContent` | `object \| null` | Optional machine-readable structured output alongside content. |
| `isError` | `boolean` | `false` by default. `true` signals the MCP tool reported a failure — even though HTTP returned 200. |
| `_meta` | `object \| null` | Arbitrary protocol metadata. |

### Content Block Polymorphism

Each element of `content` is one of five block types, distinguished by the `type` string field:

| `type` value | Schema | Description |
|--------------|--------|-------------|
| `"text"` | `TextContent` | Plain text result. `text: string` is required. |
| `"image"` | `ImageContent` | Base64-encoded image. `data: string` (base64) + `mimeType: string` required. |
| `"audio"` | `AudioContent` | Base64-encoded audio. `data: string` (base64) + `mimeType: string` required. |
| `"resource_link"` | `ResourceLink` | Reference to a readable resource by URI; may not appear in `resources/list`. `name`, `uri`, and `type` required. |
| _(embedded)_ | `EmbeddedResource` | Full resource contents embedded inline. `resource` is either `TextResourceContents` or `BlobResourceContents`. `type` required. |

> **Note — `type` as discriminator:** The OpenAPI spec defines all `type` fields as plain `string` without explicit enum values for most blocks. Use the `type` value at runtime to branch handling: `"text"` is the common case; `"image"` and `"audio"` carry base64 data; `EmbeddedResource` and `ResourceLink` carry structured resource references.

All content block types support an optional `annotations` field (`Annotations`) and an optional `_meta` object.

## Schemas

### Tool

Definition of a callable tool, returned inside `ListToolsResult.tools`.

```typescript
interface Tool {
  name: string;                      // required — tool identifier
  title?: string | null;
  description?: string | null;
  inputSchema: object;               // required — JSON Schema for arguments
  outputSchema?: object | null;
  icons?: Icon[] | null;
  annotations?: ToolAnnotations | null;
  _meta?: Record<string, unknown> | null;
}
```

### ToolAnnotations

Hints about tool behavior. Per the spec: **all properties are hints and must not be trusted from untrusted servers**.

```typescript
interface ToolAnnotations {
  title?: string | null;
  readOnlyHint?: boolean | null;     // tool does not modify state
  destructiveHint?: boolean | null;  // tool may have destructive side effects
  idempotentHint?: boolean | null;   // repeated calls have same effect
  openWorldHint?: boolean | null;    // tool interacts with external/open world
}
```

### Annotations

Routing hints attached to content blocks and resource links.

```typescript
interface Annotations {
  audience?: ("user" | "assistant")[] | null;  // who the content targets
  priority?: number | null;                    // 0.0–1.0, display priority
}
```

### Icon

Display icon for tools or resource links in user interfaces.

```typescript
interface Icon {
  src: string;               // required — URL or data URI
  mimeType?: string | null;
  sizes?: string[] | null;   // e.g. ["16x16", "32x32"]
}
```

### Content block types

```typescript
interface TextContent {
  type: string;              // "text"
  text: string;              // required
  annotations?: Annotations | null;
  _meta?: Record<string, unknown> | null;
}

interface ImageContent {
  type: string;              // "image"
  data: string;              // required — base64
  mimeType: string;          // required
  annotations?: Annotations | null;
  _meta?: Record<string, unknown> | null;
}

interface AudioContent {
  type: string;              // "audio"
  data: string;              // required — base64
  mimeType: string;          // required
  annotations?: Annotations | null;
  _meta?: Record<string, unknown> | null;
}

interface ResourceLink {
  type: string;              // required
  name: string;              // required
  uri: string;               // required
  title?: string | null;
  description?: string | null;
  mimeType?: string | null;
  size?: number | null;
  icons?: Icon[] | null;
  annotations?: Annotations | null;
  _meta?: Record<string, unknown> | null;
}

interface EmbeddedResource {
  type: string;              // required
  resource: TextResourceContents | BlobResourceContents; // required
  annotations?: Annotations | null;
  _meta?: Record<string, unknown> | null;
}

interface TextResourceContents {
  uri: string;               // required
  text: string;              // required
  mimeType?: string | null;
  _meta?: Record<string, unknown> | null;
}

interface BlobResourceContents {
  uri: string;               // required
  blob: string;              // required — base64
  mimeType?: string | null;
  _meta?: Record<string, unknown> | null;
}
```

### Response Wrappers

All three endpoints return the same envelope shape — only `data` differs:

```typescript
// Standard sandbox response envelope
interface SandboxResponse<T> {
  success: boolean;             // default true
  message: string | null;       // default "Operation successful"
  data: T | null;
}

// GET /v1/mcp/servers
type Response_List_str_ = SandboxResponse<string[]>;

// GET /v1/mcp/{server_name}/tools
interface ListToolsResult {
  tools: Tool[];               // required
  nextCursor?: string | null;
  _meta?: Record<string, unknown> | null;
}
type Response_ListToolsResultModel_ = SandboxResponse<ListToolsResult>;

// POST /v1/mcp/{server_name}/tools/{tool_name}
interface CallToolResult {
  content: (TextContent | ImageContent | AudioContent | ResourceLink | EmbeddedResource)[];  // required
  structuredContent?: Record<string, unknown> | null;
  isError?: boolean;           // default false
  _meta?: Record<string, unknown> | null;
}
type Response_CallToolResultModel_ = SandboxResponse<CallToolResult>;
```

## Use from Nexus

Nexus sub-agents (Research, Code, Creative) can call MCP tools through this gateway by issuing HTTP requests to the [[aio-sandbox-overview|AIO Sandbox]] rather than wiring up their own MCP client in the LangGraph process. The sandbox handles all MCP transport details — stdio process management, Streamable HTTP connections, authentication, and server lifecycle — so the agent only needs to know the server name, tool name, and argument schema.

A practical integration pattern is to wrap these three endpoints as [[langchain-tools|LangChain tools]] using the [[tool-decorator|`tool()` decorator]] with Zod schemas, then include them in a sub-agent's tool list. The agent can first call `list_mcp_servers` and `list_mcp_tools` to discover capabilities dynamically, then call `execute_mcp_tool` to act. When consuming results, always check `data.isError` before treating the content array as a success response.

## Related

- [[aio-sandbox-overview]]
- [[aio-sandbox-features]]
- [[langchain-tools]]
- [[tool-call]]
- [[tool-decorator]]
- [[agent-infra-sandbox-sdk]]

## Sources

- `raw/aio-sandbox/openapi.json` — paths `/v1/mcp/servers`, `/v1/mcp/{server_name}/tools`, `/v1/mcp/{server_name}/tools/{tool_name}`; schemas: `Tool`, `ToolAnnotations`, `Annotations`, `Icon`, `TextContent`, `ImageContent`, `AudioContent`, `ResourceLink`, `EmbeddedResource`, `TextResourceContents`, `BlobResourceContents`, `Response_CallToolResultModel_`, `Response_ListToolsResultModel_`, `Response_List_str_`, `HTTPValidationError`, `ValidationError`
