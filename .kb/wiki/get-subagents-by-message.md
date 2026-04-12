---
created: 2026-04-12
updated: 2026-04-12
tags: [deepagents, frontend, use-stream, subagent, filter-subagent-messages]
sources: [raw/langchain/deepagents/frontend/subagent-streaming.md]
---

# getSubagentsByMessage

`getSubagentsByMessage(messageId)` is a method on the [[use-stream-hook|`useStream`]] stream object that returns the [[subagents]] spawned by a specific coordinator message. It is used to render [[subagent-streaming|subagent cards]] directly beneath the coordinator message that triggered them.

## Signature

```ts
stream.getSubagentsByMessage(messageId: string): SubagentStreamInterface[]
```

Returns an array of `SubagentStreamInterface` objects. If the message did not spawn any subagents, returns an empty array.

## Prerequisite

`getSubagentsByMessage` only works when [[filter-subagent-messages|`filterSubagentMessages: true`]] is set on the `useStream` options. Without filtering, all subagent output is interleaved in the main stream and the per-message lookup has nothing to return.

Both `filterSubagentMessages` and `getSubagentsByMessage` are only available when importing from `@langchain/react` (v0.3.3+) — **not** from `@langchain/langgraph-sdk/react`.

## Typical usage

```tsx
{stream.messages.map((msg) => (
  <MessageWithSubagents
    key={msg.id}
    message={msg}
    subagents={stream.getSubagentsByMessage(msg.id)}
  />
))}
```

Inside `MessageWithSubagents`, render the subagent cards only when the array is non-empty:

```tsx
function MessageWithSubagents({ message, subagents }) {
  return (
    <div>
      {message.content && <div>{message.content}</div>}

      {subagents.length > 0 && (
        <div>
          {subagents.map((subagent) => (
            <SubagentCard key={subagent.id} subagent={subagent} />
          ))}
        </div>
      )}
    </div>
  );
}
```

## Relationship to `stream.subagents`

`getSubagentsByMessage` is a filtered view into `stream.subagents` (the full `Map<string, SubagentStreamInterface>` for the entire run). Use `getSubagentsByMessage` when you need per-message scoping; use `stream.subagents` when you need a global view (e.g., a run-wide progress bar or synthesis indicator).

```ts
// Per-message (attach cards to the message that spawned them)
const turnSubagents = stream.getSubagentsByMessage(msg.id);

// Global (all subagents in the run)
const allSubagents = [...stream.subagents.values()];
const running = allSubagents.filter((s) => s.status === "running");
```

## SubagentStreamInterface fields used in card rendering

| Field | Used for |
|---|---|
| `subagent.id` | React `key` prop |
| `subagent.status` | Status icon/badge, display logic |
| `subagent.toolCall.args.subagent_type` | Card title (e.g. "researcher") |
| `subagent.toolCall.args.description` | Task description shown to user |
| `subagent.messages` | Streaming content while running |
| `subagent.result` | Final output when `status === "complete"` |
| `subagent.startedAt` / `completedAt` | Elapsed time display |

Note: there is **no `model` field** — derive model display names from `subagent_type` via a static mapping.

## Related

- [[use-stream-hook]]
- [[filter-subagent-messages]]
- [[subagent-streaming]]
- [[subagents]]

## Sources

- `raw/langchain/deepagents/frontend/subagent-streaming.md` — method description, render pattern, relationship to stream.subagents
