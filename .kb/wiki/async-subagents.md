---
created: 2026-04-12
updated: 2026-04-12
tags: [deepagents, subagent, async, task-delegation, agent-protocol, preview]
sources: [raw/langchain/deepagents/async-subagents.md]
---

# Async Subagents

**Preview feature — available in `deepagents` 1.9.0+. APIs may change.**

Async subagents let a supervisor agent launch background tasks that return immediately, so the supervisor can continue interacting with the user while subagents work concurrently. The supervisor can check progress, send follow-up instructions, or cancel tasks at any point. They communicate via any server that implements the [[agent-protocol]].

## Sync vs Async: Side-by-Side

| Dimension | [[subagents\|Sync subagents]] | Async subagents |
| -------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Execution model** | Supervisor blocks until subagent completes | Returns job ID immediately; supervisor continues |
| **Concurrency** | Parallel but blocking | Parallel and non-blocking |
| **Mid-task updates** | Not possible | Send follow-up instructions via `update_async_task` |
| **Cancellation** | Not possible | Cancel running tasks via `cancel_async_task` |
| **Statefulness** | Stateless — no persistent state between invocations | Stateful — maintains state on its own thread across interactions |
| **Best for** | Tasks where the agent should wait for results before continuing | Long-running, complex tasks managed interactively in a chat |

Use async subagents when tasks are long-running, parallelizable, or need mid-flight steering.

## Configuration

Define async subagents as `AsyncSubAgent` specs passed to `createDeepAgent`:

```typescript
import { createDeepAgent, AsyncSubAgent } from "deepagents";

const asyncSubagents: AsyncSubAgent[] = [
  {
    name: "researcher",
    description: "Research agent for information gathering and synthesis",
    graphId: "researcher",
    // No url → ASGI transport (co-deployed in the same deployment)
  },
  {
    name: "coder",
    description: "Coding agent for code generation and review",
    graphId: "coder",
    url: "https://coder-deployment.langsmith.dev", // Optional: HTTP transport for remote
  },
];

const agent = createDeepAgent({
  model: "claude-sonnet-4-6",
  subagents: [...asyncSubagents],
});
```

### `AsyncSubAgent` fields

| Field | Type | Description |
| ------------- | ------------------------ | ----------------------------------------------------------------------------------------------- |
| `name` | `string` | Required. Unique identifier; supervisor uses this when launching tasks. |
| `description` | `string` | Required. What this subagent does; supervisor uses this for delegation decisions. |
| `graphId` | `string` | Required. Graph/assistant ID on the Agent Protocol server. Must match `langgraph.json` for LangGraph deployments. |
| `url` | `string` | Optional. Omit for ASGI (in-process); set for HTTP transport to a remote server. |
| `headers` | `Record<string, string>` | Optional. Additional headers for custom authentication with self-hosted servers. |

For co-deployed setups, register all graphs in the same `langgraph.json`:

```json
{
  "graphs": {
    "supervisor": "./src/supervisor.py:graph",
    "researcher": "./src/researcher.py:graph",
    "coder": "./src/coder.py:graph"
  }
}
```

## Supervisor Tools (AsyncSubAgentMiddleware)

The `AsyncSubAgentMiddleware` injects five tools into the supervisor's LLM:

| Tool | Purpose | Returns |
| ------------------- | ----------------------------------------- | ----------------------------- |
| `start_async_task` | Start a new background task | Task ID (immediately) |
| `check_async_task` | Get current status and result of a task | Status + result (if complete) |
| `update_async_task` | Send new instructions to a running task | Confirmation + updated status |
| `cancel_async_task` | Stop a running task | Confirmation |
| `list_async_tasks` | List all tracked tasks with live statuses | Summary of all tasks |

The middleware handles thread creation, run management, and state persistence automatically.

## Lifecycle

A typical interaction:

