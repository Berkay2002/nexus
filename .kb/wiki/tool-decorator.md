---
created: 2026-04-12
updated: 2026-04-12
tags: [langchain, tools, langchain-core, tool-call]
sources: [raw/langchain/langchain/tools.md]
---

# tool() Factory

The `tool()` function is the primary way to define a [[langchain-tools|LangChain tool]] in TypeScript. It wraps an implementation function with metadata (name, description, schema) and returns an object the model and framework can introspect and invoke.

## Content

### Signature

```typescript
import { tool } from "langchain"; // or "@langchain/core/tools"

const myTool = tool(
  (input, config?) => { /* implementation */ },
  {
    name: "tool_name",
    description: "What this tool does.",
    schema: z.object({ /* parameters */ }),
  }
);
```

The first argument is the implementation function. It receives two arguments:
1. **Parsed input** — an object whose shape matches the Zod schema.
2. **`config` / `runtime`** — a `ToolRuntime` object providing access to runtime context, store, writer, and execution info.

### Accessing Runtime Context

The second parameter to the tool function is a `ToolRuntime` (or `config`) object with several sub-properties:

#### `config.context`
Immutable configuration data passed at agent invocation time. Use for user IDs, session details, API keys, or application settings that don't change mid-conversation.

```typescript
const getUserName = tool(
  (_, config) => config.context.user_name,
  { name: "get_user_name", description: "...", schema: z.object({}) }
);

// Passed when invoking the agent:
agent.invoke({ messages: [...] }, { context: { user_name: "Alice" } });
```

In Nexus, `config.context` carries API keys like `TAVILY_API_KEY` that tools must never hardcode.

#### `config.store`
A `BaseStore` instance for long-term memory that persists across conversations. Uses a namespace/key pattern:

```typescript
const value = await config.store.get(["namespace"], "key");
await config.store.put(["namespace"], "key", { data });
```

#### `config.writer`
Emits real-time streaming updates during tool execution. Useful for progress feedback in long-running operations.

```typescript
const writer = config.writer;
if (writer) writer(`Processing step 1...`);
```

#### `runtime.executionInfo`
Provides `threadId`, `runId`, and `nodeAttempt`. Requires deepagents >= 1.9.0 or @langchain/langgraph >= 1.2.8.

#### `runtime.serverInfo`
When running on LangGraph Server, provides `assistantId`, `graphId`, and `user.identity`. Is `null` outside LangGraph Server.

#### `config.toolCallId`
The ID of the current [[tool-call]]. Required when constructing a `ToolMessage` inside a `Command` return — ensures the message is linked to the correct tool invocation.

### Tool Name Convention

Always use `snake_case` for tool names (e.g., `tavily_search`, not `TavilySearch`). Some providers reject names containing spaces or special characters.

### Async Tools

The implementation function can be `async`. Return a `Promise<string | object | Command>`.

## Related

- [[langchain-tools]]
- [[zod-tool-schemas]]
- [[tool-call]]
- [[tool-message]]
- [[config-runtime-context]]

## Sources

- `raw/langchain/langchain/tools.md` — tool() API, runtime config properties, context/store/writer/executionInfo/serverInfo access patterns
