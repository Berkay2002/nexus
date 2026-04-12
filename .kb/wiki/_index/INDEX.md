# Index

Content catalog of the Nexus knowledge base, grouped by domain. Use `/wikillm:query` to search; use this index for browsing.

## DeepAgents — Overview & Harness

- [[deep-agents-overview]] — What DeepAgents is and the harness philosophy
- [[harness-capabilities]] — The six harness capabilities in detail
- [[create-deep-agent]] — The `createDeepAgent()` factory and its parameters
- [[deepagents-typescript-reference]] — The `deepagents` npm package surface (FileData V1/V2, exports)
- [[todo-list-middleware]] — The `write_todos` planning tool
- [[filesystem-middleware]] — The virtual filesystem tool surface

## DeepAgents — Subagents

- [[subagents]] — Synchronous task delegation via subagents
- [[subagent-interface]] — The `SubAgent` dict and `CompiledSubAgent` class
- [[context-quarantine]] — Why subagents exist: the context-bloat problem
- [[general-purpose-subagent]] — The GP subagent added automatically (Nexus gotcha)
- [[async-subagents]] — Preview-feature async subagents with lifecycle control

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

## LangGraph Core

- [[context-overview]] — LangGraph context mechanisms (config/state/store)
- [[config-runtime-context]] — The `configurable` key at invoke time
- [[dynamic-runtime-context]] — LangGraph state as short-term memory
- [[cross-conversation-context]] — LangGraph Store for persistence

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

## Providers

- [[anthropic-provider]] — `@langchain/anthropic` package
- [[chat-anthropic]] — ChatAnthropic class (Claude)
- [[google-provider]] — `@langchain/google` package
- [[chat-google-generative-ai]] — ChatGoogleGenerativeAI class (Gemini)
- [[langchain-google-api-reference]] — `@langchain/google` API surface reference
- [[openai-provider]] — `@langchain/openai` package
- [[chat-openai]] — ChatOpenAI class (GPT / base for `ZaiChatOpenAI`)

## AIO Sandbox

- [[aio-sandbox-overview]] — What AIO Sandbox is (Docker agent environment)
- [[aio-sandbox-docker]] — Running the container
- [[aio-sandbox-features]] — Browser / shell / file / Jupyter / VSCode / MCP surfaces
- [[agent-infra-sandbox-sdk]] — `@agent-infra/sandbox` TS SDK
- [[aio-sandbox-deepagents-integration]] — Python BaseSandbox integration example

## Search APIs

- [[tavily-overview]] — Tavily as an LLM-native search provider
- [[tavily-search-api]] — POST /search endpoint
- [[tavily-extract-api]] — POST /extract endpoint
- [[tavily-map-api]] — POST /map endpoint (note: returns `results`, not `urls`)
- [[exa-overview]] — Exa as a search provider
- [[exa-search-api]] — POST /search endpoint

## Design Inspiration

- [[perplexity-computer]] — Perplexity Computer (Nexus's design inspiration)
