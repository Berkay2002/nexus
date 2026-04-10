# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Nexus is a local-first AI agent platform that takes a single user prompt, orchestrates multiple AI agents (research, code, creative) to work in parallel, and assembles a deliverable. Inspired by Perplexity Computer. Full TypeScript end-to-end. Turborepo monorepo scaffolded from `npx create-agent-chat-app`.

## Design Spec

The comprehensive design specification lives at `docs/superpowers/specs/2026-04-10-nexus-design.md`. It covers architecture, technology choices, meta-router, orchestrator, sub-agents, workspace conventions, tools, skills, frontend, and an 8-plan implementation decomposition. **Consult this before making architectural decisions.**

## Documentation

Each documentation folder contains a `NEXUS.md` index file explaining what's relevant to Nexus and where to find it:

- `docs/langchain/deepagents/` — DeepAgents framework docs (createDeepAgent, backends, subagents, streaming, skills, memory)
- `docs/langchain/deepagents/frontend/` — Frontend patterns (useStream, AI Elements, subagent cards, sandbox IDE)
- `docs/langchain/langchain/` — LangChain core (messages, models, tools)
- `docs/aio-sandbox/` — AIO Sandbox docs and DeepAgents integration example
- `docs/references/` — API references (deepagents TS package, ChatGoogleGenerativeAI)
- `docs/custom/` — Tavily and Exa API specs (OpenAPI)

## Three-Process Architecture

```
AIO Sandbox (Docker :8080) <-- HTTP --> LangGraph Server (:2024) <-- useStream --> Next.js (:3000)
```

1. **AIO Sandbox** — Docker container providing shell, browser, filesystem, Jupyter. Shared by all agents.
2. **LangGraph Dev Server** — Runs meta-router (Flash classifier), orchestrator (DeepAgent), and sub-agents (Research, Code, Creative).
3. **Next.js Frontend** — Streams agent execution via `useStream` from `@langchain/langgraph-sdk/react`. Landing page (full-width prompt) → Execution view (30/70 split with todo list + agent cards).

## Build and Dev Commands

All commands from this directory (`nexus/`):

```bash
# Prerequisite: start AIO Sandbox
docker run --security-opt seccomp=unconfined --rm -it -p 8080:8080 ghcr.io/agent-infra/sandbox:latest

# Start both LangGraph server and Next.js concurrently
npm run dev

# Build all workspaces
npm run build

# Lint / format
npm run lint
npm run format
```

`npm run dev` uses `concurrently` to run `turbo dev --filter=web` (Next.js :3000) and `turbo dev --filter=agents` (LangGraph :2024).

## Monorepo Structure

- **Package manager:** npm 11.2.1 with workspaces
- **Build orchestration:** Turborepo
- **Workspaces:** `apps/agents` and `apps/web`
- **Shared override:** `@langchain/core` pinned to `^0.3.42`

### apps/agents — LangGraph Agent Server

`langgraph.json` at root registers graphs. Currently points to scaffold's `research-agent` — will be replaced with `nexus` graph.

Structure: `src/nexus/` — `graph.ts` (entry), `meta-router.ts`, `orchestrator.ts`, `state.ts`, `backend/` (aio-sandbox, composite, store), `middleware/` (configurable-model), `prompts/` (orchestrator-system), `tools/` (search, extract, map, generate-image — each with prompt.ts + tool.ts), `__tests__/`. 46 unit tests, 3 Tavily integration tests.

### apps/web — Next.js Frontend

Next.js 15 with React 19, Tailwind CSS, shadcn/ui, `@langchain/langgraph-sdk`.

Key infrastructure files to **preserve** during UI rewrites:
- `src/providers/Stream.tsx` — useStream hook, connects to LangGraph server, manages thread state
- `src/providers/client.ts` — LangGraph SDK client
- `src/providers/Thread.tsx` — thread list management
- `src/components/ui/` — shadcn/ui base components

## Technology Stack

