---
created: 2026-04-13
updated: 2026-04-13
tags: [langgraph, agent-protocol, deepagents, async, stub]
sources: [raw/langchain/deepagents/async-subagents.md]
---

# Agent Protocol

Agent Protocol is the HTTP/ASGI communication protocol that LangGraph Platform servers speak. It defines how clients create threads, start runs, check run status, cancel runs, and stream output from hosted agents. [[async-subagents|Async subagents]] in DeepAgents require an Agent Protocol server — the supervisor talks to subagents as remote runs over this protocol rather than invoking them in-process.

## Role in DeepAgents

An Agent Protocol server is the runtime backbone for async subagents. The `AsyncSubAgentMiddleware` does not implement its own RPC — it wraps the LangGraph SDK, which in turn targets any server implementing Agent Protocol:

- **`start_async_task`** creates a new thread on the server and starts a run against a named `graphId`.
- **`check_async_task`** fetches current run status and, if terminal, pulls thread state for the final output.
- **`update_async_task`** starts a new run on the same thread with an `interrupt` multitask strategy, re-feeding the subagent its full state plus new instructions.
- **`cancel_async_task`** calls `runs.cancel()` on the server.

Every tracked task in the supervisor's `asyncTasks` state channel is keyed by the thread ID returned by the server on launch.

## Transports

Agent Protocol can be reached via two transports in DeepAgents:

- **ASGI (in-process)** — when no `url` is set on an `AsyncSubAgent`, the SDK routes calls through the same Python/Node ASGI app the supervisor runs in. Requires every graph to be registered in the same `langgraph.json`. Zero network latency, no separate auth.
- **HTTP (remote)** — when `url` is set, the SDK sends HTTP requests to a remote Agent Protocol server. LangGraph deployments authenticate via `LANGSMITH_API_KEY` / `LANGGRAPH_API_KEY`; self-hosted servers can add headers via the `headers` field.

Both transports expose the same semantic surface — threads, runs, state, multitask strategies — so supervisor code is identical across ASGI and HTTP subagents.

## Implementations

Any server that implements Agent Protocol works: the canonical implementations are **LangGraph Platform** (managed) and **LangGraph Server** started via `langgraph dev` / `langgraph up` for local development. Third parties can implement the protocol too — DeepAgents does not require LangGraph specifically, only the protocol surface.

## Related

- [[async-subagents]] — async DeepAgents subagents that run on Agent Protocol servers
- [[subagents]] — synchronous sibling that runs in-process instead of over the protocol
- [[deep-agents-overview]] — where the supervisor/subagent split lives
- [[composite-backend]] — how supervisor state is routed to persistent backends

## Sources

- `raw/langchain/deepagents/async-subagents.md` — describes the protocol as the communication layer required by async subagents; covers thread, run, update, and cancel semantics
