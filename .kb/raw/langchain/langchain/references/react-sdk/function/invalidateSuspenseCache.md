# invalidateSuspenseCache

> **Function** in `@langchain/react`

📖 [View in docs](https://reference.langchain.com/javascript/langchain-react/invalidateSuspenseCache)

Clear the internal Suspense cache used by useSuspenseStream.

Call this from an Error Boundary's `onReset` callback so that a retry
triggers a fresh thread-history fetch rather than re-throwing the
cached error.

## Signature

```javascript
invalidateSuspenseCache(cache: SuspenseCache = defaultSuspenseCache)
```

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `cache` | `SuspenseCache` | No |  (default: `defaultSuspenseCache`) |

## Returns

`void`

## Examples

```tsx
<ErrorBoundary
  onReset={() => invalidateSuspenseCache()}
  fallbackRender={({ resetErrorBoundary }) => (
    <button onClick={resetErrorBoundary}>Retry</button>
  )}
>
  <Suspense fallback={<Spinner />}>
    <Chat />
  </Suspense>
</ErrorBoundary>
```

---

[View source on GitHub](https://github.com/langchain-ai/langgraphjs/blob/5a0d0d0155aee7d5d171a61ebdb4d0c26ca6462d/libs/sdk-react/src/suspense-stream.tsx#L108)