# Index

Content catalog of the Nexus knowledge base, grouped by domain. Use `/wikillm:query` to search; use this index for browsing.

## DeepAgents — Overview & Harness

- [[deep-agents-overview]] — What DeepAgents is and the harness philosophy
- [[harness-capabilities]] — The six harness capabilities in detail
- [[create-deep-agent]] — The `createDeepAgent()` factory and its parameters
- [[deepagents-typescript-reference]] — The `deepagents` npm package surface (FileData V1/V2, exports)
- [[todo-list-middleware]] — The `write_todos` planning tool
- [[filesystem-middleware]] — The virtual filesystem tool surface
- [[deepagents-human-in-the-loop]] — DeepAgents HITL via `interruptOn` (distinct from LangGraph `interrupt()`)

## DeepAgents — Subagents

- [[subagents]] — Synchronous task delegation via subagents
- [[subagent-interface]] — The `SubAgent` dict and `CompiledSubAgent` class
- [[context-quarantine]] — Why subagents exist: the context-bloat problem
- [[general-purpose-subagent]] — The GP subagent added automatically (Nexus gotcha)
- [[async-subagents]] — Preview-feature async subagents with lifecycle control
- [[agent-protocol]] — HTTP/ASGI protocol that LangGraph servers speak; transport for async subagents

## DeepAgents — Backends & Filesystem

