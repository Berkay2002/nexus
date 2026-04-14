# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Nexus is a Turborepo npm-workspaces monorepo with two apps:
- `apps/agents/` — LangGraph server (Node 20, DeepAgents-based meta-router + orchestrator + sub-agents)
- `apps/web/` — Next.js 16 / React 19 frontend, streams via `@langchain/react`

The source of truth for architecture is `docs/superpowers/specs/2026-04-10-nexus-design.md`. Topic-scoped rules live in `.claude/rules/` (`architecture.md`, `agents.md`, `frontend.md`) and are auto-loaded — read them before touching the relevant subsystem.

## Dev commands

All from repo root unless noted. Turbo fans out to the relevant workspace.

- `npm run dev` — runs `turbo dev --filter=web` + `turbo dev --filter=agents` concurrently (Next.js :3000 + LangGraph :2024)
- `npm run lint` / `npm run lint:fix` — ESLint flat config in both apps
- `npm run format` — Prettier (printWidth 80, 2-space, semis, trailing-comma es5, LF)
- `cd apps/agents && npm test` — Vitest unit tests
- `cd apps/agents && npm run generate:mcp-wrappers` — regenerates cold MCP tool wrappers (`tsx scripts/generate-mcp-wrappers.ts`)

**Build gotcha:** `npm run build` from the root fails because `apps/agents` has pre-existing TS errors in test files and `db/index.ts`. To build the web app, run `npx next build` inside `apps/web/` directly.

## Verification pass-bar

When verifying a change, "green" means everything passes **except** these three integration tests, which require live services / API keys and are expected to fail locally:

- `apps/agents/src/nexus/__tests__/integration.test.ts` (Meta-Router — needs a model provider key)
- `apps/agents/src/nexus/__tests__/tools-integration.test.ts` (Tavily — needs `TAVILY_API_KEY`)
- `apps/agents/src/nexus/backend/__tests__/aio-sandbox.test.ts` (needs the `ghcr.io/agent-infra/sandbox` container running)

Don't rewrite these or treat their failure as a regression.

## Runtime prerequisites

Agents fail fast without a resolvable model tier — preflight diagnostics print at startup from `apps/agents/src/nexus/preflight.ts`. Always read that output before debugging "why isn't the agent responding".

Required env (in `.env`):
- At least one provider: `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `ZAI_API_KEY`, or Vertex via `GOOGLE_CLOUD_PROJECT` + `gcloud auth application-default login`
- `TAVILY_API_KEY`
- `SANDBOX_URL=http://localhost:8080`
- `NEXT_PUBLIC_API_URL=http://localhost:2024`
- Image generation (creative sub-agent) requires Google credentials or it's disabled
- **Z.AI base URL**: default is `https://api.z.ai/api/paas/v4` (pay-as-you-go). On the GLM Coding Plan set `ZAI_BASE_URL=https://api.z.ai/api/coding/paas/v4`. See `apps/agents/src/nexus/models/registry.ts` for tier priority.

AIO Sandbox runs in a separate container:
```
docker run --security-opt seccomp=unconfined --rm -it -p 8080:8080 ghcr.io/agent-infra/sandbox:latest
```

Vitest does not auto-load `.env` — for integration tests that need keys, `source .env && export VAR_NAME` before running.

## Gotchas

Things that are easy to get wrong and not obvious from the code alone.

**Frontend streaming**
- `useStream` must come from `@langchain/react` (≥0.3.3), **not** `@langchain/langgraph-sdk/react` — the sdk version lacks `filterSubagentMessages`, `stream.subagents`, `getSubagentsByMessage`.
- `filterSubagentMessages: true` is typed on `AnyStreamOptions` but not on the `UseStreamOptions` overload → cast options as `any`.
- `stream.values` can be `undefined` initially — always optional-chain (`stream.values?.todos`).
- `SubagentStreamInterface` has no `model` field — derive from `toolCall.args.subagent_type` via the static mapping.

**Icons**
- shadcn icon library is **hugeicons**. Import `HugeiconsIcon` from `@hugeicons/react` (not `HugeIcon`) and icons like `ArrowUp01Icon` from `@hugeicons/core-free-icons` (not `ArrowUpIcon`).

**Sandbox workspace**
- Home is `/home/gem/`; workspace root is `/home/gem/workspace/`. Layout convention is in `.claude/rules/agents.md`.

**Model providers**
- Auto-detected from env. At least one provider is required for the `default` tier. Image generation needs Google.
- Z.AI uses `ZaiChatOpenAI` (`apps/agents/src/nexus/models/zai-chat-model.ts`), a `ChatOpenAI` subclass that round-trips `reasoning_content` to preserve GLM thinking across multi-turn tool calls — no per-call config needed.

**DeepAgents**
- `createDeepAgent()` always adds a general-purpose sub-agent alongside custom ones — address it explicitly when wiring orchestration.
- `FileData` from `deepagents` is a union of `FileDataV1` (`content: string[]`) and `FileDataV2` (`content: string | Uint8Array`). Skills use V1 (line array).
- Skills are seeded via `orchestrator.invoke({ files: nexusSkillFiles })`; the `apps/agents/src/nexus/skills/index.ts` barrel recursively collects files as a `FileData` map with virtual POSIX paths (`/skills/{name}/...`).

**Tool folder shape**
- Each custom tool lives under `apps/agents/src/nexus/tools/{name}/` with `prompt.ts` (`TOOL_NAME` + `TOOL_DESCRIPTION`) and `tool.ts` (Zod schema + impl). Folder names are short: `search/`, `extract/`, `map/`, `generate-image/`.
- Tavily Map response shape: returns `results` (array of URL strings) and `base_url`, **not** `urls`. Check `docs/custom/` OpenAPI specs for actual shapes before inferring.

## Working style in this repo

- Be terse. Don't restate diffs or summarize at the end.
- Propose a plan before non-trivial edits (multi-file changes, refactors, new subsystems) and wait for confirmation.
- Run lint / typecheck / relevant tests before claiming work is done — evidence before assertions.
- On refactors, surface alternatives and state why the chosen path wins.
