# useSuspenseStream

> **Function** in `@langchain/react`

📖 [View in docs](https://reference.langchain.com/javascript/langchain-react/useSuspenseStream)

A Suspense-compatible variant of useStream for LangGraph Platform.

`useSuspenseStream` suspends the component while the initial thread
history is being fetched and throws errors to the nearest React Error
Boundary.  During active streaming the component stays rendered and
`isStreaming` indicates whether tokens are arriving.

## Signature

```javascript
useSuspenseStream<T = Record<string, unknown>, Bag extends BagTemplate = BagTemplate>(options: UseSuspenseStreamOptions<T, InferBag<T, Bag>>): WithClassMessages<WithSuspense<ResolveStreamInterface<T, InferBag<T, Bag>>>>
```

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `UseSuspenseStreamOptions<T, InferBag<T, Bag>>` | Yes |  |

## Returns

`WithClassMessages<WithSuspense<ResolveStreamInterface<T, InferBag<T, Bag>>>>`

## Examples

```tsx
<ErrorBoundary fallback={<ErrorDisplay />}>
  <Suspense fallback={<Spinner />}>
    <Chat />
  </Suspense>
</ErrorBoundary>

function Chat() {
  const { messages, submit, isStreaming } = useSuspenseStream({
    assistantId: "agent",
    apiUrl: "http://localhost:2024",
  });
  return <MessageList messages={messages} />;
}
```

---

[View source on GitHub](https://github.com/langchain-ai/langgraphjs/blob/5a0d0d0155aee7d5d171a61ebdb4d0c26ca6462d/libs/sdk-react/src/suspense-stream.tsx#L165)