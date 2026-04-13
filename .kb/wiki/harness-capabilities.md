---
created: 2026-04-12
updated: 2026-04-13
tags: [deepagents, agent-harness, orchestration, middleware]
sources: [raw/langchain/deepagents/overview.md, raw/langchain/deepagents/customize.md]
---

# Harness Capabilities

The [[deep-agents-overview|DeepAgents harness]] bundles six capabilities that compose automatically into every agent created with [[create-deep-agent]]. This article details each one.

## 1. Planning Capabilities

The harness injects a `write_todos` tool into every deep agent. See [[todo-list-middleware]] for the full middleware spec.

- Tasks have statuses: `'pending'`, `'in_progress'`, `'completed'`
- The todo list is persisted in agent state, surviving tool calls
- Designed for long-running multi-step work where the agent must track progress across many rounds

## 2. Virtual Filesystem Access

A configurable virtual filesystem backed by pluggable [[backends]]. See [[filesystem-middleware]] for the complete tool reference including multimodal support.

The core tools:

| Tool | Description |
|---|---|
| `ls` | List directory contents with size and modified-time metadata |
| `read_file` | Read with line numbers; supports offset/limit for large files; returns multimodal blocks for images, video, audio, PDF |
| `write_file` | Create new files |
| `edit_file` | Exact string replacement with optional global-replace mode |
| `glob` | Pattern-match file paths (e.g., `**/*.py`) |
| `grep` | Search content with modes: files-only, content-with-context, or counts |
| `execute` | Run shell commands — only available when using a [[deepagents-sandboxes|sandbox backend]] |

The virtual filesystem underpins skills, [[memory]], context management, and code execution. Custom tools and middleware can also use it directly.

## 3. Task Delegation (Subagents)

The harness adds a `task` tool to the main agent. Invoking it spawns an ephemeral [[subagents|subagent]] — a fresh agent instance with its own context.

Key properties:
- **Context isolation** — subagent work does not accumulate in the orchestrator's context window
- **Parallel execution** — multiple [[async-subagents]] can run concurrently
- **Specialization** — each subagent gets its own tools and system prompt
- **Token efficiency** — the subagent's full execution is compressed into a single final report returned to the orchestrator
- **Stateless** — subagents cannot send multiple messages back; one task, one result

A "general-purpose" subagent is always present by default, with filesystem tools pre-configured. Custom subagents override or extend this via the `subagents` parameter on [[create-deep-agent]].

## 4. Context Management

The harness actively manages the agent's context window for long-running tasks:

- **Input context** — system prompt, [[memory]], [[skills]], and tool prompts are injected at startup
- **Compression** — built-in offloading and summarization trim context as the conversation grows. See [[context-engineering]] for configuration.
- **Isolation** — subagents quarantine heavy subtask work; only the result re-enters the main context
- **Long-term memory** — persistent storage via the virtual filesystem, available across threads

This enables tasks that would otherwise exceed a single context window without requiring manual message pruning.

## 5. Code Execution

When a [[deepagents-sandboxes|sandbox backend]] implementing `SandboxBackendProtocolV2` is detected, the harness automatically adds the `execute` tool.

- **Without a sandbox** — only filesystem tools are available; no shell execution
- **With a sandbox** — `execute` runs shell commands in an isolated Docker environment
- **Output** — returns combined stdout/stderr, exit code; truncates large outputs and saves the remainder to a file for incremental reading

Security and reproducibility rationale: agents run code in isolation, protecting the host system and ensuring consistent environments across runs.

## 6. Human-in-the-Loop (HITL)

Opt-in via the `interruptOn` parameter on [[create-deep-agent]]. Requires a `checkpointer`.

- Map tool names to `true` (approve/edit/reject), `false` (never interrupt), or `InterruptOnConfig` (restrict available decisions)
- Agent pauses **before** executing the matched tool call
- Human can approve, edit tool inputs, or reject the call; behaviour depends on `allowedDecisions`
- Useful for: safety gates on destructive ops, verification before expensive API calls, interactive debugging

See [[deepagents-human-in-the-loop]] for the full API surface and examples.

## Related

- [[deep-agents-overview]]
- [[create-deep-agent]]
- [[deepagents-human-in-the-loop]]
- [[todo-list-middleware]]
- [[filesystem-middleware]]
- [[subagents]]

## Sources

- `raw/langchain/deepagents/overview.md` — all six capability sections with feature bullets and how-it-works descriptions
- `raw/langchain/deepagents/customize.md` — HITL section: interruptOn parameter name correction, allowedDecisions shape, checkpointer requirement
