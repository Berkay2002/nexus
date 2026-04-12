---
created: 2026-04-12
updated: 2026-04-12
tags: [langchain, tools, tool-call, langchain-core]
sources: [raw/langchain/langchain/tools.md]
---

# ToolCall

A ToolCall is the structured object a [[langchain-models|chat model]] emits when it decides to invoke a tool. It carries everything the framework needs to dispatch the tool and route the result back correctly.

## Content

### Structure

A ToolCall object contains:

- **`name`** — the tool to invoke (must match a registered tool's `name` field)
- **`args`** — a key-value map of arguments parsed from the model's output, conforming to the tool's Zod schema
- **`id`** (also called `tool_call_id`) — a unique identifier for this specific invocation, used to match the response

### The Round-Trip

The ToolCall lives inside an [[ai-message]] that the model emits. The framework (typically `ToolNode`) reads it, calls the matching tool with the parsed args, and wraps the result in a [[tool-message]] that references the same `tool_call_id`. This completed pair is then appended to the conversation history so the model can continue.

```
AIMessage (with tool_calls[])
  └─ ToolCall { name, args, id: "call_abc123" }
       │
       ▼ tool executes
       │
ToolMessage { content: "...", tool_call_id: "call_abc123" }
```

### Parallel Tool Calls

Models can emit multiple ToolCalls in a single `AIMessage`. `ToolNode` handles them in parallel. When multiple parallel calls update graph state, use reducers to avoid write conflicts.

### Accessing tool_call_id Inside a Tool

When a tool returns a `Command` and needs to construct its own `ToolMessage` (to confirm state mutation to the model), it accesses the ID via `config.toolCallId`:

```typescript
const setLanguage = tool(
  async ({ language }, config: ToolRuntime) => {
    return new Command({
      update: {
        preferredLanguage: language,
        messages: [
          new ToolMessage({
            content: `Language set to ${language}.`,
            tool_call_id: config.toolCallId,
          }),
        ],
      },
    });
  },
  { name: "set_language", description: "...", schema: z.object({ language: z.string() }) }
);
```

Without the correct `tool_call_id`, the model cannot correlate the response to its original request, which typically causes errors.

### Routing After Tool Calls

`toolsCondition` from `@langchain/langgraph/prebuilt` inspects the latest `AIMessage`: if it contains tool calls, it routes to the `"tools"` node; otherwise it routes to `"__end__"`. This is the standard conditional edge pattern in LangGraph agent loops.

## Related

- [[langchain-tools]]
- [[tool-decorator]]
- [[tool-message]]
- [[ai-message]]
- [[langchain-messages]]

## Sources

- `raw/langchain/langchain/tools.md` — ToolCall object, tool_call_id round-trip, Command return with ToolMessage, toolsCondition routing
