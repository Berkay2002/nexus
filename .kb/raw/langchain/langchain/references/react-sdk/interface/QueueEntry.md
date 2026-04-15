# QueueEntry

> **Interface** in `@langchain/react`

📖 [View in docs](https://reference.langchain.com/javascript/langchain-react/QueueEntry)

A single queued submission entry representing a server-side pending run.
Each entry corresponds to a run created on the server via
`client.runs.create()` with `multitaskStrategy: "enqueue"`.

## Signature

```javascript
interface QueueEntry
```

## Properties

- `createdAt`
- `id`
- `options`
- `values`

---

[View source on GitHub](https://github.com/langchain-ai/langgraphjs/blob/5a0d0d0155aee7d5d171a61ebdb4d0c26ca6462d/libs/sdk-react/sdk/src/ui/queue.ts#L9)