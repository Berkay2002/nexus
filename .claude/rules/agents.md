---
globs: apps/agents/**,skills/**,memories/**
---

# Agent Development Rules

## Skills for Agent Work

- **Implementing tools/sub-agents** → `test-driven-development` — tools have clear inputs/outputs, ideal for TDD
- **Creating Nexus agent skills** (SKILL.md files) → `writing-skills` + `skill-creator` — ensures proper frontmatter, progressive disclosure, and tested skill quality
- **Debugging agent behavior** → `systematic-debugging` — trace tool calls and streaming events before guessing
- **Parallel independent tasks** → `dispatching-parallel-agents` — e.g., building all 4 Tavily/Exa tools simultaneously

## Documentation References
Before implementing agent features, check the relevant NEXUS.md index file in `docs/` for what we need and where to find it. The docs files are large — read headers first, then relevant chunks.

## Workspace Convention
All agents write to `/home/gem/workspace/` inside the AIO Sandbox:
- `/home/gem/workspace/{research|code|creative}/task_{toolCallId}/` — per-agent-instance workspace
- `/home/gem/workspace/orchestrator/` — orchestrator scratch space
- `/home/gem/workspace/shared/` — final deliverables
- Any agent can READ from any path. The orchestrator tells sub-agents where to look via task descriptions.

## Tool Definitions
Use LangChain `tool()` with Zod schemas. Use snake_case parameter names matching the underlying APIs (Tavily, Exa). Access API keys via `runtime.context` — never hardcode.

## Sub-Agent System Prompts
Must include:
1. Clear role description
2. Which tools to use and when
3. Workspace path instruction: "Write outputs to /home/gem/workspace/{type}/task_{id}/"
4. Output format requirements
5. Conciseness instruction: "Return summary under 500 words to orchestrator. Write detailed data to filesystem."

## Skills (SKILL.md)
- Keep `description` frontmatter under 1024 characters (truncation limit)
- Keep files under 10 MB
- Skills for the orchestrator should include sub-agent delegation patterns
- One workflow per skill — avoid overlap between skills

## General-Purpose Subagent
DeepAgents always adds a GP subagent alongside custom ones. Either override it or instruct the orchestrator to prefer specialized agents.
