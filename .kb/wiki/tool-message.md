---
created: 2026-04-12
updated: 2026-04-12
tags: [langchain, langchain-core, messages, tool-call]
sources: [raw/langchain/langchain/messages.md]
---

# ToolMessage

`ToolMessage` carries the result of a single tool execution back to the model. It is the required response to a [[tool-call]] present in an [[ai-message]]. The model will not proceed correctly without a `ToolMessage` for every `tool_call` it emitted.

## Content

### Attributes

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `content` | `string` | yes | Stringified output of the tool execution — what the model reads |
| `tool_call_id` | `string` | yes | Must exactly match the `id` of the `ToolCall` in the preceding AIMessage |
| `name` | `string` | yes | Name of the tool that was called |
| `artifact` | `object` | no | Supplementary data NOT sent to the model — for downstream application use |

### The tool_call_id linkage

The pairing of `AIMessage.tool_calls[].id` → `ToolMessage.tool_call_id` is how the model traces which result belongs to which request. A mismatch or missing `ToolMessage` causes undefined model behavior. When multiple tools are called in one [[ai-message]], each requires its own `ToolMessage`.

### Minimal example

```typescript
import { AIMessage, ToolMessage, HumanMessage } from "langchain";

const aiMessage = new AIMessage({
  content: [],
  tool_calls: [{
    name: "get_weather",
    args: { location: "San Francisco" },
    id: "call_123"
  }]
});

const toolMessage = new ToolMessage({
  content: "Sunny, 72°F",
  tool_call_id: "call_123",
  name: "get_weather",
});

const messages = [
  new HumanMessage("What's the weather in San Francisco?"),
  aiMessage,
  toolMessage,
];

const response = await model.invoke(messages);
```

### The artifact field

`artifact` stores supplementary data that will NOT be sent to the model but is accessible to the application layer. Common use cases:

- Raw retrieval results (document IDs, page numbers, scores)
- Debugging information
- Data for UI rendering (e.g., citing which documents were retrieved)

```typescript
const toolMessage = new ToolMessage({
  content: "It was the best of times, it was the worst of times.",
  tool_call_id: "call_123",
  name: "search_books",
  artifact: { document_id: "doc_123", page: 0 },
});
```

The `content` string is what the model sees. The `artifact` object is what your application can inspect after the fact.

### Tools generating ToolMessage directly

[[langchain-tools|LangChain tools]] can generate `ToolMessage` objects directly when invoked. The tool framework handles creating the correct `tool_call_id` linkage automatically when you use `model.bindTools()` + the tool executor pattern.

## Related

- [[langchain-messages]]
- [[ai-message]]
- [[tool-call]]
- [[langchain-tools]]

## Sources

- `raw/langchain/langchain/messages.md` — ToolMessage attributes, tool_call_id linkage, artifact field
