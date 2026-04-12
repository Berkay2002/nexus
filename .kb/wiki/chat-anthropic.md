---
created: 2026-04-12
updated: 2026-04-12
tags: [anthropic, chat-model, claude, langchain, tool-call, prompt-caching]
sources: [raw/langchain/providers/anthropic/anthropic-chat.md]
---

# ChatAnthropic

`ChatAnthropic` is the [[langchain-models]] chat model class from `@langchain/anthropic` that wraps Anthropic's Claude API. It implements the standard [[chat-model-interface]], supporting invoke, stream, batch, tool calling, structured output, extended thinking, and prompt caching.

## Installation and Setup

```bash
npm install @langchain/anthropic
export ANTHROPIC_API_KEY="your-api-key"
```

## Constructor Parameters

Key constructor params passed to `new ChatAnthropic({...})`:

| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | `string` | Model ID, e.g. `"claude-sonnet-4-5-20250929"` |
| `apiKey` | `string` | Anthropic API key (falls back to `ANTHROPIC_API_KEY` env var) |
| `apiUrl` | `string` | Base URL override |
| `maxTokens` | `number` | Maximum output tokens |
| `temperature` | `number` | Sampling temperature (0–1) |
| `topK` | `number` | Top-K sampling |
| `topP` | `number` | Top-P (nucleus) sampling |
| `stopSequences` | `string[]` | Sequences that halt generation |
| `streaming` | `boolean` | Enable server-sent event streaming |
| `streamUsage` | `boolean` | Include token usage in stream chunks |
| `maxRetries` | `number` | Retry count on transient errors |
| `thinking` | `object` | Extended thinking config (see below) |
| `betas` | `string[]` | Anthropic beta feature flags |
| `clientOptions` | `object` | Pass-through to the raw Anthropic SDK client |

Runtime call options (passed to `.invoke`, `.stream`, `.batch`, or via `.bind`) include `stop`, `streamUsage`, and `tool_choice`.

## Supported Models (Claude Naming Conventions)

Anthropic uses a versioned naming scheme: `claude-{variant}-{generation}-{date}`.

- **Claude 4 Opus** — `claude-opus-4-…`
- **Claude 4 Sonnet** — `claude-sonnet-4-5-20250929` (example from source)
- **Claude 4 Haiku** — `claude-haiku-4-…`

Older generations follow the same pattern with a lower major version. Always check the Anthropic docs for the canonical current model IDs.

## Basic Usage

```typescript
import { ChatAnthropic } from '@langchain/anthropic';

const llm = new ChatAnthropic({
  model: "claude-sonnet-4-5-20250929",
  temperature: 0,
  maxRetries: 2,
});

// Invoke (returns AIMessage)
const result = await llm.invoke("Translate 'hello' into French.");

// Stream (returns AsyncIterable<AIMessageChunk>)
for await (const chunk of await llm.stream("Tell me a story.")) {
  process.stdout.write(chunk.content as string);
}
```

Response includes `usage_metadata` (`input_tokens`, `output_tokens`, `total_tokens`) and `response_metadata` (`model`, `stop_reason`, `stop_sequence`).

### Aggregating Stream Chunks

```typescript
import { AIMessageChunk } from '@langchain/core/messages';
import { concat } from '@langchain/core/utils/stream';

const stream = await llm.stream(input);
let full: AIMessageChunk | undefined;
for await (const chunk of stream) {
  full = !full ? chunk : concat(full, chunk);
}
```

## Tool Calling

Use [[bind-tools]] to attach tools before invocation. Tools are defined as objects with a `name`, `description`, and Zod `schema`, or as LangChain `StructuredTool` instances.

```typescript
import { z } from 'zod';

const GetWeather = {
  name: "GetWeather",
  description: "Get the current weather in a given location",
  schema: z.object({
    location: z.string().describe("City and state, e.g. San Francisco, CA")
  }),
};

const llmWithTools = llm.bindTools([GetWeather], { tool_choice: "auto" });
const aiMsg = await llmWithTools.invoke("What's the weather in NY?");
console.log(aiMsg.tool_calls);
// [{ name: 'GetWeather', args: { location: 'New York, NY' }, id: '...', type: 'tool_call' }]
```

### Tool Search (Deferred Loading)

For large tool collections, Claude can dynamically discover tools on demand instead of receiving all definitions upfront:

```typescript
const tools = [
  { type: "tool_search_tool_regex_20251119", name: "tool_search_tool_regex" },
  {
    name: "get_weather",
    description: "Get weather for a location",
    input_schema: { type: "object", properties: { location: { type: "string" } }, required: ["location"] },
    defer_loading: true,  // only loaded when Claude searches for it
  },
];
const modelWithTools = llm.bindTools(tools);
```

Alternatively, use `tool()` from `@langchain/core/tools` with `extras: { defer_loading: true }`. The required `advanced-tool-use-2025-11-20` beta header is appended automatically. Keep 3–5 frequently used tools as non-deferred for best performance.

## Structured Output

`withStructuredOutput()` returns a runnable that always yields data matching a Zod schema:

```typescript
const Joke = z.object({
  setup: z.string(),
  punchline: z.string(),
  rating: z.number().optional(),
});

const structuredLlm = llm.withStructuredOutput(Joke, { name: "Joke" });
const result = await structuredLlm.invoke("Tell me a cat joke");
// { setup: "...", punchline: "...", rating: 7 }
```

Two underlying modes:

- **Function calling** (default) — routes through Anthropic tool calling
- **JSON Schema mode** — uses Anthropic's native JSON schema support; opt in with `{ method: "jsonSchema" }`

## Extended Thinking

Extended thinking is enabled via the `thinking` constructor parameter. It activates Claude's chain-of-thought scratchpad before the visible response. Refer to Anthropic's docs for the exact shape of the `thinking` config object.

## Prompt Caching

`ChatAnthropic` exposes a `cache` property and integrates with Anthropic's prompt caching feature, which reduces costs and latency for repeated large prompt prefixes. Cache behaviour is configured through `clientOptions` or by annotating message blocks with `cache_control` in the raw Anthropic SDK style.

## Multimodal Input

Pass image data as base64-encoded content blocks inside a [[langchain-messages]] `HumanMessage`:

```typescript
import { HumanMessage } from '@langchain/core/messages';

const message = new HumanMessage({
  content: [
    { type: "text", text: "Describe this image." },
    { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
  ],
});
const response = await llm.invoke([message]);
```

## Nexus Usage

In Nexus, `ChatAnthropic` is accessed via the tier registry (`resolveTier()`) rather than instantiated directly. It serves the `default`, `code`, and `deep-research` tiers when `ANTHROPIC_API_KEY` is present in the environment. See [[anthropic-provider]] for the Nexus-specific provider setup and tier priority ordering.

## Related

- [[anthropic-provider]]
- [[langchain-models]]
- [[chat-model-interface]]
- [[bind-tools]]
- [[langchain-messages]]

## Sources

- `raw/langchain/providers/anthropic/anthropic-chat.md` — class reference: constructor params, invoke/stream/batch examples, tool calling, structured output, tool search, multimodal, usage metadata
