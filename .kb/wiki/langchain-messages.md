---
created: 2026-04-12
updated: 2026-04-12
tags: [langchain, langchain-core, messages]
sources: [raw/langchain/langchain/messages.md]
---

# LangChain Messages

Messages are the fundamental unit of context for [[langchain-models|chat models]] in LangChain. Every model invocation takes a sequence of messages as input and returns an [[ai-message]] as output. Messages carry role, content, and optional metadata.

## Content

### The three fields

| Field | Type | Purpose |
|-------|------|---------|
| role | string | Identifies the sender — `system`, `user`, `assistant`, `tool` |
| content | `string \| ContentBlock[]` | The payload — text, images, audio, documents, or structured blocks |
| metadata | object | IDs, token usage, response info, provider details |

### Message types

LangChain defines four concrete message classes, each mapping to a standard role:

- **SystemMessage** (`system`) — initial instructions that prime model behavior; set tone, role, and guidelines. Must appear before human/AI turns.
- **HumanMessage** (`user`) — user input. Can hold text, images, audio, files, or any multimodal content.
- **[[ai-message|AIMessage]]** (`assistant`) — model output. Contains text, tool calls, and usage metadata.
- **[[tool-message|ToolMessage]]** (`tool`) — result of a single tool execution, linked back to the originating tool call via `tool_call_id`.

### Input formats

LangChain chat models accept three equivalent formats:

```typescript
// 1. Message objects (recommended)
await model.invoke([
  new SystemMessage("You are a helpful assistant."),
  new HumanMessage("Hello!"),
]);

// 2. Plain string shortcut (single HumanMessage)
await model.invoke("Hello!");

// 3. OpenAI-compatible dict format
await model.invoke([
  { role: "system", content: "You are a helpful assistant." },
  { role: "user", content: "Hello!" },
]);
```

### Conversation loop

Chat interactions are stateless — each call requires the full history. A basic loop appends the returned AIMessage and any tool results before the next call:

```typescript
const messages = [systemMsg, new HumanMessage("What's 2+2?")];
const response = await model.invoke(messages);
// response is AIMessage
messages.push(response, new HumanMessage("And multiplied by 3?"));
```

### Content: string vs blocks

`content` is loosely typed on purpose to allow provider-native structures. Three valid forms:

1. Plain string — simplest, most common
2. Provider-native list — e.g., OpenAI `image_url` objects
3. LangChain standard content blocks — type-safe, cross-provider (see [[multimodal-content]])

Standard blocks are exposed via the `contentBlocks` property (lazy-parsed from `content`). To serialize standard blocks into `content` itself (for downstream consumers outside LangChain), set `LC_OUTPUT_VERSION=v1` or `outputVersion: "v1"` on the model.

### Streaming

During streaming, models emit `AIMessageChunk` objects. Concatenate them into a full message with `.concat()`:

```typescript
let final: AIMessageChunk | undefined;
for await (const chunk of stream) {
  final = final ? final.concat(chunk) : chunk;
}
```

## Related

- [[ai-message]]
- [[tool-message]]
- [[multimodal-content]]
- [[langchain-models]]
- [[langchain-tools]]

## Sources

- `raw/langchain/langchain/messages.md` — full messages reference including all types, content blocks, and streaming
