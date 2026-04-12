---
created: 2026-04-12
updated: 2026-04-12
tags: [langchain, tools, langchain-core, tool-call]
sources: [raw/langchain/langchain/tools.md]
---

# LangChain Tools

Tools are callable functions with well-defined inputs and outputs that extend what agents can do — fetching real-time data, executing code, querying databases, and taking actions in the world. A [[langchain-models|chat model]] decides when to invoke a tool and what arguments to pass, based on conversation context.

## Content

### The Tool Contract

Every tool exposes three things to the model:

- **Name** — a unique identifier the model uses to invoke the tool. Use `snake_case` only; some providers reject names with spaces or special characters.
- **Description** — natural language text that tells the model what the tool does and when to use it. The quality of this description directly affects invocation accuracy.
- **Schema** — a structured definition of the tool's input parameters (see [[zod-tool-schemas]]).

When the model decides to call a tool, it emits a [[tool-call]] object carrying the tool name and argument values. The framework executes the tool and wraps the result in a [[tool-message]], which is appended to the message history so the model can continue reasoning.

### Creating Tools

Use the [[tool-decorator|`tool()` factory]] from `langchain` or `@langchain/core/tools`. Pass an implementation function and a config object with `name`, `description`, and `schema`.

### Return Values

Tools can return three types of values:

| Return type | Effect |
|---|---|
| `string` | Converted to a `ToolMessage`; model reads plain text |
| `object` | Serialized as structured output; model inspects fields |
| `Command` | Updates graph state; optionally includes a `ToolMessage` |

Return `Command` when the tool needs to mutate agent state (e.g., set user preferences), not just return data.

### ToolNode

`ToolNode` from `@langchain/langgraph/prebuilt` is the standard way to execute tools inside a LangGraph workflow. It handles parallel tool execution, error handling, and state injection automatically. Pair it with `toolsCondition` for conditional routing after model responses.

```typescript
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";

const toolNode = new ToolNode([search, calculator]);
```

Error handling modes:
- Default: propagates errors
- `handleToolErrors: true`: catches all errors
- `handleToolErrors: "message"`: returns a custom error message to the model

### Nexus Custom Tools

Nexus implements four custom tools using `tool()` + Zod: `tavily_search`, `tavily_extract`, `tavily_map`, and `generate_image`. Each lives in `apps/agents/src/nexus/tools/{name}/tool.ts` with a companion `prompt.ts` exporting `TOOL_NAME` and `TOOL_DESCRIPTION`.

## Related

- [[tool-decorator]]
- [[tool-call]]
- [[zod-tool-schemas]]
- [[langchain-models]]
- [[langchain-messages]]

## Sources

- `raw/langchain/langchain/tools.md` — tool contract, tool() factory, return value types, ToolNode, runtime context access
