---
created: 2026-04-12
updated: 2026-04-12
tags: [langchain, langchain-core, messages, multimodal]
sources: [raw/langchain/langchain/messages.md]
---

# Multimodal Content

Multimodal content in LangChain refers to message payloads that contain non-text data — images, audio, video, files (PDF), or structured reasoning blocks. LangChain provides a cross-provider standard for these via the `ContentBlock` type hierarchy, accessible through the `contentBlocks` property on any [[langchain-messages|message]] object.

## Content

### Two representations

LangChain message `content` is loosely typed and accepts two formats:

1. **Provider-native** — e.g., OpenAI's `{ type: "image_url", image_url: { url: "..." } }`. Works immediately but is not portable.
2. **Standard content blocks** — LangChain's own `ContentBlock` union type. Cross-provider, type-safe, available via `message.contentBlocks` (lazy-parsed from `content`).

To serialize standard blocks into `content` for consumers outside LangChain:
- Set env var `LC_OUTPUT_VERSION=v1`, or
- Initialize the model with `outputVersion: "v1"`

### Standard content block types

#### Core blocks

| Type | Key fields | Purpose |
|------|-----------|---------|
| `ContentBlock.Text` | `type: "text"`, `text: string`, `annotations?: Citation[]` | Standard text output |
| `ContentBlock.Reasoning` | `type: "reasoning"`, `reasoning: string` | Model reasoning steps (from reasoning models) |

#### Multimodal blocks

All multimodal blocks share the same `source_type` pattern — `"url"`, `"base64"`, or `"id"` (provider-managed file):

| Type | type string | Notes |
|------|-------------|-------|
| `ContentBlock.Multimodal.Image` | `"image"` | `mimeType` required for base64 |
| `ContentBlock.Multimodal.Audio` | `"audio"` | `mimeType` required for base64 |
| `ContentBlock.Multimodal.Video` | `"video"` | `mimeType` required for base64 |
| `ContentBlock.Multimodal.File` | `"file"` | PDFs etc.; `mimeType` required for base64 |
| `ContentBlock.Multimodal.PlainText` | `"text-plain"` | `.txt`/`.md` document text |

#### Tool calling blocks (in AIMessage content)

| Type | type string | Purpose |
|------|-------------|---------|
| `ContentBlock.Tools.ToolCall` | `"tool_call"` | Structured function call |
| `ContentBlock.Tools.ToolCallChunk` | `"tool_call_chunk"` | Streaming partial tool call |
| `ContentBlock.Tools.InvalidToolCall` | `"invalid_tool_call"` | Malformed call with `error` field |
| `ContentBlock.Tools.ServerToolCall` | `"server_tool_call"` | Tool executed server-side |
| `ContentBlock.Tools.ServerToolResult` | `"server_tool_result"` | Result of server-side tool |

#### Escape hatch

`ContentBlock.NonStandard` — `type: "non_standard"`, `value: object` — for provider-unique experimental features.

### Building multimodal messages

Pass content blocks in the `content` array of a `HumanMessage`:

```typescript
import { HumanMessage } from "langchain";

// Image from URL
const msg = new HumanMessage({
  content: [
    { type: "text", text: "Describe this image." },
    { type: "image", source_type: "url", url: "https://example.com/photo.jpg" },
  ],
});

// Image from base64
const msg = new HumanMessage({
  content: [
    { type: "text", text: "What is in this image?" },
    { type: "image", source_type: "base64", data: "<base64string>", mimeType: "image/jpeg" },
  ],
});

// PDF from URL
const msg = new HumanMessage({
  content: [
    { type: "text", text: "Summarize this document." },
    { type: "file", source_type: "url", url: "https://example.com/doc.pdf", mime_type: "application/pdf" },
  ],
});

// Provider-managed file ID
const msg = new HumanMessage({
  content: [
    { type: "image", source_type: "id", id: "file-abc123" },
  ],
});
```

### Accessing contentBlocks

```typescript
import { ContentBlock } from "langchain";

const textBlock: ContentBlock.Text = { type: "text", text: "Hello world" };
const imageBlock: ContentBlock.Multimodal.Image = {
  type: "image",
  url: "https://example.com/image.png",
  mimeType: "image/png",
};

// On a received AIMessage:
const blocks = response.contentBlocks;
// blocks is ContentBlock.Standard[] — type-safe, provider-normalized
```

### Provider-specific caveats

- Not all models support all block types — check the provider's reference.
- Some providers (OpenAI, AWS Bedrock Converse) require a `filename` extra field for PDFs. Pass it at the top level of the content block or in `"extras": { "filename": "..." }`.
- `source_type: "id"` references provider-managed files uploaded via the Files API (OpenAI / Anthropic).

### Reasoning blocks

Reasoning models (Claude extended thinking, OpenAI `o3`) emit thinking in provider-native format. `contentBlocks` normalizes these into `ContentBlock.Reasoning`:

```typescript
// Anthropic "thinking" → ContentBlock.Reasoning
// OpenAI "reasoning" summary_text → ContentBlock.Reasoning
console.log(response.contentBlocks);
// [{ type: "reasoning", reasoning: "..." }, { type: "text", text: "..." }]
```

## Related

- [[langchain-messages]]
- [[ai-message]]
- [[langchain-models]]
- [[tool-message]]

## Sources

- `raw/langchain/langchain/messages.md` — multimodal content blocks, standard ContentBlock types, source_type patterns, reasoning normalization
