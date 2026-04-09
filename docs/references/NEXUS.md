# NEXUS — API References Index

What we need from the reference docs for building Nexus.

---

## deepagents-reference.md — DeepAgents TypeScript Package Reference

The complete API reference for the `deepagents` npm package. Contains all classes, functions, interfaces, and types.

**What Nexus needs:**

### Core Function
- **`createDeepAgent(params)`** — The main entry point. Creates a LangGraph-powered agent. Accepts: `model`, `systemPrompt`, `tools`, `middleware`, `subagents`, `backend`, `store`, `checkpointer`, `skills`, `memory`, `interruptOn`, `contextSchema`. → `deepagents-reference.md:149-158`

### Backend Classes (for our AIO Sandbox + SQLite setup)
- **`BaseSandbox`** — Abstract base class. Extend this for our `AIOSandboxBackend`. Only `execute()` is required — all filesystem tools are auto-derived. → `deepagents-reference.md:547-609`
- **`CompositeBackend`** — Routes file operations to different backends by path prefix. We use this to route `/memories/` to `StoreBackend` and everything else to our sandbox. → `deepagents-reference.md:522-531`
- **`StoreBackend`** — Persistent storage via LangGraph Store. Backs our SQLite memory. → `deepagents-reference.md:501-531`
- **`StateBackend`** — Ephemeral in-memory. Default if no backend specified. → `deepagents-reference.md:497-500`

### Middleware Functions (for extending agent behavior)
- **`createSubAgentMiddleware()`** — Adds the `task` tool for sub-agent delegation. Auto-attached by `createDeepAgent`. → `deepagents-reference.md:686-724`
- **`createFilesystemMiddleware()`** — Adds filesystem tools (`ls`, `read_file`, etc.). Auto-attached. → `deepagents-reference.md:660-678`
- **`createMemoryMiddleware()`** — Adds persistent memory support. → `deepagents-reference.md:833`
- **`createSkillsMiddleware()`** — Adds progressive skill disclosure. → `deepagents-reference.md:835`
- **`createSummarizationMiddleware()`** — Auto context compression. → `deepagents-reference.md:837`
- **`createAsyncSubAgentMiddleware()`** — For async sub-agents (v2). → `deepagents-reference.md:830`

### Key Interfaces
- **`SubAgent`** — `{ name, description, systemPrompt, tools?, model?, middleware?, interruptOn?, skills? }`. → `deepagents-reference.md:328-354`
- **`BackendProtocolV2`** — Required methods: `ls`, `read`, `readRaw`, `grep`, `glob`, `write`, `edit`. → `deepagents-reference.md:869-871`
- **`SandboxBackendProtocolV2`** — Extends `BackendProtocolV2` with `execute()` and `readonly id`. → `deepagents-reference.md:885-889`
- **`ExecuteResponse`** — `{ output: string, exitCode: number, truncated: boolean }`. → `deepagents-reference.md:560-576`
- **`CreateDeepAgentParams`** — Full type for all `createDeepAgent` options. → `deepagents-reference.md:940-941`

### Key Types
- **`DeepAgent`** — The compiled agent type returned by `createDeepAgent`. Used as type parameter for `useStream<typeof agent>`. → `deepagents-reference.md:983`
- **`FileData`** — `{ content: string | Uint8Array, mimeType: string, created_at: string, modified_at: string }`. → `deepagents-reference.md:969`
- **`BackendFactory`** — `(config) => BackendProtocol`. → `deepagents-reference.md:968`

---

## google-gen-ai-reference.md — ChatGoogleGenerativeAI (TypeScript)

The `@langchain/google-genai` package reference. `ChatGoogleGenerativeAI` is the LangChain wrapper for Google's Gemini models.

**What Nexus needs:**

### Setup
- Install: `npm install @langchain/google-genai`. Set `GOOGLE_API_KEY` env var. → `google-gen-ai-reference.md:8-14`
- Instantiate: `new ChatGoogleGenerativeAI({ model: "gemini-3.1-pro-preview", temperature: 0 })`. → `google-gen-ai-reference.md:43-53`

### Key Features
- **Tool calling** — `llm.bindTools([...])` with Zod schemas. Returns `aiMsg.tool_calls` array. This is how DeepAgents' built-in tools work under the hood. → `google-gen-ai-reference.md:179-232`
- **Structured output** — `llm.withStructuredOutput(zodSchema)` for validated JSON responses. → `google-gen-ai-reference.md:237-257`
- **Streaming** — `llm.stream(input)` returns `AIMessageChunk` stream with partial tokens. → `google-gen-ai-reference.md:107-146`
- **Multimodal** — pass images as base64 `image_url` content blocks, PDFs as inline data. Useful for our Creative sub-agent. → `google-gen-ai-reference.md:261-288, 340-377`
- **Usage metadata** — `aiMsg.usage_metadata` has `input_tokens`, `output_tokens`, `total_tokens`. Could display token costs in UI. → `google-gen-ai-reference.md:293-303`

### Key Properties (for fine-tuning our models)
- `model` — model name string (e.g., `"gemini-3.1-pro-preview"`)
- `temperature` — sampling temperature
- `maxOutputTokens` — max response length
- `topK`, `topP` — sampling parameters
- `safetySettings` — content filtering
- `thinkingConfig` — thinking/reasoning configuration
- `streaming` — enable streaming mode
→ `google-gen-ai-reference.md:399-437`

### How Nexus uses this
We don't instantiate `ChatGoogleGenerativeAI` directly in most cases — DeepAgents' `createDeepAgent({ model: "google:gemini-3-flash-preview" })` resolves it via `initChatModel()`. But for fine-grained control (different temperatures for orchestrator vs sub-agents), we'll instantiate directly:

```typescript
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

// Fast orchestrator
const flashModel = new ChatGoogleGenerativeAI({
  model: "gemini-3-flash-preview",
  temperature: 0,
  maxOutputTokens: 4096,
});

// Powerful sub-agent model
const proModel = new ChatGoogleGenerativeAI({
  model: "gemini-3.1-pro-preview",
  temperature: 0.2,
  maxOutputTokens: 8192,
});
```
