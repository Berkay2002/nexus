---
created: 2026-04-12
updated: 2026-04-12
tags: [deepagents, context-engineering, orchestrator, subagent]
sources: [raw/langchain/deepagents/context-engineering.md]
---

# Context Engineering in DeepAgents

Context engineering is the practice of providing the right information and tools in the right format so a deep agent can accomplish tasks reliably. DeepAgents exposes five distinct context types, each operating at a different scope and lifecycle.

## The Five Context Types

| Context Type | What You Control | Scope |
|---|---|---|
| **[[input-context]]** | System prompt, memory files, skills, tool prompts | Static, applied each run |
| **[[config-runtime-context\|Runtime context]]** | User metadata, API keys, feature flags passed at invoke time | Per run, propagates to subagents |
| **[[context-compression]]** | Automatic offloading and summarization when context window fills | Automatic, threshold-triggered |
| **[[context-isolation]]** | Subagents quarantine heavy tool work; only the final result returns | Per subagent delegation |
| **[[memory\|Long-term memory]]** | Persistent filesystem paths backed by a store across threads | Persistent across conversations |

## Choosing the Right Type

- **Static domain knowledge and conventions** → input context (memory or skills)
- **Per-request identity, credentials, or flags** → runtime context
- **Automatic token-budget management** → context compression (no action required, tuning optional)
- **Multi-step research, large tool outputs** → context isolation via [[subagents]]
- **User preferences across sessions** → long-term memory with [[composite-backend]] + `StoreBackend`

## Best Practices

1. Keep memory minimal — only load always-relevant conventions; use focused [[skills]] for task-specific workflows.
2. Delegate output-heavy tasks to subagents so the main agent's context stays clean.
3. Instruct subagents to return summaries (under 500 words) rather than raw data.
4. Write large results to the filesystem — the agent re-reads with `read_file`/`grep` on demand.
5. Document what lives in `/memories/` in the system prompt so the agent knows where to look and write.
6. Pass user metadata and API keys via `context` at invoke time; never hardcode them in the system prompt.

## Related

- [[input-context]]
- [[context-compression]]
- [[context-isolation]]
- [[config-runtime-context]]
- [[memory]]

## Sources

- `raw/langchain/deepagents/context-engineering.md` — canonical DeepAgents context engineering overview: 5 types table, best practices, configuration
