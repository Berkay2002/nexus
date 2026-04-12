---
created: 2026-04-12
updated: 2026-04-12
tags: [openai, chat-model, gpt, langchain, tool-call, reasoning]
sources: [raw/langchain/providers/openai/openai-chat.md]
---

# ChatOpenAI

The primary chat model class from `@langchain/openai`, implementing the [[chat-model-interface]] for OpenAI's GPT family. In Nexus, it is the direct base class for `ZaiChatOpenAI`, which reuses it pointed at Z.AI's OpenAI-compatible endpoint and adds `reasoning_content` round-tripping to preserve GLM thinking across multi-turn tool calls.

## Content

### Installation and setup

```bash
npm install @langchain/openai
export OPENAI_API_KEY="your-api-key"
```

Part of the [[openai-provider]] package (`@langchain/openai`). For Azure use `AzureChatOpenAI` instead.

### Constructor parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `model` | string | — | Model ID, e.g. `"gpt-4o-mini"`, `"gpt-4o"`, `"o3"`, `"o4-mini"` |
| `temperature` | number | 1 | Sampling temperature. Set `0` for deterministic output. Not supported on reasoning (o-series) models |
| `maxTokens` | number | undefined | Max completion tokens |
| `apiKey` | string | env `OPENAI_API_KEY` | OpenAI API key |
| `configuration.baseURL` | string | — | Override for OpenAI-compatible endpoints (e.g. Z.AI, local vLLM) |
| `organization` | string | — | OpenAI org ID |
| `timeout` | number | — | Request timeout in ms |
| `maxRetries` | number | 2 | Auto-retry on transient errors |
| `streaming` | boolean | false | Enable token streaming |
| `streamUsage` | boolean | — | Include usage metadata in streamed chunks |
| `logprobs` | boolean | false | Return per-token log probabilities |
| `topLogprobs` | number | — | Number of top log-probability tokens per position |
| `reasoning` | object | — | Reasoning config for o-series models (see below) |
| `modalities` | string[] | — | Output modalities, e.g. `["text", "audio"]` |
| `audio` | object | — | Audio output config: `{ voice, format }` |
| `n` | number | 1 | Number of completions to generate |
| `frequencyPenalty` | number | 0 | Penalise repeated tokens |
| `presencePenalty` | number | 0 | Penalise tokens already present in context |
| `topP` | number | 1 | Nucleus sampling threshold |
| `stop` / `stopSequences` | string[] | — | Stop sequences |
| `modelKwargs` | object | — | Extra params forwarded to the API |
| `useResponsesApi` | boolean | — | Use the `/responses` API endpoint |

### Runtime args (call options)

Pass as the second argument to `.invoke()`, `.stream()`, `.batch()`, or via `.withConfig()` / `.bindTools()`:

```typescript
// via withConfig
const llm = model.withConfig({ stop: ["\n"], tools: [...] });

// via bindTools (tools as first arg, call options as second)
const llmWithTools = model.bindTools([...], { tool_choice: "auto" });
```

### Invoke and stream

`.invoke(input)` accepts a string, a list of [[langchain-messages]], or a formatted prompt. Returns an `AIMessage`.

`.stream(input)` returns an async iterable of `AIMessageChunk`. Aggregate with `concat` from `@langchain/core/utils/stream`.

`.batch([inputs])` runs multiple calls in parallel.

Response metadata on `AIMessage`:

```typescript
{
  tokenUsage: { completionTokens, promptTokens, totalTokens },
  finish_reason: "stop",
  system_fingerprint: "fp_..."
}
```

Usage is also available at `aiMsg.usage_metadata` as `{ input_tokens, output_tokens, total_tokens }`.

### Tool calling with bindTools

Use [[bind-tools]] (`.bindTools()`) to attach tools defined as Zod schemas or LangChain tool objects. The model returns `tool_calls` on `AIMessage`:

