---
created: 2026-04-12
updated: 2026-04-12
tags: [langchain, langchain-core, chat-models, streaming]
sources: [raw/langchain/langchain/models.md]
---

# Chat Model Interface

The `BaseChatModel` interface defines the full set of methods available on every [[langchain-models|LangChain chat model]], regardless of provider. All method signatures are consistent across `ChatOpenAI`, `ChatAnthropic`, `ChatGoogleGenerativeAI`, and any other integration.

## Content

### invoke

`invoke(messages, config?)` — sends a list of [[langchain-messages|messages]] (or a single string) to the model and returns a complete `AIMessage` after generation finishes.

```typescript
// Single string shorthand
const response = await model.invoke("Why do parrots talk?");

// Full message list (conversation history)
const response = await model.invoke([
  { role: "system", content: "You translate English to French." },
  { role: "user", content: "I love programming." },
]);
// → AIMessage("J'adore la programmation.")
```

An optional second argument accepts a `RunnableConfig` for tags, metadata, callbacks, and `runName`. Client errors (401, 404) are not retried; network errors and 429/5xx are retried up to `maxRetries` (default 6) with exponential backoff.

### stream

`stream(messages, config?)` — returns an async iterator of `AIMessageChunk` objects. Chunks can be concatenated into a full message:

```typescript
const stream = await model.stream("What color is the sky?");
let full = null;
for await (const chunk of stream) {
  full = full ? full.concat(chunk) : chunk;
}
// full is equivalent to an invoke() result

// Access content blocks (text, reasoning, tool_call_chunks):
for await (const chunk of stream) {
  for (const block of chunk.contentBlocks) {
    if (block.type === "reasoning") console.log(block.reasoning);
    else if (block.type === "text") console.log(block.text);
  }
}
```

LangChain supports **auto-streaming**: if you call `model.invoke()` inside a LangGraph node that is being streamed externally, LangChain automatically delegates to internal streaming mode and fires `on_llm_new_token` callbacks so the outer `stream()` / `streamEvents()` surfaces tokens in real time.

### streamEvents

`streamEvents(input)` — semantic event stream. Simplifies filtering by event type instead of processing raw chunks:

```typescript
const stream = await model.streamEvents("Hello");
for await (const event of stream) {
  if (event.event === "on_chat_model_start") console.log(event.data.input);
  if (event.event === "on_chat_model_stream") console.log(event.data.chunk.text);
  if (event.event === "on_chat_model_end") console.log(event.data.output.text);
}
```

The full message is aggregated in the background — you don't need to manually concat chunks.

### batch

`batch(messages[], config?)` — sends multiple independent requests in parallel and returns an array of `AIMessage` objects. Use `maxConcurrency` in the config to cap parallel calls:

```typescript
const responses = await model.batch(
  ["Question A", "Question B", "Question C"],
  { maxConcurrency: 5 }
);
```

### withStructuredOutput

`withStructuredOutput(schema, options?)` — returns a new model that constrains output to match a schema. See [[with-structured-output]] for full detail.

### bindTools

`bindTools(tools, options?)` — attaches [[langchain-tools|tools]] to the model so it can request their execution. See [[bind-tools]] for full detail.

### withRetry

`withRetry(options?)` — wraps the model in a retry policy. Usually unnecessary because `maxRetries` is already baked into every chat model constructor, but available for custom backoff logic.

### RunnableConfig

All invocation methods accept an optional `RunnableConfig` as their last argument:

| Field | Type | Description |
|---|---|---|
| `runName` | string | Label for this run in traces (not inherited) |
| `tags` | string[] | Inherited by all sub-calls |
| `metadata` | object | Inherited key-value pairs |
| `maxConcurrency` | number | Parallel call cap for `batch()` |
| `callbacks` | CallbackHandler[] | Event handlers for monitoring |
| `recursion_limit` | number | Max chain recursion depth |

### Token Usage and Metadata

Token counts, log probabilities, and cache usage are returned in `response.response_metadata` and reflected in the `usage_metadata` field of the `AIMessage`. See [[langchain-messages]] for the full message shape.

## Related

- [[langchain-models]]
- [[with-structured-output]]
- [[bind-tools]]
- [[langchain-messages]]

## Sources

- `raw/langchain/langchain/models.md` — invoke, stream, batch, streamEvents, auto-streaming, RunnableConfig, token usage
