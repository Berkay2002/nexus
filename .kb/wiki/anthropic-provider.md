---
created: 2026-04-12
updated: 2026-04-12
tags: [anthropic, langchain, provider, claude, tier-routing]
sources: [raw/langchain/providers/anthropic/anthropic.md]
---

# Anthropic Provider (`@langchain/anthropic`)

The `@langchain/anthropic` package is the official LangChain.js integration for Anthropic's Claude models. It exports `ChatAnthropic`, the primary class used to instantiate Claude models within any LangChain or [[deepagents-models|DeepAgents]] pipeline.

## Content

### Installation

```bash
npm install @langchain/anthropic @langchain/core
```

Nexus pins `@langchain/core` via `overrides` in `package.json` to ensure a single shared instance across all LangChain packages. The same pattern applies here.

### Environment Variable

```bash
export ANTHROPIC_API_KEY=your-api-key
```

Nexus auto-detects this variable at startup via `apps/agents/src/nexus/preflight.ts`. When present, Anthropic becomes an available provider in the tier registry and is assigned high priority for the `classifier`, `default`, and `code` tiers.

### Core Export: `ChatAnthropic`

```typescript
import { ChatAnthropic } from "@langchain/anthropic";

const model = new ChatAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: "claude-sonnet-4-6",
});
```

`ChatAnthropic` supports `.invoke()`, `.stream()`, and `.bindTools()`. It is also accessible via the provider-agnostic string `"anthropic:claude-sonnet-4-6"` through [[init-chat-model]].

### Supported Models

Models validated for agent workloads (from the [[deepagents-models]] eval table):

| Model ID | Notes |
|---|---|
| `claude-opus-4-6` | Highest capability, deep-research tier |
| `claude-sonnet-4-6` | Balanced capability/cost, default and code tiers |
| `claude-haiku-4-5` | Fast and cheap, classifier tier |

Model IDs follow the pattern `claude-{family}-{version}`. Pass them as the `model` constructor parameter.

### Streaming

```typescript
const stream = await model.stream({ role: "user", content: "Hello" });
for await (const chunk of stream) { /* ... */ }
```

Streaming is first-class — the same `.stream()` method works for token-by-token output. DeepAgents' subgraph streaming builds on top of this via the LangGraph protocol.

### Built-in Tool Suite

The package exports a `tools` namespace with Anthropic-hosted tools that Claude can invoke server-side without additional infrastructure:

| Export | Description |
|---|---|
| `tools.memory_20250818` | Persistent file-backed memory across sessions |
| `tools.webSearch_20250305` | Real-time web search with automatic citations |
| `tools.webFetch_20250910` | Fetch full content from specified URLs or PDFs |
| `tools.textEditor_20250728` | View and modify text files (view, str_replace, create, insert) |
| `tools.bash_20250124` | Persistent bash session execution |
| `tools.codeExecution_20250825` | Sandboxed code execution with container reuse |
| `tools.computer_20250124` / `computer_20251124` | Desktop screenshot + mouse/keyboard control |
| `tools.toolSearchRegex_20251119` / `toolSearchBM25_20251119` | Dynamic tool discovery from large tool sets |
| `tools.mcpToolset_20251120` | Connect to remote MCP servers via the Messages API |

Tools are bound via `model.bindTools([...])`. Each tool factory accepts an options object for configuration (e.g., `maxUses`, `allowedDomains`, `citations`).

### Nexus Tier Routing

In Nexus, Anthropic is one of four auto-detected providers. The tier priority order in `apps/agents/src/nexus/models/registry.ts` is:

- **`classifier`**: Google → Anthropic → OpenAI → Z.AI
- **`default`**: Anthropic → OpenAI → Z.AI → Google
- **`code`**: Anthropic → Google → OpenAI → Z.AI
- **`deep-research`**: Google → Anthropic → OpenAI → Z.AI

Anthropic is the preferred provider for `default` and `code` tiers when available. The [[chat-anthropic]] class is what `resolveTier("default")` returns when `ANTHROPIC_API_KEY` is set.

### `@langchain/core` Pinning

Because multiple LangChain packages must share one `@langchain/core` instance, Nexus enforces a version override. Add to `package.json`:

```json
{
  "overrides": { "@langchain/core": "^0.3.0" },
  "resolutions": { "@langchain/core": "^0.3.0" }
}
```

## Related

- [[chat-anthropic]]
- [[deepagents-models]]
- [[init-chat-model]]
- [[langchain-models]]
- [[config-runtime-context]]

## Sources

- `raw/langchain/providers/anthropic/anthropic.md` — installation, ChatAnthropic usage, streaming, built-in tools suite, class/interface/type reference
