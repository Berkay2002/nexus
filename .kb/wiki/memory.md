---
created: 2026-04-12
updated: 2026-04-12
tags: [deepagents, memory, persistence, context-engineering]
sources: [raw/langchain/deepagents/memory.md]
---

# Memory (DeepAgents)

Memory in DeepAgents is the mechanism by which agents retain and recall information. It divides cleanly into **short-term** (within a single conversation) and **long-term** (across conversations), with long-term memory backed by the virtual filesystem and a persistent [[store-backend]].

## Content

### Short-term vs long-term

Short-term memory is the agent's conversation history and any scratch files written during a session. It is managed automatically as LangGraph state and does not persist after the thread ends. For details, see [[context-engineering]].

Long-term memory persists across threads. The agent reads and writes memory as ordinary files on the virtual filesystem. Because the filesystem is backed by a configurable [[backends|backend]], durability follows from backend choice: [[store-backend]] for persistence, `StateBackend` for ephemeral storage. See [[long-term-memory]] for full details.

### How the agent accesses memory

1. **Declare paths at creation** — pass file paths (e.g., `["/memories/AGENTS.md"]`) to `memory=` when calling `createDeepAgent`. The [[filesystem-middleware]] loads these into the system prompt at startup.
2. **On-demand reading** — the agent may also read files during the conversation using its built-in `read_file` tool without pre-loading them. [[skills]] use this pattern: only the skill description is loaded at startup; the full skill body is fetched when the task matches.
3. **Writing** — the agent updates memory via `edit_file`. Writes are live by default (hot path) or deferred to a background consolidation agent (sleep-time compute).

### Memory types by information kind

| Type | What it stores | Example file |
|------|---------------|--------------|
| Semantic | Facts, preferences | `/memories/AGENTS.md` |
| Episodic | Past conversation history | Thread checkpoints via LangGraph |
| Procedural | How-to instructions | `/skills/deep-research/SKILL.md` |

Episodic memory is implemented through LangGraph checkpointers — every conversation is a persisted thread. To make past threads searchable the agent wraps `client.threads.search` in a tool.

### Scope

Memory can be scoped per-user, per-agent, or per-organization by choosing the namespace passed to [[store-backend]]:

- **Agent-scoped** — `namespace: (ctx) => [ctx.runtime.serverInfo.assistantId]` — shared state evolves across all users.
- **User-scoped** — `namespace: (ctx) => [ctx.runtime.context.userId]` — isolated per user, no cross-contamination.
- **Organization-scoped** — `namespace: (ctx) => [ctx.runtime.context.orgId]` — shared policies, typically read-only.

### Read-only vs writable

Memory is read-write by default. Organization policies and developer-defined skills should be **read-only** — populate them via application code and use policy hooks on the backend to reject agent writes. This prevents prompt injection via shared state.

### Nexus usage

Nexus uses [[composite-backend]] with a `/memories/` route pointing to [[store-backend]] backed by SQLite. Skills are seeded at startup via `orchestrator.invoke({ files: nexusSkillFiles })`.

## Related

- [[long-term-memory]]
- [[context-engineering]]
- [[store-backend]]
- [[composite-backend]]
- [[filesystem-middleware]]

## Sources

- `raw/langchain/deepagents/memory.md` — full memory reference: scoped memory, episodic memory, background consolidation, read-only patterns