1. **Launch** — creates a new thread on the [[agent-protocol]] server, starts a run with the task description as input, and returns the thread ID as the task ID. The supervisor reports the ID to the user and does not poll.
2. **Check** — fetches the current run status. If the run succeeded, retrieves thread state to extract the subagent's final output; if still running, reports that to the user.
3. **Update** — creates a new run on the same thread with an interrupt multitask strategy. The previous run is interrupted; the subagent restarts with full conversation history plus new instructions. Task ID stays the same.
4. **Cancel** — calls `runs.cancel()` on the server and marks the task as `"cancelled"`.
5. **List** — iterates over all tracked tasks; fetches live status for non-terminal tasks in parallel; returns terminal statuses (`success`, `error`, `cancelled`) from cache.

## State Management

Task metadata is stored in a dedicated `asyncTasks` state channel on the supervisor's graph, separate from message history. This is critical because [[deep-agents-overview|DeepAgents]] compacts message history when the context window fills (summarization). If task IDs lived only in tool messages, they would be lost during compaction. The dedicated channel ensures the supervisor can always recall its tasks via `list_async_tasks` across many rounds of summarization.

Each tracked task records: task ID, agent name, thread ID, run ID, status, and timestamps (`createdAt`, `checkedAt`, `updatedAt`).

## Transport Options

### ASGI (co-deployed, recommended default)

Omit the `url` field. SDK calls route through in-process function calls rather than HTTP. Zero network latency; no extra auth needed. Requires both graphs registered in the same `langgraph.json`.

### HTTP (remote)

Set `url` to a remote Agent Protocol server. LangGraph deployments authenticate via `LANGSMITH_API_KEY` / `LANGGRAPH_API_KEY`. Use HTTP when subagents need independent scaling, different compute profiles, or are maintained by a different team.

### Hybrid

Some subagents co-deployed (no `url`), others remote (`url` set). Mix both transport types freely in a single `asyncSubagents` array.

## Deployment Topologies

- **Single deployment** — all agents on one server, ASGI transport. Recommended starting point.
- **Split deployment** — supervisor on one server, subagents on another via HTTP.
- **Hybrid** — mix of ASGI and HTTP within the same supervisor.

## Best Practices

- **Worker pool sizing** — each active run occupies one worker slot. A supervisor with 3 concurrent subagent tasks needs 4 slots (1 supervisor + 3 subagents). Run `langgraph dev --n-jobs-per-worker 10` for local development to avoid launch queuing.
- **Descriptive subagent names** — the supervisor LLM uses `description` to pick which agent to launch. Be specific and action-oriented; avoid vague names like "helper".
- **Tracing** — every async subagent run is a standard LangGraph run, visible in LangSmith. Correlate supervisor and subagent traces by thread ID (= task ID).

## Common Troubleshooting

| Problem | Cause | Fix |
| --- | --- | --- |
| Supervisor polls immediately after launch | LLM ignores middleware prompt rules | Add explicit `"After launching, ALWAYS return control to the user. Never call check immediately after launch."` to system prompt |
| Supervisor reports stale status | Model reads task status from message history instead of calling `check` | Instruct model to always call `check` or `list` before reporting status |
| Task ID lookup failures | Model truncates or reformats the task ID | Add `"always use the full task_id, never truncate or abbreviate it"` to system prompt; or switch models |
| Subagent launches queue / hang | Worker pool exhausted | Increase with `--n-jobs-per-worker` |

## Reference Implementation

The [async-deep-agents](https://github.com/langchain-ai/async-deep-agents) repository provides working Python and TypeScript examples deploying to LangSmith Deployments, demonstrating a supervisor with researcher and coder subagents as background tasks.

## Related

- [[subagents]] — sync sibling; blocks supervisor until completion
- [[deep-agents-overview]] — createDeepAgent, middleware, and the broader DeepAgents framework
- [[agent-protocol]] — the communication protocol async subagents require
- [[composite-backend]] — backend routing for supervisor state storage

## Sources

- `raw/langchain/deepagents/async-subagents.md` — full API reference and lifecycle documentation for async subagents (deepagents 1.9.0+)
