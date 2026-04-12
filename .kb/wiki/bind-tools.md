---
created: 2026-04-12
updated: 2026-04-12
tags: [langchain, langchain-core, chat-models, tool-call]
sources: [raw/langchain/langchain/models.md]
---

# bindTools

`bindTools(tools, options?)` attaches [[langchain-tools|tool definitions]] to a [[langchain-models|LangChain chat model]] so the model can request their execution during inference. It returns a new model instance with the tools pre-bound — the original model is unchanged.

## Content

### Basic Usage

```typescript
import { tool } from "langchain";
import * as z from "zod";
import { ChatOpenAI } from "@langchain/openai";

const getWeather = tool(
  (input) => `It's sunny in ${input.location}.`,
  {
    name: "get_weather",
    description: "Get the weather at a location.",
    schema: z.object({
      location: z.string().describe("The location to get weather for"),
    }),
  },
);

const model = new ChatOpenAI({ model: "gpt-4.1" });
const modelWithTools = model.bindTools([getWeather]);

const response = await modelWithTools.invoke("What's the weather in Boston?");
console.log(response.tool_calls);
// [{ name: "get_weather", args: { location: "Boston" }, id: "call_abc" }]
```

The model's response contains tool call *requests* — not results. When using a model standalone (outside an agent loop), you are responsible for executing the tools and passing results back.

### Tool Execution Loop

```typescript
const messages = [{ role: "user", content: "What's the weather in Boston?" }];
const ai_msg = await modelWithTools.invoke(messages);
messages.push(ai_msg);

for (const tool_call of ai_msg.tool_calls) {
  const result = await getWeather.invoke(tool_call);  // returns a ToolMessage
  messages.push(result);
}

const final = await modelWithTools.invoke(messages);
```

Each `ToolMessage` carries a `tool_call_id` matching the original request. When using [[create-deep-agent|agents]], the agent loop handles this automatically.

### toolChoice Option

Control which tool the model uses:

```typescript
// Model must call at least one tool
model.bindTools([tool1, tool2], { toolChoice: "any" });

// Model must call this specific tool
model.bindTools([tool1], { toolChoice: "tool1" });

// Default: model decides (auto)
model.bindTools([tool1, tool2]);
```

### Parallel Tool Calls

Most models that support tool calling also support calling multiple tools in a single turn when the requests are independent:

```typescript
const response = await modelWithTools.invoke("Weather in Boston and Tokyo?");
// response.tool_calls may contain two entries
```

To disable parallel calls (supported by [[chat-openai]] and [[chat-anthropic]]):

```typescript
model.bindTools([getWeather], { parallel_tool_calls: false });
```

### Streaming Tool Calls

Tool calls arrive as `ToolCallChunk` objects when streaming. Accumulate with `concat()` to reconstruct complete calls:

```typescript
let full = null;
const stream = await modelWithTools.stream("Weather in Boston and Tokyo?");
for await (const chunk of stream) {
  full = full ? full.concat(chunk) : chunk;
}
console.log(full.tool_calls);  // complete tool call objects
```

Individual chunks have partial `args` (JSON fragments) that assemble into the final argument object.

### Server-Side Tools

Some providers (OpenAI, Anthropic) support **built-in server-side tools** such as web search and code interpreters. These are passed in the same `bindTools` call but execute on the provider's infrastructure — no `ToolMessage` round-trip needed:

```typescript
const modelWithSearch = model.bindTools([{ type: "web_search" }]);
const response = await modelWithSearch.invoke("Latest news today?");
// response.contentBlocks contains server-side tool call + result blocks
```

## Related

- [[langchain-models]]
- [[chat-model-interface]]
- [[with-structured-output]]
- [[langchain-tools]]

## Sources

- `raw/langchain/langchain/models.md` — bindTools signature, toolChoice, parallel_tool_calls, streaming tool calls, server-side tools, execution loop pattern