```typescript
const llmWithTools = llm.bindTools([GetWeather, GetPopulation]);
const aiMsg = await llmWithTools.invoke("Which city is hotter: LA or NY?");
console.log(aiMsg.tool_calls);
// [{ name: 'GetWeather', args: { location: 'Los Angeles, CA' }, type: 'tool_call', id: '...' }, ...]
```

Pass `{ strict: true }` to enforce the tool schema exactly (OpenAI strict mode).

### Structured output with withStructuredOutput

`.withStructuredOutput(schema, options)` wraps the model to return a typed object:

```typescript
const structuredLlm = llm.withStructuredOutput(JokeSchema, { name: "Joke", strict: true });
const result = await structuredLlm.invoke("Tell me a joke about cats");
// result: { setup: "...", punchline: "...", rating: 7 }
```

Two methods available: default (function-calling under the hood) and `"jsonSchema"` (native JSON schema response format, supported on `gpt-4o-2024-08-06` and later).

For freeform JSON without schema enforcement, use `.withConfig({ response_format: { type: "json_object" } })`.

### Reasoning models (o-series, GPT-5)

O-series models (`o1`, `o3`, `o4-mini`, etc.) and GPT-5 support extended reasoning. Configure via the `reasoning` constructor parameter:

```typescript
const llm = new ChatOpenAI({
  model: "o3",
  reasoning: { effort: "high" },   // "low" | "medium" | "high"
});
```

`temperature` is not accepted by reasoning models — omit it or set the model-level default.

The `reasoning` property on the class maps to the `reasoning_effort` API parameter in the OpenAI Responses API.

**Nexus note:** `ZaiChatOpenAI` (at `apps/agents/src/nexus/models/zai-chat-model.ts`) subclasses `ChatOpenAI` with `configuration.baseURL` pointing at Z.AI's endpoint. It adds special handling for `reasoning_content` — GLM models return thinking tokens in `reasoning_content` on assistant messages, and `ZaiChatOpenAI` round-trips that field back into subsequent requests so reasoning state is preserved across multi-turn tool call sequences.

### Vision / multimodal

Pass an array of content parts in a `HumanMessage` to send images:

```typescript
import { HumanMessage } from '@langchain/core/messages';

const message = new HumanMessage({
  content: [
    { type: "text", text: "describe the weather in this image" },
    { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
  ]
});
const result = await llm.invoke([message]);
```

Supported by `gpt-4o`, `gpt-4o-mini`, and multimodal GPT-5 variants.

### Audio output

Use `model: "gpt-4o-audio-preview"` with `modalities: ["text", "audio"]` and an `audio` config. The response content block includes `data` (base64 WAV), `id`, `expires_at`, and `transcript`.

### OpenAI-compatible endpoint override

Any model serving the OpenAI Chat Completions API can be targeted by setting `configuration.baseURL`:

```typescript
const llm = new ChatOpenAI({
  model: "glm-4-plus",
  apiKey: process.env.ZAI_API_KEY,
  configuration: { baseURL: "https://api.z.ai/api/paas/v4" },
});
```

This is exactly how `ZaiChatOpenAI` works internally — the subclass sets the Z.AI base URL and API key from environment variables, then extends the class to handle GLM-specific `reasoning_content` fields.

### Key properties

- `supportsStrictToolCalling` — true for models that support strict schema enforcement
- `useResponsesApi` — routes calls to `/responses` instead of `/chat/completions`
- `zdrEnabled` — zero-data-retention mode
- `disableStreaming` — force non-streaming even when `streaming: true` is set

## Related

- [[openai-provider]]
- [[langchain-models]]
- [[chat-model-interface]]
- [[bind-tools]]
- [[langchain-messages]]

## Sources

- `raw/langchain/providers/openai/openai-chat.md` — full class reference: constructor params, invoke/stream, bindTools, withStructuredOutput, multimodal, audio, reasoning models, JSON schema output, logprobs