| Concern | Technology |
|---------|-----------|
| Orchestration | DeepAgents (`createDeepAgent`, `SubAgent`, `CompositeBackend`, `BaseSandbox`) |
| Models | Tier-based, provider-agnostic. Tiers: `classifier`, `default`, `code`, `deep-research`, `image`. Providers auto-detected from env: Google (`@langchain/google`), Anthropic (`@langchain/anthropic`), OpenAI (`@langchain/openai`), Z.AI/GLM (via `@langchain/openai` pointed at z.ai's OpenAI-compatible endpoint). Priority: `classifier` / `deep-research` Google→Anthropic→OpenAI→Z.AI; `default` Anthropic→OpenAI→Z.AI→Google; `code` Anthropic→Google→OpenAI→Z.AI; `image` Google only. See `apps/agents/src/nexus/models/registry.ts`. |
| Execution | AIO Sandbox Docker + `@agent-infra/sandbox` TS SDK |
| Search | Tavily (Search, Extract, Map) — no Exa |
| Frontend streaming | `@langchain/react` `useStream` hook (subagent streaming, filterSubagentMessages) |
| UI components | shadcn/ui + AI Elements (`@ai-elements/react`) |
| Persistence | SQLite + Drizzle ORM via LangGraph StoreBackend |

## Working with Documentation

Docs files are large. Always read headers first (`grep ^#{2,3} file.md`), then read targeted chunks. Each docs folder has a NEXUS.md index — check it before diving into raw files.

## Known Gotchas

- `useStream` comes from `@langchain/react` (v0.3.3+) for subagent features (`filterSubagentMessages`, `stream.subagents`, `getSubagentsByMessage`). The `@langchain/langgraph-sdk/react` version lacks these. `filterSubagentMessages` is typed on `AnyStreamOptions` but not on the `UseStreamOptions` overload — requires `as any` on the options object.
- shadcn icon library is `hugeicons` — import `HugeiconsIcon` from `@hugeicons/react` (not `HugeIcon`), icons like `ArrowUp01Icon` from `@hugeicons/core-free-icons` (not `ArrowUpIcon`)
- AIO Sandbox home directory is `/home/gem/` — workspace lives at `/home/gem/workspace/`
- Model providers are auto-detected from env vars (Google / Anthropic / OpenAI / Z.AI). At least one is required for the default tier; Google is required for image generation. Z.AI reuses `ChatOpenAI` via `ZaiChatOpenAI` (`apps/agents/src/nexus/models/zai-chat-model.ts`), a subclass that round-trips `reasoning_content` to preserve GLM thinking across multi-turn tool calls — no per-call configuration needed. Defaults to `https://api.z.ai/api/paas/v4`; set `ZAI_BASE_URL=https://api.z.ai/api/coding/paas/v4` when on the GLM Coding Plan. See `apps/agents/src/nexus/preflight.ts` for the runtime check and `models/registry.ts` for the tier priority.
- `SubagentStreamInterface` has no `model` field — derive from `subagent_type` via static mapping
- `stream.values` can be undefined initially — always use `stream.values?.todos` with optional chaining
- DeepAgents always adds a general-purpose subagent alongside custom ones — must be addressed
- CompositeBackend wrapping a sandbox as default route is untested in docs — verify early in Plan 1
- Custom tools live in `tools/{name}/prompt.ts` (TOOL_NAME + TOOL_DESCRIPTION) + `tool.ts` (Zod schema + implementation). Short folder names: `search/`, `extract/`, `map/`, `generate-image/`
- Tavily Map API returns `results` (array of URL strings) and `base_url`, NOT `urls` — check `docs/custom/` OpenAPI specs for actual response shapes
- Vitest does not auto-load `.env` — for integration tests needing API keys: `source .env && export VAR_NAME` before running
- `FileData` from `deepagents` is a union of `FileDataV1` (`content: string[]`) and `FileDataV2` (`content: string | Uint8Array`). Skills use V1 format (line array).
- Skills are seeded via `orchestrator.invoke({ files: nexusSkillFiles })` — the barrel export at `skills/index.ts` recursively collects all skill files as a `FileData` map with virtual POSIX paths (`/skills/{name}/...`)
- `apps/agents` has pre-existing TypeScript build errors (test files, db/index.ts) — use `npx next build` in `apps/web/` directly instead of `npm run build` from root

## Current State

Plans 1-7 implemented. Scaffold research-agent removed. `langgraph.json` points to `nexus` graph.
- **Plan 1:** AIO Sandbox backend, CompositeBackend, StoreBackend, DB schema
- **Plan 2:** Meta-router (Flash classifier), ConfigurableModel middleware, orchestrator (DeepAgent), graph wiring
- **Plan 3:** Custom tools — `tavily_search`, `tavily_extract`, `tavily_map`, `generate_image` in `tools/{name}/prompt.ts + tool.ts`
- **Plan 4:** Sub-agents — research, code, creative, general-purpose in `agents/{name}/agent.ts + prompt.ts`
- **Plan 5:** Skills — 5 orchestrator skills in `skills/{name}/SKILL.md + examples.md + templates/`, barrel export, `/skills/` StoreBackend route, skills seeding
- **Plan 6:** Frontend landing page — deps upgraded to LangChain 1.x/zod 4/React 19.1/Next 15.5, StreamProvider refactored (no config form, `filterSubagentMessages`), dark mode, landing components (logo/tagline/prompt), `useNexusStream` hook, scaffold branding stripped
- **Plan 7:** Frontend execution view — 30/70 split in `apps/web/src/components/execution/` (`execution-shell`, `todo-panel`, `agent-status-panel`, `subagent-card`, `synthesis-indicator`, `prompt-bar`, `message-feed`), landing↔execution switch via `hasMessages` in `app/page.tsx`, all wired through `useNexusStream`
- **Provider-agnostic refactor (feat/provider-agnostic-models)**: Model selection is now tier-based. Supports Google, Anthropic, and OpenAI auto-detected from env vars with per-role UI overrides. See `apps/agents/src/nexus/models/` and `docs/superpowers/specs/2026-04-10-nexus-design.md` plus the plan file.
- **Next:** Plan 8 (End-to-End Integration & Polish)

## Workspace Convention

All agents share the AIO Sandbox filesystem. Workspace root: `/home/gem/workspace/`. Folders by agent type, subfolders by task call ID:
```
/home/gem/workspace/{research|code|creative|orchestrator}/task_{id}/
/home/gem/workspace/shared/   ← final deliverables
```
