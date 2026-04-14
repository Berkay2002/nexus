# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Nexus is a local-first AI agent platform that takes a single user prompt, orchestrates multiple AI agents (research, code, creative) to work in parallel, and assembles a deliverable. Inspired by Perplexity Computer. Full TypeScript end-to-end. Turborepo monorepo scaffolded from `npx create-agent-chat-app`.

## Knowledge Base — read this before doing anything else

This project has a wikillm knowledge base at `.kb/`. **For ANY question — about libraries, APIs, architecture, conventions, design decisions, framework behavior, or "how does X work" — call `/wikillm:query` BEFORE grepping code, reading files, or answering from training-data memory.** The wiki is the project's compiled understanding of its third-party stack; re-deriving answers from raw sources defeats the entire compile step.

**Anti-patterns (do not do these):**

- **Do not grep or read `.kb/raw/` directly.** Raw sources are the INPUT to the wiki, not a reference. Go through `/wikillm:query`.
- **Do not answer from training-data memory of LangChain, DeepAgents, AIO Sandbox, Tavily, or any library in the stack.** Your training-data memory is stale and underspecified; the wiki has the version-current API shapes and the Nexus-specific gotchas.
- **Do not spelunk code when a wiki article exists.** Querying the wiki for "how does CompositeBackend route /memories/" is faster and more accurate than reading `backend/composite.ts` + its tests.
- **Do not paste library docs into `CLAUDE.md` or `docs/`.** Reference material goes in `.kb/raw/` followed by `/wikillm:ingest`.

**Obsidian desktop is always running on this machine.** For any direct vault operation (search, read, list tags, find orphans, write a note) use `/wikillm:obsidian-cli` — never Grep or Read on `.kb/wiki/` directly. Direct file access bypasses Obsidian's index and breaks backlinks on edits.

**Scope.** The KB covers third-party reference material only. Nothing in `apps/` imports from `.kb/`, and the KB does NOT cover Nexus's own code — for project-specific wiring (function names, which file exports what), read the source directly. Human-authored specs and plans live in `docs/superpowers/` and are NOT part of the KB.

## Design Spec

The comprehensive design specification lives at `docs/superpowers/specs/2026-04-10-nexus-design.md`. It covers architecture, technology choices, meta-router, orchestrator, sub-agents, workspace conventions, tools, skills, and frontend. **Consult this before making architectural decisions.**

The MCP filesystem-of-tools pattern (how sub-agents reach the sandbox's MCP tool catalog without binding every tool to LangChain) has its own spec at `docs/superpowers/specs/2026-04-13-mcp-filesystem-of-tools-design.md` and implementation plan at `docs/superpowers/plans/2026-04-14-mcp-filesystem-of-tools.md`. **Do NOT adopt `@langchain/mcp-adapters` anywhere in `apps/agents/` runtime** — that library was explicitly rejected in favor of the custom filesystem pattern. The generator at `apps/agents/scripts/generate-mcp-wrappers.ts` emits committed wrapper files; `apps/agents/src/nexus/backend/sandbox-bootstrap.ts` seeds them into `/home/gem/nexus-servers/` inside the sandbox at LangGraph startup; `apps/agents/src/nexus/tools/mcp-tool-search/` indexes the host-side tree and returns sandbox-side paths that agents read + execute via `sandbox_nodejs_execute`.

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

## Known Gotchas

- `useStream` comes from `@langchain/react` (v0.3.3+) for subagent features (`filterSubagentMessages`, `stream.subagents`, `getSubagentsByMessage`). The `@langchain/langgraph-sdk/react` version lacks these. `filterSubagentMessages` is typed on `AnyStreamOptions` but not on the `UseStreamOptions` overload — requires `as any` on the options object.
- shadcn icon library is `hugeicons` — import `HugeiconsIcon` from `@hugeicons/react` (not `HugeIcon`), icons like `ArrowUp01Icon` from `@hugeicons/core-free-icons` (not `ArrowUpIcon`)
- AIO Sandbox home directory is `/home/gem/` — workspace lives at `/home/gem/workspace/`
- Model providers are auto-detected from env vars (Google / Anthropic / OpenAI / Z.AI). At least one is required for the default tier; Google is required for image generation. Z.AI reuses `ChatOpenAI` via `ZaiChatOpenAI` (`apps/agents/src/nexus/models/zai-chat-model.ts`), a subclass that round-trips `reasoning_content` to preserve GLM thinking across multi-turn tool calls — no per-call configuration needed. Defaults to `https://api.z.ai/api/paas/v4`; set `ZAI_BASE_URL=https://api.z.ai/api/coding/paas/v4` when on the GLM Coding Plan. See `apps/agents/src/nexus/preflight.ts` for the runtime check and `models/registry.ts` for the tier priority.
- `SubagentStreamInterface` has no `model` field — derive from `subagent_type` via static mapping
- `stream.values` can be undefined initially — always use `stream.values?.todos` with optional chaining
- DeepAgents always adds a general-purpose subagent alongside custom ones — must be addressed
- Custom tools live in `tools/{name}/prompt.ts` (TOOL_NAME + TOOL_DESCRIPTION) + `tool.ts` (Zod schema + implementation). Short folder names: `search/`, `extract/`, `map/`, `generate-image/`
- Tavily Map API returns `results` (array of URL strings) and `base_url`, NOT `urls` — check `docs/custom/` OpenAPI specs for actual response shapes
- Vitest does not auto-load `.env` — for integration tests needing API keys: `source .env && export VAR_NAME` before running
- `FileData` from `deepagents` is a union of `FileDataV1` (`content: string[]`) and `FileDataV2` (`content: string | Uint8Array`). Skills use V1 format (line array).
- Skills are seeded via `orchestrator.invoke({ files: nexusSkillFiles })` — the barrel export at `skills/index.ts` recursively collects all skill files as a `FileData` map with virtual POSIX paths (`/skills/{name}/...`)
- `apps/agents` has pre-existing TypeScript build errors (test files, db/index.ts) — use `npx next build` in `apps/web/` directly instead of `npm run build` from root
- `apps/agents/vitest.config.ts` has a `setupFiles` entry pointing at `src/nexus/__tests__/setup-fs-mock.ts`. That shim calls `vi.mock("fs", ...)` with a real-implementation spread so `vi.spyOn(fs, "readdirSync")` can work on the native `fs` namespace in ESM mode — required by `mcp-tool-search.test.ts`'s "readyChecker false → fs untouched" assertion. The shim re-exports every real implementation, so it doesn't change behavior. **Do not remove it** unless you've first rewritten the affected test to not spy on native `fs`.
- Three integration tests fail on every local run without live services and API keys, and this is expected (not a regression): `__tests__/integration.test.ts > Meta-Router` (needs Google/Anthropic/OpenAI key), `__tests__/tools-integration.test.ts > Tavily` (needs `TAVILY_API_KEY`), `backend/__tests__/aio-sandbox.test.ts` (needs a running `ghcr.io/agent-infra/sandbox` container). When verifying a change, the pass bar is "everything green except these three files".

## Workspace Convention

All agents share the AIO Sandbox filesystem. Workspace root: `/home/gem/workspace/`. Folders by agent type, subfolders by task call ID:
```
/home/gem/workspace/{research|code|creative|orchestrator}/task_{id}/
/home/gem/workspace/shared/   ← final deliverables
```
