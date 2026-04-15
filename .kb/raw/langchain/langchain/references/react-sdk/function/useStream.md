# useStream

> **Function** in `@langchain/react`

📖 [View in docs](https://reference.langchain.com/javascript/langchain-react/useStream)

A React hook that provides seamless integration with LangGraph streaming capabilities.

The `useStream` hook handles all the complexities of streaming, state management, and branching logic,
letting you focus on building great chat experiences. It provides automatic state management for
messages, interrupts, loading states, subagent streams, and errors.

## Usage with ReactAgent (recommended for createAgent users)

When using `createAgent` from `@langchain/langgraph`, you can pass `typeof agent` as the
type parameter to automatically infer tool call types:

## Signature

```javascript
useStream<T = Record<string, unknown>, Bag extends BagTemplate = BagTemplate>(options: ResolveStreamOptions<T, InferBag<T, Bag>>): WithClassMessages<ResolveStreamInterface<T, InferBag<T, Bag>>>
```

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `ResolveStreamOptions<T, InferBag<T, Bag>>` | Yes |  |

## Returns

`WithClassMessages<ResolveStreamInterface<T, InferBag<T, Bag>>>`

## Examples

### Example 1

```typescript
// In your agent file (e.g., agent.ts)
import { createAgent, tool } from "langchain";
import { z } from "zod";

const getWeather = tool(
  async ({ location }) => `Weather in ${location}`,
  { name: "get_weather", schema: z.object({ location: z.string() }) }
);

export const agent = createAgent({
  model: "openai:gpt-4o",
  tools: [getWeather],
});

// In your React component
import { agent } from "./agent";

function Chat() {
  // Tool calls are automatically typed from the agent's tools!
  const stream = useStream<typeof agent>({
    assistantId: "agent",
    apiUrl: "http://localhost:2024",
  });

  // stream.toolCalls[0].call.name is typed as "get_weather"
  // stream.toolCalls[0].call.args is typed as { location: string }
}
```

### Example 2

```typescript
import { Message } from "@langchain/langgraph-sdk";

// Define your tool call types as a discriminated union
type MyToolCalls =
  | { name: "search"; args: { query: string }; id?: string }
  | { name: "calculate"; args: { expression: string }; id?: string };

// Embed tool call types in your state's messages
interface MyGraphState {
  messages: Message<MyToolCalls>[];
  context?: string;
}

function Chat() {
  const stream = useStream<MyGraphState>({
    assistantId: "my-graph",
    apiUrl: "http://localhost:2024",
  });

  // stream.values is typed as MyGraphState
  // stream.toolCalls[0].call.name is typed as "search" | "calculate"
}
```

### Example 3

```typescript
// With additional type configuration (interrupts, configurable)
interface MyGraphState {
  messages: Message<MyToolCalls>[];
}

function Chat() {
  const stream = useStream<MyGraphState, {
    InterruptType: { question: string };
    ConfigurableType: { userId: string };
  }>({
    assistantId: "my-graph",
    apiUrl: "http://localhost:2024",
  });

  // stream.interrupt is typed as { question: string } | undefined
}
```

### Example 4

```typescript
import { useStream, SubagentStream } from "@langchain/langgraph-sdk/react";
import type { agent } from "./agent";

function DeepAgentChat() {
  const stream = useStream<typeof agent>({
    assistantId: "deepagent",
    apiUrl: "http://localhost:2024",
    // Filter subagent messages from main stream
    filterSubagentMessages: true,
  });

  const handleSubmit = (content: string) => {
    stream.submit(
      { messages: [{ content, type: "human" }] },
      { streamSubgraphs: true } // Enable subgraph streaming
    );
  };

  // Access subagent streams via stream.subagents (Map<string, SubagentStream>)
  const subagentList = [...stream.subagents.values()];

  return (
    <div>
      {stream.messages.map((msg) => <Message key={msg.id} message={msg} />)}

      {subagentList.map((subagent) => (
        <SubagentCard
          key={subagent.id}
          status={subagent.status} // "pending" | "running" | "complete" | "error"
          messages={subagent.messages}
          toolCalls={subagent.toolCalls}
        />
      ))}
    </div>
  );
}
```

---

[View source on GitHub](https://github.com/langchain-ai/langgraphjs/blob/5a0d0d0155aee7d5d171a61ebdb4d0c26ca6462d/libs/sdk-react/src/stream.tsx#L191)