---
created: 2026-04-12
updated: 2026-04-12
tags: [langchain, langchain-core, chat-models]
sources: [raw/langchain/langchain/models.md]
---

# LangChain Chat Models

Chat models are the reasoning engine of LangChain-based applications. Every provider integration (OpenAI, Anthropic, Google, etc.) exposes the same `BaseChatModel` interface, so you can swap providers without rewriting application logic.

## Content

### What a Chat Model Is

A chat model takes a list of [[langchain-messages|messages]] as input and returns an `AIMessage` as output. Unlike legacy text-completion LLMs (which return plain strings), chat models always return structured message objects and support roles (`system`, `user`, `assistant`, `tool`).

Models are the reasoning engine of [[create-deep-agent|agents]]. They drive decision-making — choosing which tools to call, interpreting results, and generating final answers.

### Instantiation

Two paths:

**`initChatModel` (universal factory)**

```typescript
import { initChatModel } from "langchain";
const model = await initChatModel("claude-sonnet-4-6");
// or with provider prefix:
const model = await initChatModel("openai:gpt-4.1", { temperature: 0.7 });
```

See [[init-chat-model]] for full detail on the `provider:model` string format and extra-kwargs forwarding.

**Direct class instantiation**

```typescript
import { ChatAnthropic } from "@langchain/anthropic";
const model = new ChatAnthropic({ model: "claude-sonnet-4-6", apiKey: "..." });
```

Each provider ships its own package (`@langchain/openai`, `@langchain/anthropic`, `@langchain/google-genai`, etc.). See [[chat-openai]], [[chat-anthropic]], [[chat-google-generative-ai]] for provider-specific docs.

### Common Configuration Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `model` | string | — | Model name or `provider:model` |
| `apiKey` | string | — | Provider auth key |
| `temperature` | number | — | Randomness (0 = deterministic) |
| `maxTokens` | number | — | Max output length |
| `timeout` | number | — | Request timeout (seconds) |
| `maxRetries` | number | 6 | Auto-retry on 429/5xx; exponential backoff |

### Key Methods

The [[chat-model-interface]] article covers all methods in detail. Summary:

- `invoke(messages)` — single call, returns `AIMessage`
- `stream(messages)` — returns async iterator of `AIMessageChunk`
- `batch(messages[])` — parallel calls, returns `AIMessage[]`
- `streamEvents(input)` — semantic event stream (`on_chat_model_start`, `on_chat_model_stream`, `on_chat_model_end`)
- `withStructuredOutput(schema)` — see [[with-structured-output]]
- `bindTools(tools)` — see [[bind-tools]]

### Capabilities

Modern chat models support additional modalities beyond text:

- **Tool calling** — model requests external function calls; see [[bind-tools]]
- **Structured output** — constrained JSON/schema responses; see [[with-structured-output]]
- **Multimodal** — image/audio/video in content blocks
- **Reasoning** — multi-step chain-of-thought surfaced via `contentBlocks` with `type: "reasoning"`
- **Streaming** — real-time token output

### Model Profiles

`model.profile` (requires `langchain >= 1.1`) exposes capability metadata:

```typescript
model.profile;
// { maxInputTokens: 400000, imageInputs: true, toolCalling: true, ... }
```

Profiles power automatic structured-output strategy selection in `createAgent`, context window size checks in summarization middleware, and the DeepAgents CLI model switcher. Data is sourced from [models.dev](https://models.dev/) and augmented per-package. Profiles are beta — format may change.

### Nexus Usage

Nexus does not use `initChatModel` directly. Instead, `apps/agents/src/nexus/models/registry.ts` maintains a tier registry (`classifier`, `default`, `code`, `deep-research`, `image`) that instantiates provider-specific classes based on available environment variables. `resolveTier("<tier>")` returns a `BaseChatModel`. Runtime overrides flow through `configurable-model.ts` middleware via `context.models`.

## Related

- [[chat-model-interface]]
- [[init-chat-model]]
- [[with-structured-output]]
- [[bind-tools]]
- [[langchain-messages]]

## Sources

- `raw/langchain/langchain/models.md` — BaseChatModel overview, initialization, parameters, invocation methods, tool calling, structured output, advanced topics
