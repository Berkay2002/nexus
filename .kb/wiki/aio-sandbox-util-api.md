---
created: 2026-04-13
updated: 2026-04-13
tags: [aio-sandbox, tool-call]
sources: [raw/aio-sandbox/openapi.json]
---

# AIO Sandbox Util API

The `util` surface of the [[aio-sandbox-overview|AIO Sandbox]] currently exposes a single endpoint: `POST /v1/util/convert_to_markdown`. It converts an arbitrary document — identified by a URI — into Markdown text, making it easy to feed PDFs, HTML pages, Word documents, and other rich formats to an LLM context window without a separate parsing step.

## /v1/util/convert_to_markdown

**POST** `/v1/util/convert_to_markdown`

Converts the resource at the given URI to Markdown and returns the result. The description in the spec says "Convert a given URI to Markdown format", keeping the contract intentionally broad: any URI the sandbox container can resolve is valid.

**Request body** (`application/json`, required): `UtilConvertToMarkdownRequest`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `uri` | string | yes | URI of the resource to convert. Can be a `file://` path inside the sandbox, an `http(s)://` URL, or any scheme the container runtime can fetch. |

**Responses**

| Status | Schema | Notes |
|--------|--------|-------|
| 200 | `Response` | Generic envelope — actual Markdown is in `data`. |
| 422 | `HTTPValidationError` | Pydantic validation failure (e.g. missing `uri`). |

> **Note:** There is no file-upload field in the request body. Content must be addressable by URI from inside the sandbox container. For files already on the sandbox filesystem, use a `file://` URI or an absolute path string. Content that lives only on the host machine must be copied into the sandbox first (via the [[aio-sandbox-file-api|file API]]) before this endpoint can reach it.

## Schemas

```typescript
// Request
interface UtilConvertToMarkdownRequest {
  uri: string;          // required — URI of the resource to convert
}

// Response envelope (shared across AIO Sandbox APIs)
interface Response {
  success: boolean;     // default: true
  message: string | null; // default: "Operation successful"
  data: unknown | null; // actual Markdown string on success
}

// Validation error (422)
interface HTTPValidationError {
  detail: ValidationError[];
}
interface ValidationError {
  loc: (string | number)[];
  msg: string;
  type: string;
}
```

The Markdown output is carried in `data`. No additional fields are documented — callers should treat `data` as a string when `success` is `true`.

## Use from Nexus

The research sub-agent can call this endpoint to ingest any document that needs LLM-readable text: a PDF downloaded from a search result, a DOCX attachment, or an HTML page already cached on the sandbox filesystem. The returned Markdown typically gets written to `/home/gem/workspace/research/task_{id}/sources/` so the orchestrator and other agents can reference it as plain text.

This endpoint is functionally adjacent to [[tavily-extract-api|Tavily Extract]], which also produces Markdown from a source URL. The key distinction is locality: Tavily Extract makes an outbound network request to a live URL and is limited to public web content. `convert_to_markdown` runs entirely inside the sandbox container, so it handles local files, private intranet URLs reachable from the container, and formats (PDF, DOCX) that Tavily does not support. The two approaches are complementary — use Tavily Extract for fresh web content and this endpoint for files the agent has already acquired.

## Related

- [[aio-sandbox-overview]]
- [[aio-sandbox-openapi-overview]]
- [[aio-sandbox-file-api]]
- [[tavily-extract-api]]

## Sources

- `raw/aio-sandbox/openapi.json` — path `/v1/util/convert_to_markdown`; schemas: `UtilConvertToMarkdownRequest`, `Response`, `HTTPValidationError`, `ValidationError`
