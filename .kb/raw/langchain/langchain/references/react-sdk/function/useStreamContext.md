# useStreamContext

> **Function** in `@langchain/react`

📖 [View in docs](https://reference.langchain.com/javascript/langchain-react/useStreamContext)

Accesses the shared stream instance from the nearest `StreamProvider`.

Throws if called outside of a `StreamProvider`.

## Signature

```javascript
useStreamContext<T = Record<string, unknown>, Bag extends BagTemplate = BagTemplate>(): WithClassMessages<ResolveStreamInterface<T, InferBag<T, Bag>>>
```

## Returns

`WithClassMessages<ResolveStreamInterface<T, InferBag<T, Bag>>>`

## Examples

### Example 1

```tsx
function MessageList() {
  const { messages, getMessagesMetadata } = useStreamContext();
  return messages.map((msg, i) => {
    const metadata = getMessagesMetadata(msg, i);
    return <div key={msg.id ?? i}>{msg.content}</div>;
  });
}
```

### Example 2

```tsx
import type { agent } from "./agent";

function Chat() {
  const { toolCalls } = useStreamContext<typeof agent>();
  // toolCalls are fully typed from the agent's tools
}
```

---

[View source on GitHub](https://github.com/langchain-ai/langgraphjs/blob/5a0d0d0155aee7d5d171a61ebdb4d0c26ca6462d/libs/sdk-react/src/context.tsx#L137)