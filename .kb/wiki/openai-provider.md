---
created: 2026-04-12
updated: 2026-04-12
tags: [openai, langchain, provider, gpt, zai]
sources: [raw/langchain/providers/openai/openai.md]
---

# OpenAI Provider (`@langchain/openai`)

The `@langchain/openai` npm package is the official LangChain.js integration for OpenAI models. In Nexus it serves double duty: it powers the OpenAI provider tier directly **and** supplies the `ChatOpenAI` base class that `ZaiChatOpenAI` subclasses to talk to Z.AI's OpenAI-compatible endpoint.

## Installation

```bash
npm install @langchain/openai @langchain/core
```

Pin `@langchain/core` to the same version across all workspace packages (Nexus uses the `overrides` field in the root `package.json` for this):

```json
{
  "overrides": { "@langchain/core": "^0.3.0" }
}
```

## Environment Variables

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | Required. Authenticates all OpenAI API calls. |
| `OPENAI_ORGANIZATION` | Optional. Scopes usage/billing to an organization. |

## Key Exported Classes

| Class | Description |
|---|---|
| `ChatOpenAI` | Primary chat model class. Accepts `apiKey`, `model`, `temperature`, etc. |
| `OpenAIEmbeddings` | Text embedding model (e.g., `text-embedding-3-small`). |
| `AzureChatOpenAI` | Azure-hosted variant; reads `AZURE_OPENAI_API_KEY` / deployment config. |
| `DallEAPIWrapper` | Thin wrapper for the DALL-E image generation REST endpoint. |

## Basic Usage

```typescript
import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-4o",
});
const response = await model.invoke("Hello world!");
```

Streaming works the same way via `.stream()` instead of `.invoke()`.

## Supported Models

- **GPT-4.x series** — `gpt-4o`, `gpt-4-1106-preview`, `gpt-4.1`, `gpt-4.1-mini`, `gpt-4.1-nano`
- **GPT-5 series** — `gpt-5`, `gpt-5.1` (deep research / agentic coding)
- **o-series (reasoning)** — `o3`, `o3-deep-research`
- **Codex** — `codex-mini-latest`
- **Computer use** — `computer-use-preview`

## Built-in Responses API Tools

The package exports a `tools` namespace with wrappers for OpenAI's Responses API hosted tools:

- **`tools.webSearch()`** — live web search with domain filtering and geolocation; supports non-reasoning, agentic, and deep-research modes
- **`tools.mcp()`** — connects to remote Model Context Protocol servers or OpenAI service connectors (Google Workspace, Dropbox, etc.)
- **`tools.codeInterpreter()`** — sandboxed Python execution; configurable memory (1 GB–64 GB) and file uploads
- **`tools.fileSearch()`** — semantic + keyword retrieval from vector stores
- **`tools.imageGeneration()`** — text-to-image and multi-turn editing via GPT Image; supports size, quality, format, transparency, and partial streaming
- **`tools.computerUse()`** — CUA-based screen control (beta); loop of action → screenshot → repeat
- **`tools.localShell()`** — shell command execution for `codex-mini-latest`
- **`tools.shell()`** — concurrent multi-command shell for `gpt-5.1`
- **`tools.applyPatch()`** — structured V4A diff application for code editing workflows with `gpt-5.1`

## How Nexus Uses This Package

### OpenAI Tier

When `OPENAI_API_KEY` is set, [[deepagents-models]] (the Nexus tier registry at `apps/agents/src/nexus/models/`) auto-detects the OpenAI provider and routes `default`, `code`, and `classifier` tiers to `ChatOpenAI`. Priority relative to other providers is: Anthropic → OpenAI → Z.AI → Google for `default`; Google → Anthropic → OpenAI → Z.AI for `classifier`.

### Z.AI / GLM Base Class

`ZaiChatOpenAI` (at `apps/agents/src/nexus/models/zai-chat-model.ts`) subclasses `ChatOpenAI` and overrides the base URL to point at Z.AI's OpenAI-compatible endpoint (`https://api.z.ai/api/paas/v4`). No extra package is needed — it reuses `@langchain/openai`'s entire HTTP client, auth, and streaming stack. The subclass adds one thing: it round-trips `reasoning_content` through `additional_kwargs` to preserve GLM thinking tokens across multi-turn tool calls, which the raw `ChatOpenAI` class would silently drop. See [[chat-openai]] for the base class API.

## Related

- [[chat-openai]]
- [[deepagents-models]]
- [[langchain-models]]
- [[anthropic-provider]]
- [[init-chat-model]]

## Sources

- `raw/langchain/providers/openai/openai.md` — package overview: installation, env vars, classes, Responses API tools, streaming
