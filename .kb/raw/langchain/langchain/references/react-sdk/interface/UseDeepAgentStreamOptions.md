# UseDeepAgentStreamOptions

> **Interface** in `@langchain/react`

📖 [View in docs](https://reference.langchain.com/javascript/langchain-react/UseDeepAgentStreamOptions)

Options for configuring a deep agent stream.

Use this options interface when calling `useStream` with a DeepAgent
created via `createDeepAgent`. Includes all agent options plus
subagent-specific configuration.

## Signature

```javascript
interface UseDeepAgentStreamOptions
```

## Extends

- `UseAgentStreamOptions<StateType, Bag>`

## Properties

- `apiKey`
- `apiUrl`
- `assistantId`
- `callerOptions`
- `client`
- `defaultHeaders`
- `fetchStateHistory`
- `filterSubagentMessages`
- `initialValues`
- `messagesKey`
- `onCheckpointEvent`
- `onCreated`
- `onCustomEvent`
- `onError`
- `onFinish`
- `onLangChainEvent`
- `onMetadataEvent`
- `onStop`
- `onTaskEvent`
- `onThreadId`
- `onTool`
- `onToolEvent`
- `onUpdateEvent`
- `reconnectOnMount`
- `subagentToolNames`
- `thread`
- `threadId`
- `throttle`
- `tools`

## Examples

```typescript
const stream = useStream<typeof agent>({
  assistantId: "deep-agent",
  apiUrl: "http://localhost:2024",

  // DeepAgent-specific options
  subagentToolNames: ["task", "delegate"],
  filterSubagentMessages: true,

  onError: (error) => console.error(error),
});
```

---

[View source on GitHub](https://github.com/langchain-ai/langgraphjs/blob/5a0d0d0155aee7d5d171a61ebdb4d0c26ca6462d/libs/sdk-react/sdk/src/ui/stream/deep-agent.ts#L225)