- [[backends]] — Umbrella for the filesystem backend system
- [[state-backend]] — Ephemeral in-state backend (default)
- [[filesystem-backend]] — Local disk persistence
- [[store-backend]] — Durable LangGraph Store persistence
- [[composite-backend]] — Route-based backend router (Nexus's primary pattern)
- [[local-shell-backend]] — Host shell and filesystem access
- [[backend-protocol]] — Protocol spec for custom backends (V1 vs V2)
- [[deepagents-sandboxes]] — Sandbox backends with the `execute` tool
- [[base-sandbox-protocol]] — Abstract protocol for custom sandboxes

## DeepAgents — Context, Memory & Skills

- [[context-engineering]] — DeepAgents-specific context engineering (5 types)
- [[input-context]] — System prompt assembly at startup
- [[context-compression]] — Offloading and summarization
- [[context-isolation]] — Subagents as context quarantine
- [[memory]] — Long-term memory in DeepAgents
- [[long-term-memory]] — `/memories/` filesystem persistence pattern
- [[skills]] — SKILL.md-based workflow instructions
- [[skill-md-format]] — SKILL.md file format and constraints

## DeepAgents — Models & Streaming

- [[deepagents-models]] — How DeepAgents accepts and configures models
- [[init-chat-model]] — The `initChatModel` factory
- [[streaming]] — Stream modes and configuration
- [[stream-modes]] — `messages` / `updates` / `values` / `custom` / `messages-tuple`
- [[subgraph-streaming]] — `subgraphs: true` for subagent namespaces

## DeepAgents — Frontend

- [[deepagents-frontend-overview]] — Frontend documentation umbrella
- [[use-stream-hook]] — `useStream` from `@langchain/react` (import path gotcha)
- [[filter-subagent-messages]] — The `filterSubagentMessages` option (typing gotcha)
- [[get-subagents-by-message]] — Attaching subagents to assistant messages
- [[subagent-streaming]] — Subagent cards and streaming pattern
- [[sandbox-ide]] — Frontend sandbox IDE visualization pattern
- [[frontend-sandbox-components]] — File tree, code panel, diff view components
- [[ai-elements]] — Composable shadcn/ui-based chat components
- [[ai-elements-components]] — AI Elements component catalog
- [[agent-chat-ui]] — LangChain's Agent Chat UI scaffold

## LangGraph — Core & Runtime

- [[context-overview]] — LangGraph context mechanisms (config/state/store)
- [[config-runtime-context]] — The `configurable` key at invoke time
- [[dynamic-runtime-context]] — LangGraph state as short-term memory
- [[cross-conversation-context]] — LangGraph Store for persistence
- [[langgraph-runtime]] — The Pregel BSP runtime model (Plan/Execute/Update phases)
- [[pregel]] — `Pregel` class API reference
- [[actors-and-channels]] — PregelNode actors, LastValue / Topic / BinaryOperatorAggregate channels
- [[langgraph-functional-api]] — `@entrypoint` + `task()` as an alternative to `StateGraph` (stub)

## LangGraph — Persistence

- [[langgraph-persistence]] — Umbrella: why persistence matters; the four features it enables
- [[checkpointer]] — `BaseCheckpointSaver`, `MemorySaver`, SQLite/Postgres/Mongo/Redis
- [[threads]] — `thread_id` as persistent cursor
- [[checkpoints]] — `StateSnapshot`, super-steps, pending writes
- [[langgraph-store]] — Cross-thread Store primitive (distinct from DeepAgents `StoreBackend`)
- [[durable-execution]] — Pause/resume model + determinism rules
- [[durability-modes]] — `sync` / `async` / `exit` mode comparison

## LangGraph — Interrupts & Human-in-the-Loop

- [[langgraph-interrupts]] — `interrupt()` semantics and `__interrupt__` field
- [[human-in-the-loop]] — LangGraph HITL pattern (approval, review-and-edit, multi-branch)
- [[command-resume]] — `Command({ resume })` mechanism for resuming interrupts

## LangGraph — Deployment & Tooling

- [[langgraph-application-structure]] — Directory layout for deployable LangGraph apps
- [[langgraph-config-file]] — `langgraph.json` schema reference
- [[langgraph-local-server]] — Running the LangGraph dev server on `:2024`
- [[langgraph-cli]] — `@langchain/langgraph-cli` commands
- [[langgraph-testing]] — Custom-structure graph testing patterns

## LangSmith

- [[langsmith-studio]] — Visual debugger for local LangChain/LangGraph agents

## LangChain Core

- [[langchain-messages]] — LangChain message types
- [[ai-message]] — AIMessage with tool calls and metadata
- [[tool-message]] — ToolMessage and `tool_call_id` linkage
- [[multimodal-content]] — Content blocks for images, audio, documents
- [[langchain-models]] — BaseChatModel interface umbrella
- [[chat-model-interface]] — `invoke` / `stream` / `batch` methods
- [[with-structured-output]] — Structured output via Zod/JSON schema
- [[bind-tools]] — Attaching tools to a chat model
- [[langchain-tools]] — LangChain tool system
- [[tool-decorator]] — The `tool()` factory
- [[tool-call]] — ToolCall round-trip
- [[zod-tool-schemas]] — Zod schemas for tool args
- [[langchain-mcp-adapters]] — `@langchain/mcp-adapters` / `MultiServerMCPClient` (path to the AIO Sandbox's 60 MCP tools via `POST /mcp`)

## LangChain — Testing & Evals

- [[langchain-testing-overview]] — Umbrella for the three testing layers
- [[langchain-unit-testing]] — Unit tests with `fakeModel` + in-memory persistence
- [[fake-model]] — The `fakeModel` fixture reference
- [[langchain-integration-testing]] — Real-API integration tests with vitest
- [[agent-evals]] — Trajectory evaluation with the `agentevals` package
- [[trajectory-match-evaluator]] — Deterministic trajectory matching (`strict` / `unordered` / `subset` / `superset`)
- [[llm-as-judge-evaluator]] — Qualitative LLM-judge evaluation

## Providers

- [[anthropic-provider]] — `@langchain/anthropic` package
- [[chat-anthropic]] — ChatAnthropic class (Claude)
- [[google-provider]] — `@langchain/google` package
- [[chat-google-generative-ai]] — ChatGoogleGenerativeAI class (Gemini)
- [[langchain-google-api-reference]] — `@langchain/google` API surface reference
- [[openai-provider]] — `@langchain/openai` package
- [[chat-openai]] — ChatOpenAI class (GPT / base for `ZaiChatOpenAI`)

## Anthropic Platform — Advanced Tool Use

- [[code-execution-with-mcp]] — Anthropic pattern: present MCP servers as a code API on a filesystem (150K → 2K token example)
- [[anthropic-advanced-tool-use]] — Umbrella for the three Nov 2025 beta features (`advanced-tool-use-2025-11-20`)
- [[tool-search-tool]] — On-demand tool discovery via `defer_loading: true` + `tool_search_tool_regex_20251119`
- [[programmatic-tool-calling]] — Sandboxed Python orchestration of tools marked with `code_execution` + `allowed_callers`
- [[tool-use-examples]] — `input_examples` field for showing Claude idiomatic usage patterns

## AIO Sandbox

- [[aio-sandbox-overview]] — What AIO Sandbox is (Docker agent environment)
- [[aio-sandbox-docker]] — Running the container
- [[aio-sandbox-features]] — Browser / shell / file / Jupyter / VSCode / MCP surfaces
- [[agent-infra-sandbox-sdk]] — `@agent-infra/sandbox` TS SDK
- [[aio-sandbox-deepagents-integration]] — Python BaseSandbox integration example

## AIO Sandbox — OpenAPI Surface

- [[aio-sandbox-openapi-overview]] — Catalog of all 41 endpoints across 11 tags (FastAPI :8080)
- [[aio-sandbox-sandbox-context-api]] — `/v1/sandbox/*` — environment introspection (OS, runtime, packages)
- [[aio-sandbox-shell-api]] — `/v1/shell/*` — persistent shell sessions, exec/view/wait/write/kill, SSE
- [[aio-sandbox-file-api]] — `/v1/file/*` — read/write/replace/search/find/upload/download/list/str_replace_editor
- [[aio-sandbox-browser-api]] — `/v1/browser/*` — Chromium-via-CDP automation + 15 action types
- [[aio-sandbox-jupyter-api]] — `/v1/jupyter/*` — stateful Python kernel sessions
- [[aio-sandbox-code-execution-api]] — `/v1/code/*` + `/v1/nodejs/*` — one-shot code execution
- [[aio-sandbox-mcp-api]] — `/v1/mcp/*` — MCP server gateway (list/exec tools)
- [[aio-sandbox-skills-api]] — `/v1/skills/*` — server-side skills registry
- [[aio-sandbox-util-api]] — `/v1/util/convert_to_markdown` — document → markdown

## Search APIs

- [[tavily-overview]] — Tavily as an LLM-native search provider
- [[tavily-search-api]] — POST /search endpoint
- [[tavily-extract-api]] — POST /extract endpoint
- [[tavily-map-api]] — POST /map endpoint (note: returns `results`, not `urls`)
- [[exa-overview]] — Exa as a search provider
- [[exa-search-api]] — POST /search endpoint

## Design Inspiration

- [[perplexity-computer]] — Perplexity Computer (Nexus's design inspiration)
