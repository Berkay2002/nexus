# UseDeepAgentStream

> **Interface** in `@langchain/react`

📖 [View in docs](https://reference.langchain.com/javascript/langchain-react/UseDeepAgentStream)

Stream interface for DeepAgent instances created with `createDeepAgent`.

Extends UseAgentStream with subagent streaming capabilities. Subagent
streams are automatically typed based on the agent's subagent configuration,
enabling type-safe access to subagent state and messages.

Use this interface when streaming from an agent created with `createDeepAgent`
that orchestrates multiple specialized subagents.

 This interface is subject to change.

## Signature

```javascript
interface UseDeepAgentStream
```

## Description

This interface adds subagent streaming on top of UseAgentStream:
- `subagents` - Map of all subagent streams by tool call ID
- `activeSubagents` - Array of currently running subagents
- `getSubagent(id)` - Get a specific subagent by tool call ID
- `getSubagentsByType(type)` - Get all subagents of a specific type with typed state
- `getSubagentsByMessage(messageId)` - Get all subagents triggered by a specific AI message

It also enables the `filterSubagentMessages` option to exclude subagent
messages from the main `messages` array.

## Extends

- `UseAgentStream<StateType, ToolCall, Bag>`

## Properties

- `activeSubagents`
- `assistantId`
- `branch`
- `client`
- `error`
- `experimental_branchTree`
- `getMessagesMetadata`
- `getSubagent`
- `getSubagentsByMessage`
- `getSubagentsByType`
- `getToolCalls`
- `history`
- `interrupt`
- `interrupts`
- `isLoading`
- `isThreadLoading`
- `joinStream`
- `messages`
- `queue`
- `setBranch`
- `stop`
- `subagents`
- `submit`
- `switchThread`
- `toolCalls`
- `toolProgress`
- `values`

## Examples

```typescript
import { createDeepAgent } from "deepagents";
import { useStream } from "@langchain/langgraph-sdk/react";

// Define subagents with typed middleware
const agent = createDeepAgent({
  subagents: [
    {
      name: "researcher",
      description: "Research specialist",
      middleware: [ResearchMiddleware],
    },
    {
      name: "writer",
      description: "Content writer",
      middleware: [WriterMiddleware],
    },
  ] as const, // Important: use 'as const' for type inference
});

// In React component:
function Chat() {
  const stream = useStream<typeof agent>({
    assistantId: "deep-agent",
    apiUrl: "http://localhost:2024",
    filterSubagentMessages: true, // Only show main agent messages
  });

  // Subagent streams are typed!
  const researchers = stream.getSubagentsByType("researcher");
  researchers.forEach(subagent => {
    // subagent.values.messages is typed as Message<ToolCall>[]
    // subagent.status is "pending" | "running" | "complete" | "error"
    console.log("Researcher status:", subagent.status);
  });

  // Track all active subagents
  stream.activeSubagents.forEach(subagent => {
    console.log(`${subagent.toolCall.args.subagent_type} is running...`);
  });
}
```

---

[View source on GitHub](https://github.com/langchain-ai/langgraphjs/blob/5a0d0d0155aee7d5d171a61ebdb4d0c26ca6462d/libs/sdk-react/sdk/src/ui/stream/deep-agent.ts#L79)