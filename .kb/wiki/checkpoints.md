---
created: 2026-04-13
updated: 2026-04-13
tags: [langgraph, persistence, state, checkpointer]
sources: [raw/langchain/langgraph/persistence.md]
---

# Checkpoints

A **checkpoint** is a snapshot of graph state saved at a super-step boundary. It is represented by a `StateSnapshot` object. Checkpoints are the atomic unit stored by the [[checkpointer]] and retrieved by `thread_id`. Understanding checkpoints is essential for time travel, fault tolerance, and debugging graph executions.

## Super-Steps

LangGraph saves one checkpoint per **super-step** — a single execution tick where all nodes scheduled for that step run (potentially in parallel). For a sequential graph `START -> A -> B -> END`, four checkpoints are produced:

1. Empty checkpoint — `START` is next
2. Input checkpoint — `nodeA` is next
3. After `nodeA` — `nodeB` is next
4. After `nodeB` — no next nodes (graph complete)

Super-step boundaries are the only valid resume points for time travel or interrupt-based workflows.

## StateSnapshot Fields

| Field | Type | Description |
|---|---|---|
| `values` | `object` | State channel values at this checkpoint |
| `next` | `string[]` | Nodes to execute next. `[]` means graph is complete |
| `config` | `object` | Contains `thread_id`, `checkpoint_ns`, `checkpoint_id` |
| `metadata` | `object` | `source` (`"input"`, `"loop"`, `"update"`), `writes` (node outputs), `step` (super-step counter) |
| `createdAt` | `string` | ISO 8601 timestamp |
| `parentConfig` | `object \| null` | Config of the previous checkpoint. `null` for the first checkpoint |
| `tasks` | `PregelTask[]` | Pending tasks. Each has `id`, `name`, `error`, `interrupts`, optional `state` for subgraphs |

## Checkpoint Namespace

Each checkpoint carries a `checkpoint_ns` identifying its graph scope:

- `""` — root (parent) graph
- `"node_name:uuid"` — subgraph invoked via that node
- Nested subgraphs: `"outer:uuid|inner:uuid"` (joined with `|`)

## Pending Writes

When one node fails at a super-step while sibling nodes (running in parallel) succeeded, LangGraph stores those siblings' outputs as **pending writes** linked to the checkpoint. On resume, the successful nodes are not re-executed — only the failed node retries. This ensures at-most-once side effects for nodes that already wrote results.

> **Gotcha:** Pending writes are stored per-checkpoint, not globally. They only prevent re-execution within the same super-step. Nodes from prior super-steps are never re-run regardless.

## Filtering State History

```typescript
const history: StateSnapshot[] = [];
for await (const s of graph.getStateHistory(config)) {
  history.push(s);
}

// Before a specific node ran
const beforeNodeB = history.find((s) => s.next.includes("nodeB"));

// By step number
const step2 = history.find((s) => s.metadata.step === 2);

// Checkpoints created by updateState (forks)
const forks = history.filter((s) => s.metadata.source === "update");

// Where an interrupt fired
const interrupted = history.find(
  (s) => s.tasks.some((t) => t.interrupts.length > 0)
);
```

## Replay and Forking

Invoke the graph with a prior `checkpoint_id` to replay from that point. Nodes before the checkpoint are skipped; nodes after re-execute (including LLM calls, API requests, and [[langgraph-interrupts|interrupts]]). To fork rather than replay, call `graph.updateState()` first to inject new values, then invoke from that checkpoint.

## Checkpoint Count Example

For a simple `START -> A -> B -> END` graph:

```typescript
// 4 checkpoints produced:
// step -1: source="input"  — initial data arrives
// step  0: source="loop"   — after nodeA output
// step  1: source="loop"   — after nodeB output
// step  2: source="loop"   — graph complete
```

Note that `bar` accumulates across steps if a reducer is defined (`x.concat(y)`).

## Related

- [[langgraph-persistence]]
- [[checkpointer]]
- [[threads]]
- [[langgraph-store]]

## Sources

- `raw/langchain/langgraph/persistence.md` — StateSnapshot fields table, super-step definition, pending writes, checkpoint namespace, replay semantics, state history examples
