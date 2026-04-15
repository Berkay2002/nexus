# StreamProvider

> **Function** in `@langchain/react`

📖 [View in docs](https://reference.langchain.com/javascript/langchain-react/StreamProvider)

Provides a shared `useStream` instance to all descendants via React Context.

Use `StreamProvider` when multiple components in a subtree need access to the
same stream state (messages, loading status, errors, interrupts, etc.) without
prop drilling.

StreamProviderProps
Props for the StreamProvider component. Accepts all useStream options plus children.

```
StreamProviderProps: ResolveStreamOptions<T, InferBag<T, Bag>> & __type
```

## Signature

```javascript
StreamProvider<T = Record<string, unknown>, Bag extends BagTemplate = BagTemplate>(props: StreamProviderProps<T, Bag> | StreamProviderCustomProps<T, Bag>): ReactNode
```

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `props` | `StreamProviderProps<T, Bag> \| StreamProviderCustomProps<T, Bag>` | Yes |  |

## Returns

`ReactNode`

## Examples

### Example 1

```tsx
import { StreamProvider, useStreamContext } from "@langchain/react";

function App() {
  return (
    <StreamProvider assistantId="agent" apiUrl="http://localhost:2024">
      <ChatHeader />
      <MessageList />
      <MessageInput />
    </StreamProvider>
  );
}

function ChatHeader() {
  const { isLoading, error } = useStreamContext();
  return (
    <header>
      {isLoading && <span>Thinking...</span>}
      {error && <span>Error</span>}
    </header>
  );
}

function MessageList() {
  const { messages } = useStreamContext();
  return messages.map((msg, i) => <div key={msg.id ?? i}>{msg.content}</div>);
}

function MessageInput() {
  const { submit } = useStreamContext();
  return (
    <button onClick={() => submit({ messages: [{ type: "human", content: "Hi" }] })}>
      Send
    </button>
  );
}
```

### Example 2

```tsx
<StreamProvider assistantId="researcher" apiUrl="http://localhost:2024">
  <ResearchPanel />
</StreamProvider>
<StreamProvider assistantId="writer" apiUrl="http://localhost:2024">
  <WriterPanel />
</StreamProvider>
```



---

[View source on GitHub](https://github.com/langchain-ai/langgraphjs/blob/5a0d0d0155aee7d5d171a61ebdb4d0c26ca6462d/libs/sdk-react/src/context.tsx#L96)