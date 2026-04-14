# Changelog

All notable changes to Nexus will be documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
project uses [semver](https://semver.org/) while pre-1.0.

## [Unreleased]

## [0.10.0] — 2026-04-14 — MCP filesystem-of-tools pattern

Cold-layer MCP wrapper catalog seeded into the sandbox at boot, with a hot-layer
search tool replacing the eager gateway wrappers.

### Added
- `sandbox-bootstrap` module seeds `/home/gem/nexus-servers/` with the MCP
  wrapper tree on orchestrator construction (`ensureSandboxFilesystem`,
  `isMcpFilesystemReady`)
- Dev-time generator emits the `sandbox-files/servers/` static asset tree from
  the sandbox OpenAPI catalog
- `mcp_tool_search` tool for keyword discovery of cold-layer wrappers;
  namespace-agnostic walker picks up new servers without code changes

### Changed
- Tools barrel drops eager `sandboxMcpListServers` / `ListTools` /
  `ExecuteTool` in favor of `mcp_tool_search`
- Spec, README, and ROADMAP updated to reflect the new directory structure and
  bootstrap process

### Fixed
- vitest `setup-fs-mock` shim so `vi.spyOn` works on native `fs` in ESM mode

## [0.9.0] — 2026-04-13 — Workspace artifacts & sandbox runtime expansion

Full sandbox runtime tool surface, workspace path remapping, and execution-view
artifact rendering.

### Added
- Execution-view artifact components: `ExecuteToolArtifact`,
  `GenerateImageArtifact`, `FilesystemToolArtifact`, terminal output,
  `WorkspaceOutputsPanel`
- Collapsible section headers and folder-tree rendering in the workspace
  outputs panel
- Sandbox runtime tool wrappers: code/nodejs execution, Jupyter lifecycle,
  browser automation, MCP gateway, convert-to-markdown
- Workspace helpers integrated into `AIOSandboxBackend` and the orchestrator
- Runtime instructions middleware for orchestrator context handling

### Changed
- `generate_image` now saves files directly to the sandbox and returns metadata
  with absolute file paths
- Research and code agents wired to the new sandbox tools with updated
  delegation prompts
- Thread-aware workspace file handling with path remapping

### Fixed
- `metaRouter` JSON recovery and complexity coercion for flaky classifier
  output
- Orchestrator sub-agent availability checks (skip factories whose tier cannot
  be resolved)

## [0.8.0] — 2026-04-12 — Wikillm knowledge base

Project-local reference wiki compiled from DeepAgents, LangChain, AIO Sandbox,
Tavily, and provider docs.

### Added
- `.kb/` vault with Obsidian-indexed wiki and `/wikillm:query` wired into the
  agent workflow
- Ingested DeepAgents (overview, backends, memory, models, skills, streaming,
  subagents, frontend stack)
- Ingested LangChain messages/models/tools plus Anthropic, Google, and OpenAI
  provider references
- Ingested AIO Sandbox README, deepagents example, and Tavily/Exa OpenAPI specs

### Changed
- `CLAUDE.md` directive makes the KB the canonical answer source for library
  APIs
- Vault `.gitignore`, Obsidian allowlist, and index reconciliation
  (`INDEX`/`TAGS`/`SOURCES`/`RECENT`)

## [0.7.0] — 2026-04-10 — Z.AI (GLM) provider with reasoning preservation

Fourth model provider with GLM thinking round-tripped across multi-turn tool
calls.

### Added
- `ZaiChatOpenAI` subclass of `ChatOpenAI` for the OpenAI-compatible endpoint
- `buildReasoningMap` and `injectReasoningContent` helpers that echo GLM
  `reasoning_content` into subsequent requests
- Unit and gated integration tests for the reasoning round-trip
- README rewrite and ROADMAP entry for prompt caching

### Changed
- Patched `completionWithRetry` to preserve reasoning across streaming and
  tool calls

## [0.6.0] — 2026-04-10 — Provider-agnostic model registry

Tiered, provider-agnostic model resolution across Google, Anthropic, and
OpenAI with UI overrides.

### Added
- Tier registry (`classifier` / `default` / `code` / `deep-research` / `image`)
  with auto-detected providers
- Per-role overrides via `configurable.models` and runtime middleware
- Web model settings panel and `/api/models` route
- Dynamic model badges on stream submit
- Preflight provider auto-detection and tier availability logging

### Changed
- Migrated from `@langchain/google-genai` to `@langchain/google` via
  `createGoogleModel`
- First merged PR (#1) with Copilot review feedback addressed

### Fixed
- Preflight fails fast when the default tier has no provider configured

## [0.5.0] — 2026-04-10 — Frontend execution UI

Landing page and 30/70 execution view streaming live agent state.

### Added
- Landing page (logo, tagline, prompt input) with dark-mode metadata
- `useNexusStream` hook exposing subagent streaming data with
  `filterSubagentMessages`
- Todo panel, agent status panel, subagent card, synthesis indicator, prompt
  bar
- `MessageFeed` with coordinator messages and subagent cards; `ExecutionView`
  routing
- `/demo` page with mock stream for offline UI work

### Changed
- Upgraded to Next.js 16 and React 19.2
- Integration and error-surfacing polish across the execution view

## [0.4.0] — 2026-04-10 — Sub-agents & skills

Orchestrator gains specialized sub-agents and a skills library seeded via
`CompositeBackend`.

### Added
- Research, Code, Creative, and general-purpose sub-agents with self-contained
  prompts
- Sub-agents wired into `createDeepAgent` via the `nexusSubagents` barrel
- Five skills: `deep-research`, `build-app`, `generate-image`, `data-analysis`,
  `write-report`
- `/skills/` `StoreBackend` route and recursive `FileData` collector

### Changed
- Orchestrator system prompt updated with delegation and skills guidance

## [0.3.0] — 2026-04-10 — Research tool suite

First user-facing tool set the agents can actually call.

### Added
- `tavily_search`, `tavily_extract`, `tavily_map` tools with prompt/tool split
- `generate_image` tool backed by Gemini Imagen
- Grouped barrel exports (`researchTools`, `creativeTools`, `allTools`)
- Tavily integration tests

### Fixed
- `tavily_map` response-shape mismatch (API returns `results`, not `urls`)

## [0.2.0] — 2026-04-10 — Sandbox backends, meta-router & orchestrator graph

First end-to-end meta-router → orchestrator pipeline; composite backend
routing established.

### Added
- `AIOSandboxBackend` extending `BaseSandbox` for the Docker sandbox
- `StoreBackend` and `CompositeBackend` factory routing `/memories/` to SQLite
- Minimal Nexus graph skeleton and state annotation with `routerResult`
- Flash meta-router with structured-output complexity classification
- `ConfigurableModel` middleware for per-role runtime model swapping
- `createDeepAgent` orchestrator wired into the main graph

### Changed
- Scaffold `research-agent` graph replaced; Nexus is now the sole registered
  graph

### Fixed
- Use spec-defined model names (`gemini-3-flash-preview`,
  `gemini-3.1-pro-preview`)
- `StoreBackend` namespace corrected to `["nexus"]` per design spec

## [0.1.0] — 2026-04-10 — Scaffold & dependency baseline

Turborepo scaffold from `create-agent-chat-app` swapped over to the Nexus
stack, with build and test plumbing in place.

### Added
- Initial Turborepo scaffold with shadcn/ui and ai-elements
- SQLite with Drizzle ORM in WAL mode
- Env template and vitest wired up for `apps/agents`

### Changed
- Replaced scaffold RAG deps with the Nexus stack (deepagents, google-genai,
  AIO sandbox, sqlite)
- Upgraded LangChain ecosystem to latest majors
- Upgraded zod to v4 for LangChain JS compatibility

[Unreleased]: https://github.com/Berkay2002/nexus/compare/v0.10.0...HEAD
[0.10.0]: https://github.com/Berkay2002/nexus/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/Berkay2002/nexus/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/Berkay2002/nexus/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/Berkay2002/nexus/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/Berkay2002/nexus/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/Berkay2002/nexus/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/Berkay2002/nexus/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/Berkay2002/nexus/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Berkay2002/nexus/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Berkay2002/nexus/releases/tag/v0.1.0
