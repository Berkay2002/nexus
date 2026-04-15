# SubagentStreamInterface

> **Interface** in `@langchain/react`

📖 [View in docs](https://reference.langchain.com/javascript/langchain-react/SubagentStreamInterface)

Base interface for a single subagent stream.
Tracks the lifecycle of a subagent from invocation to completion.

Extends StreamBase to share common properties with UseStream,
allowing subagents to be treated similarly to the main stream.

Prefer using SubagentStream which supports passing an agent type
directly for automatic type inference.

## Signature

```javascript
interface SubagentStreamInterface
```

## Extends

- `StreamBase<StateType, ToolCall>`

## Properties

- `activeSubagents`
- `completedAt`
- `depth`
- `error`
- `getSubagent`
- `getSubagentsByMessage`
- `getSubagentsByType`
- `getToolCalls`
- `id`
- `interrupt`
- `interrupts`
- `isLoading`
- `messages`
- `namespace`
- `parentId`
- `result`
- `startedAt`
- `status`
- `subagents`
- `switchThread`
- `toolCall`
- `toolCalls`
- `values`

---

[View source on GitHub](https://github.com/langchain-ai/langgraphjs/blob/5a0d0d0155aee7d5d171a61ebdb4d0c26ca6462d/libs/sdk-react/sdk/src/ui/types.ts#L211)