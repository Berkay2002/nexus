# NEXUS — LangChain Core Documentation Index

What we need from the LangChain core docs for building Nexus.

---

## messages.md — Messages

**What it covers:** The fundamental message types (System, Human, AI, Tool) used as input/output for LangChain models, including content blocks, multimodal data, and streaming chunks.

**Summary:** Messages are the core data unit for model conversations in LangChain. Each message has a role, content, and optional metadata. The file documents four message types (SystemMessage, HumanMessage, AIMessage, ToolMessage), three ways to construct them (class instances, dictionary/OpenAI format, string shortcut), multimodal content blocks for images/audio/video/files, standard content block types (text, reasoning, tool_call, tool_call_chunk, server_tool_call, etc.), and how AIMessageChunk works during streaming.

**What Nexus needs:**
- Dictionary format for messages (`{ role: "user", content: "..." }`) — this is what useStream will send/receive in the Next.js frontend. `-> messages.md:72-79`
- AIMessage with tool_calls — when Gemini decides to call a Nexus tool (Tavily search, sandbox exec, etc.), the response arrives as `response.tool_calls`. `-> messages.md:214-227`
- ToolMessage construction — after executing a tool, pass results back with matching `tool_call_id`. Critical for the agent loop in DeepAgents. `-> messages.md:284-314`
- AIMessageChunk for streaming — Nexus streams via useStream; chunks arrive as AIMessageChunk and are concatenated with `.concat()`. `-> messages.md:260-280`
- Standard content blocks (ContentBlock.Text, ContentBlock.Reasoning, ContentBlock.Tools.ToolCall, ContentBlock.Tools.ToolCallChunk) — needed to parse streaming chunks in the frontend and render tool calls, reasoning steps, and text separately. `-> messages.md:611-957`
- Multimodal content blocks for image/file input — if Nexus agents need to process uploaded images or PDFs from the frontend. `-> messages.md:479-605`
- SystemMessage for agent persona setup — used when configuring createDeepAgent system prompts. `-> messages.md:88-118`

---

## models.md — Models

**What it covers:** How to initialize, configure, invoke, stream, and use advanced features (tool calling, structured output, reasoning, multimodal) with LangChain chat models across providers.

**Summary:** This file covers the full lifecycle of working with LangChain chat models: initialization via `initChatModel` or direct class instantiation, provider-specific setup (OpenAI, Anthropic, Google Gemini, Azure, Bedrock), invocation methods (invoke, stream, batch), model parameters (temperature, maxTokens, timeout, maxRetries), tool calling with `bindTools`, structured output with `withStructuredOutput` using Zod schemas, streaming with AIMessageChunk accumulation, reasoning output, model profiles, prompt caching, and server-side tool use.

**What Nexus needs:**
- Google Gemini initialization via `@langchain/google-genai` — Nexus uses `ChatGoogleGenerativeAI` with `gemini-2.5-flash-lite` or similar. Install with `npm install @langchain/google-genai`, instantiate with `new ChatGoogleGenerativeAI({ model: "gemini-2.5-flash-lite", apiKey })`. `-> models.md:167-205`
- Model parameters — `temperature`, `maxTokens`, `timeout`, `maxRetries` (default 6, consider 10-15 for long agent tasks). These apply when passing the model to `createDeepAgent`. `-> models.md:284-327`
- Streaming with `stream()` — returns an async iterator of AIMessageChunk. Accumulate with `.concat()`. Use `chunk.contentBlocks` to filter reasoning vs text vs tool_call_chunk during streaming. `-> models.md:378-428`
- Tool calling with `bindTools` — bind Nexus tools (Tavily search, Exa search, sandbox tools) to the Gemini model. Model returns `response.tool_calls` array. `-> models.md:523-597`
- Tool execution loop — execute tools from `ai_msg.tool_calls`, push ToolMessage results back, re-invoke. DeepAgents handles this automatically but understanding the loop matters for custom sub-agents. `-> models.md:599-628`
- Forcing tool calls — `toolChoice: "any"` or `toolChoice: "tool_name"` to force the model to use a specific tool. `-> models.md:630-641`
- Streaming tool calls — tool_call_chunks arrive progressively during streaming; accumulate into full tool calls. `-> models.md:684-724`
- Structured output with Zod — `model.withStructuredOutput(zodSchema)` for when Nexus agents need typed responses (e.g., extracting structured data). `-> models.md:729-831`
- Structured output with `includeRaw: true` — get both parsed output and raw AIMessage (for token usage metadata). `-> models.md:844-870`
- Reasoning output — filter `contentBlocks` for `type === "reasoning"` to surface model thinking steps in the Nexus UI. `-> models.md:987-1011`
- Prompt caching — Gemini supports implicit caching automatically; no extra config needed but good to know cost savings happen. `-> models.md:1019-1034`
- Server-side tool use — some models support built-in web search via `bindTools([{ type: "web_search" }])`. Could complement Tavily/Exa for certain agents. `-> models.md:1036-1054`

---

## tools.md — Tools

**What it covers:** How to create custom LangChain tools with Zod schemas, access runtime context/memory/streaming from tools, use ToolNode for graph workflows, and handle tool return values.

**Summary:** Tools are callable functions with defined input schemas that get passed to chat models for invocation. The file covers creating tools with the `tool()` function and Zod schemas, accessing runtime context (config.context, config.store for long-term memory, config.writer for streaming updates, execution info), ToolNode for LangGraph workflow integration, tool return value patterns (string, object, Command for state mutation), error handling, conditional routing with `tools_condition`, and state injection.

**What Nexus needs:**
- Basic tool definition with Zod — the pattern for creating all Nexus tools (Tavily search, Exa search, AIO sandbox execution, etc.). Use `tool(fn, { name, description, schema: z.object({...}) })`. Prefer `snake_case` names. `-> tools.md:17-45`
- Accessing agent context from tools — pass user IDs, session data, or sandbox config via `config.context`. Define a `contextSchema` with Zod and pass context at invocation time. `-> tools.md:46-90`
- Long-term memory (Store) — `InMemoryStore` or similar for persistent cross-session data. Access via `config.store` with namespace/key pattern. Relevant if Nexus agents need to remember user preferences across conversations. `-> tools.md:92-169`
- Stream writer for real-time tool updates — `config.writer` lets tools emit progress updates during execution. Essential for Nexus sandbox tools that may take time (code execution, file operations). `-> tools.md:171-201`
- Execution info — access `runtime.executionInfo` for threadId, runId, nodeAttempt. Requires `deepagents>=1.9.0`. `-> tools.md:203-228`
- ToolNode for custom workflows — `new ToolNode([tools])` for when Nexus needs custom LangGraph state graphs instead of the standard createDeepAgent loop. `-> tools.md:263-298`
- Tool return values — return string for simple results, object for structured data the model should parse, or `Command` to mutate graph state (e.g., updating agent preferences or routing to sub-agents). `-> tools.md:300-398`
- Returning a Command with ToolMessage — when a tool needs to both update state and confirm to the model. Use `config.toolCallId` for the tool_call_id. `-> tools.md:362-398`
- Error handling in ToolNode — `handleToolErrors: true` or custom error message string. `-> tools.md:404-419`
- Conditional routing with tools_condition — routes to "tools" node or "__end__" based on whether the LLM made tool calls. Used in custom StateGraph workflows. `-> tools.md:421-437`
