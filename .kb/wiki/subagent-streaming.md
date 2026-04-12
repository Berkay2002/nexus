---
created: 2026-04-12
updated: 2026-04-12
tags: [deepagents, frontend, streaming, subagent, use-stream]
sources: [raw/langchain/deepagents/frontend/subagent-streaming.md]
---

# Subagent Streaming

When a coordinator agent spawns specialist [[subagents]], the frontend must render the orchestrator's messages separately from each subagent's streaming output. The DeepAgents frontend provides a set of APIs — centered on [[use-stream-hook|useStream]] — to cleanly split these two streams and attach per-subagent cards to the coordinator message that triggered them.

## How it works

Without filtering, every token produced by every subagent appears interleaved in the coordinator's message stream. With [[filter-subagent-messages|`filterSubagentMessages: true`]]:

- `stream.messages` contains **only** the coordinator's messages
- Each subagent's content is accessible through `stream.subagents` (a `Map`) and `stream.getSubagentsByMessage(messageId)`
- The UI stays clean: the coordinator's reasoning is separate from the specialists' work

This separation lets you render orchestrator messages in one place and attach each subagent's progress card exactly where it belongs: beneath the coordinator message that spawned it.

## Typical render loop

```tsx
const stream = useStream<typeof myAgent>({
  apiUrl: AGENT_URL,
  assistantId: "my_agent",
  filterSubagentMessages: true,   // required for clean split
} as any);                         // 'as any' required — see filter-subagent-messages

return (
  <div>
    {stream.messages.map((msg) => (
      <MessageWithSubagents
        key={msg.id}
        message={msg}
        subagents={stream.getSubagentsByMessage(msg.id)}
      />
    ))}
  </div>
);
```

## SubagentStreamInterface

Each subagent exposed by `stream.subagents` or [[get-subagents-by-message|`getSubagentsByMessage`]] implements:

```ts
interface SubagentStreamInterface {
  id: string;
  status: "pending" | "running" | "complete" | "error";
  messages: BaseMessage[];
  result: string | undefined;        // populated only when status === "complete"
  toolCall: {
    id: string;
    name: string;
    args: {
      description: string;           // task description assigned by coordinator
      subagent_type: string;         // specialist name, e.g. "researcher"
      [key: string]: unknown;
    };
  };
  startedAt: number | undefined;
  completedAt: number | undefined;
}
```

**Critical:** `SubagentStreamInterface` has **no `model` field**. To display a model name badge, derive it from `toolCall.args.subagent_type` via a static mapping in your own code.

## Subagent card anatomy

A minimal subagent card shows:
- **Title** — `subagent.toolCall?.args?.subagent_type` (fall back to `Agent ${subagent.id}`)
- **Description** — `subagent.toolCall?.args?.description`
- **Content** — while running: last AI message text; when complete: `subagent.result`
- **Status icon/badge** — `pending | running | complete | error`
- **Elapsed time** — derived from `startedAt` / `completedAt`
- **Collapse/expand toggle** — expand by default, collapse completed cards in large workflows

## Submitting with subgraph streaming

Messages must be submitted with `{ streamSubgraphs: true }` to receive subagent events:

```ts
stream.submit(
  { messages: [{ type: "human", content: text }] },
  { streamSubgraphs: true }
);
```

See [[subgraph-streaming]] for the backend side of this.

## Synthesis indicator

After all subagents complete, the coordinator synthesizes their results. Show a distinct indicator during this phase — it can take several seconds:

```tsx
function SynthesisIndicator({ subagents, isLoading }) {
  const allComplete =
    subagents.length > 0 &&
    subagents.every((s) => s.status === "complete" || s.status === "error");

  if (!allComplete || !isLoading) return null;

  return <div>Synthesizing results from {subagents.length} subagents...</div>;
}
```

Use `stream.isLoading` for the `isLoading` prop; never infer loading state solely from subagent status.

## Accessing all subagents

Beyond per-message lookup, you can filter across the entire run:

```ts
const allSubagents = [...stream.subagents.values()];
const running   = allSubagents.filter((s) => s.status === "running");
const completed = allSubagents.filter((s) => s.status === "complete");
```

Useful for global progress dashboards or the synthesis indicator.

## Debug mode

During development, set `filterSubagentMessages: false` temporarily to see the raw interleaved output from all subagents. Do not ship this to production.

## Best practices

- Always set `filterSubagentMessages: true` — unfiltered streams are unreadable
- Always display `toolCall.args.description` — tells the user what the agent was asked to do
- Use collapsible cards in workflows with 5+ subagents — auto-collapse completed ones
- Display timing data — helps users understand performance and spot bottlenecks
- Handle errors per subagent — one failure should not crash the entire UI
- Set a recursion limit appropriate for nested subgraphs (DeepAgents default is 10,000)

## Related

- [[use-stream-hook]]
- [[filter-subagent-messages]]
- [[get-subagents-by-message]]
- [[subgraph-streaming]]
- [[deepagents-frontend-overview]]

## Sources

- `raw/langchain/deepagents/frontend/subagent-streaming.md` — full pattern reference: filtering, SubagentStreamInterface shape, card rendering, synthesis indicator, best practices
