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

Key planned structure: `src/nexus/` with `graph.ts` (entry), `meta-router.ts`, `orchestrator.ts`, `subagents/`, `tools/`, `backend/`, `middleware/`, plus `skills/` and `memories/` directories.

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
| Models | Google Gemini: `gemini-3-flash-preview` (router/orchestrator), `gemini-3.1-pro-preview` (sub-agents), `gemini-3.1-flash-image-preview` (images) |
| Execution | AIO Sandbox Docker + `@agent-infra/sandbox` TS SDK |
| Search | Tavily (Search/Extract/Map) + Exa (neural/semantic) |
| Frontend streaming | `@langchain/langgraph-sdk/react` `useStream` hook |
| UI components | shadcn/ui + AI Elements (`@ai-elements/react`) |
| Persistence | SQLite + Drizzle ORM via LangGraph StoreBackend |

## Working with Documentation

Docs files are large. Always read headers first (`grep ^#{2,3} file.md`), then read targeted chunks. Each docs folder has a NEXUS.md index — check it before diving into raw files.

## Known Gotchas

- `useStream` comes from `@langchain/langgraph-sdk/react`, NOT `@langchain/react` (both packages are needed but for different purposes)
- AIO Sandbox home directory is `/home/gem/` — workspace lives at `/home/gem/workspace/`
- Scaffold `apps/agents/package.json` has wrong dependencies (Anthropic, Elasticsearch, Pinecone, MongoDB) — must be replaced with Google Gemini, Tavily, Exa, SQLite
- Scaffold `.env.example` has been replaced — uses Vertex AI (not Gemini Developer API): GOOGLE_GENAI_USE_VERTEXAI, GOOGLE_CLOUD_PROJECT, GEMINI_API_KEY, TAVILY_API_KEY, EXA_API_KEY
- `SubagentStreamInterface` has no `model` field — derive from `subagent_type` via static mapping
- `stream.values` can be undefined initially — always use `stream.values?.todos` with optional chaining
- DeepAgents always adds a general-purpose subagent alongside custom ones — must be addressed
- CompositeBackend wrapping a sandbox as default route is untested in docs — verify early in Plan 1

## Current State

Scaffold from `create-agent-chat-app`. The `apps/agents/src/research-agent/` and scaffold dependencies (Anthropic, Elasticsearch, Pinecone, MongoDB) will be replaced per the design spec. No tests configured yet.

## Workspace Convention

All agents share the AIO Sandbox filesystem. Workspace root: `/home/gem/workspace/`. Folders by agent type, subfolders by task call ID:
```
/home/gem/workspace/{research|code|creative|orchestrator}/task_{id}/
/home/gem/workspace/shared/   ← final deliverables
```
