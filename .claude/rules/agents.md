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

## Implemented Agent Structure
All agent code lives under `apps/agents/src/nexus/`:
- `agents/{research,code,creative,general-purpose}/` — each has `agent.ts` (factory returning `SubAgent | null` when its tier is unavailable) + `prompt.ts` (system prompt)
- `agents/index.ts` — `getNexusSubagents()` filter that always includes general-purpose and drops factories whose tier can't be resolved
- `tools/{search,extract,map,generate-image}/` — each has `tool.ts` (Zod schema + impl) + `prompt.ts` (TOOL_NAME + TOOL_DESCRIPTION)
- `tools/index.ts` — barrel export with grouped tool arrays (`researchTools`, `creativeTools`, `allTools`)
- `skills/{deep-research,build-app,generate-image,data-analysis,write-report}/` — each has `SKILL.md`, `examples.md`, `templates/`
- `skills/index.ts` — barrel export that recursively collects skill files as `FileData` map
- `models/` — Provider-agnostic tier registry (`types.ts`, `providers.ts`, `availability.ts`, `registry.ts`, `index.ts`). Use `resolveTier("<tier>")` to obtain a `BaseChatModel` for a role. Tiers: `classifier` | `default` | `code` | `deep-research` | `image`. Override with `"<provider>:<model-id>"` strings via `configurable.models` or `context.models`.
- `backend/` — `aio-sandbox.ts`, `composite.ts`, `store.ts`
- `middleware/configurable-model.ts` — per-role runtime model swapping via closure-per-agent factory `createConfigurableModelMiddleware(agentName)`
- `prompts/orchestrator-system.ts` — orchestrator system prompt with delegation and skills guidance
- `db/` — SQLite schema with Drizzle ORM

## Tool Definitions
Use LangChain `tool()` with Zod schemas. Use snake_case parameter names matching the underlying APIs (Tavily). Access API keys via `runtime.context` — never hardcode.

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
- Skills are seeded via `orchestrator.invoke({ files: nexusSkillFiles })` — the barrel export at `skills/index.ts` recursively collects all skill files as a `FileData` map with virtual POSIX paths (`/skills/{name}/...`)

## General-Purpose Subagent
DeepAgents always adds a GP subagent alongside custom ones. The `general-purpose/` agent overrides it with a custom prompt that defers to specialized agents.
