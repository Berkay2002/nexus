---
created: 2026-04-12
updated: 2026-04-12
tags: [deepagents, langchain, agent-harness, orchestration]
sources: [raw/langchain/deepagents/overview.md]
---

# DeepAgents Overview

DeepAgents is a framework from LangChain for building long-running, multi-step AI agents. It provides an **agent harness** — a pre-assembled combination of capabilities that handles the hard parts of agentic work (planning, memory, file I/O, delegation, context budgeting, and safety gates) so you build the domain logic rather than the scaffolding.

Nexus is built directly on top of `createDeepAgent` from the TypeScript package.

## What Is an Agent Harness?

The harness is not a single feature — it is an integrated set of six capabilities that compose automatically:

1. **Planning** — agents use a built-in `write_todos` tool to maintain a structured task list persisted in agent state. See [[todo-list-middleware]].
2. **Virtual filesystem** — pluggable backend-backed file tools (`ls`, `read_file`, `write_file`, `edit_file`, `glob`, `grep`, `execute`). See [[filesystem-middleware]].
3. **Task delegation** — agents dispatch isolated [[subagents]] for parallelizable or context-heavy subtasks.
4. **Context management** — automatic compression, summarization, and isolation keep long-running tasks within token limits.
5. **Code execution** — when a [[deepagents-sandboxes|sandbox backend]] is present, the harness exposes `execute` for shell commands.
6. **Human-in-the-loop (HITL)** — optional `interrupt_on` gates that pause execution before specified tool calls for human review.

These capabilities are detailed in [[harness-capabilities]].

## Alongside the Harness: Skills and Memory

Beyond the six core capabilities, DeepAgents provides two additional context sources:

- **[[skills]]** — Per-task progressive disclosure. Each skill is a directory with a `SKILL.md` following the [Agent Skills standard](https://agentskills.io/). The agent reads frontmatter at startup and loads full skill content only when relevant, minimizing token usage. Nexus seeds skills via `orchestrator.invoke({ files: nexusSkillFiles })`.
- **[[memory]]** — Always-loaded persistent context using `AGENTS.md` files. Stores preferences, conventions, and guidelines that persist across conversations. Unlike skills, memory is unconditionally injected into every invocation.

## How to Create a Deep Agent

The entry point in TypeScript is [[create-deep-agent|`createDeepAgent()`]]. In Python it is `create_deep_agent()`. Both accept configuration for backends, subagents, skills, memory, middleware, and HITL interrupts.

## Backends

The virtual filesystem and code execution capabilities are both wired through pluggable [[backends]]. Nexus uses a [[composite-backend]] that routes:
- Default paths → `AIOSandboxBackend` (ephemeral workspace in Docker)
- `/memories/` → [[store-backend]] (SQLite persistence)
- `/skills/` → [[store-backend]] (skill file storage)

## Subagents

The harness provides a default "general-purpose" subagent automatically. Custom [[subagents]] can be added with specialized tools, system prompts, and middleware. All subagents are stateless — they execute autonomously and return a single final report. [[async-subagents]] allow the orchestrator to dispatch multiple in parallel.

## Related

- [[harness-capabilities]]
- [[create-deep-agent]]
- [[todo-list-middleware]]
- [[filesystem-middleware]]
- [[subagents]]

## Sources

- `raw/langchain/deepagents/overview.md` — canonical harness overview: all six capabilities, skills, memory
