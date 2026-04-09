# NEXUS — DeepAgents Documentation Index

What we need from each file for building Nexus, with summaries and references for deeper reading.

---

## overview.md — Harness Capabilities

The harness is the combination of capabilities that make DeepAgents work: planning (`write_todos`), virtual filesystem (7 tools including `execute`), sub-agent delegation via `task` tool, automatic context compression, human-in-the-loop via `interruptOn`, skills with progressive disclosure, and persistent memory via `AGENTS.md` files.

**What Nexus needs:**
- The `write_todos` tool powers our todo checklist in the execution UI. Agents track tasks with `pending`, `in_progress`, `completed` statuses. → `overview.md:20-27`
- All filesystem tools are auto-provided by the sandbox backend — no manual config. → `overview.md:30-51`
- The `task` tool is how the Flash orchestrator spawns Research/Code/Creative sub-agents. Sub-agents are stateless, return a single final report. → `overview.md:59-87`
- Context compression (offloading + summarization) is automatic and keeps long multi-agent sessions within token limits. → `overview.md:89-106`
- Skills follow the Agent Skills standard (`agentskills.io`), use progressive disclosure — only loaded when needed. → `overview.md:142-161`
- Memory uses `AGENTS.md` files, always loaded into context. → `overview.md:163-182`

---

## models.md — Model Configuration

DeepAgents works with any LangChain chat model that supports tool calling. Models use `provider:model` format (e.g., `"google:gemini-3-flash-preview"`), resolved via `initChatModel()`. Both of our Gemini models are on the official suggested list.

**What Nexus needs:**
- Use `"google:gemini-3-flash-preview"` for the orchestrator (fast, cheap), `"google:gemini-3.1-pro-preview"` for sub-agents (powerful). → `models.md:19-25`
- For full parameter control (temperature, max tokens), instantiate via `initChatModel()` or the provider class directly. → `models.md:34-57`
- Runtime model swapping via `ConfigurableModel` middleware — enables the provider-agnostic dropdown UI. Middleware reads `request.runtime.context.model` and swaps at runtime. → `models.md:63-96`
- Each `SubAgent` can override `model` individually. → See `subagents.md:48-61`

---

## context.md — Context Concepts (General)

Explains the three context types in LangGraph: Config (static per-run data like user IDs), Dynamic runtime context (mutable state during a run), and Dynamic cross-conversation context (persistent store across sessions).

**What Nexus needs:**
- `configurable` key at invoke time for static per-run values. → `context.md:36-44`
- State schema with `z.object()` for custom state fields accessible in middleware. → `context.md:56-85`
- LangGraph Store for cross-conversation persistence (our SQLite-backed memory). → `context.md:118-127`

---

## context-engineering.md — Context Engineering in Deep Agents

The detailed guide on controlling what context the agent sees and how it's managed across long-running tasks. Covers input context, runtime context, compression, isolation, and long-term memory.

**What Nexus needs:**
- **System prompt assembly order** (critical for understanding what the model sees): custom `systemPrompt` → base agent prompt → todo prompt → memory prompt → skills prompt → filesystem prompt → subagent prompt → middleware prompts → HITL prompt. → `context-engineering.md:137-149`
- **Memory** (`AGENTS.md`) is always loaded — keep it small, use for Nexus user preferences. → `context-engineering.md:77-86`
- **Skills** loaded on-demand via progressive disclosure — put workflow instructions here. → `context-engineering.md:90-99`
- **Runtime context** propagates to all sub-agents automatically — pass API keys once. → `context-engineering.md:153-194`
- **Offloading** — tool results > 20k tokens auto-saved to filesystem, replaced with pointer. Research agents producing long outputs won't blow up context. → `context-engineering.md:214-225`
- **Summarization** — at 85% of context window, old messages get LLM-summarized. Full history preserved in filesystem for `grep`/`read_file` recovery. → `context-engineering.md:229-245`
- **Long-term memory** via `CompositeBackend` routing `/memories/` to `StoreBackend`. Agent creates files on demand with `write_file`/`edit_file`. → `context-engineering.md:287-309`

---

## backends.md — Filesystem Backends

All backend types, routing, virtual filesystems, policy hooks, and the protocol reference. This is a large file — use references below to jump to specific sections.

**What Nexus needs:**
- **`BaseSandbox` only requires `execute()`** — all other fs tools (`ls`, `read_file`, `write_file`, `edit_file`, `glob`, `grep`) are auto-derived by the base class constructing shell scripts. This is how we bridge AIO Sandbox with minimal code. → `backends.md:536-609`
- **`SandboxBackendProtocolV2`** extends `BackendProtocolV2` with `execute(command) → ExecuteResponse` and `readonly id`. → `backends.md:718-723`
- **`CompositeBackend`** — route different paths to different backends. For Nexus: default → AIO Sandbox (ephemeral workspace), `/memories/` → `StoreBackend` (persistent via SQLite). → `backends.md:297-324`
- **`uploadFiles()` / `downloadFiles()`** — for seeding sandbox before agent runs and retrieving artifacts after. → `backends.md:695-698`
- **Policy hooks** — subclass or wrap a backend to enforce read-only on specific paths. → `backends.md:451-524`
- **BackendProtocolV2 required methods:** `ls`, `read`, `readRaw`, `grep`, `glob`, `write`, `edit` — all return structured Result objects with `{ error?, ...data }`. → `backends.md:672-693`
- **FileData format** — v2 supports `string | Uint8Array` content with `mimeType`. → `backends.md:557-578`

---

## subagents.md — Synchronous Subagents

How to define, configure, and use sub-agents with context isolation. The main agent gets a `task` tool that spawns sub-agents with fresh context. Sub-agents execute autonomously and return a single final report.

**What Nexus needs:**
- **SubAgent interface fields:** `name`, `description`, `systemPrompt`, `tools` (all required), plus optional `model`, `middleware`, `skills`, `interruptOn`. Custom sub-agents do NOT inherit anything from the main agent. → `subagents.md:48-65`
- **General-purpose subagent** is always available, inherits everything. Can be overridden by passing `name: "general-purpose"`. → `subagents.md:231-271`
- **Context propagation** — runtime context (API keys, user ID) flows to all sub-agents automatically. Per-subagent config via namespaced keys (e.g., `"researcher:maxDepth": 3`). → `subagents.md:446-535`
- **`lc_agent_name` metadata** on streaming events — identifies which agent produced the event. Critical for routing to the correct UI card. → `subagents.md:537-580`
- **Best practices:** specific descriptions, detailed system prompts, minimal tool sets per agent, instruct agents to return concise summaries (< 500 words), write large data to filesystem. → `subagents.md:303-397`
- **Multiple specialized subagents pattern** — exactly our Research/Code/Creative agents setup. Coordinator creates plan → delegates to specialists → compiles final output. → `subagents.md:399-444`

---

## async-subagents.md — Async Subagents (v2 Feature)

Non-blocking sub-agents that return a task ID immediately. The supervisor can check progress, send follow-up instructions, or cancel. Requires an Agent Protocol server.

**What Nexus needs (future):**
- Tools: `start_async_task`, `check_async_task`, `update_async_task`, `cancel_async_task`, `list_async_tasks`. → `async-subagents.md:91-101`
- Task metadata stored in dedicated `asyncTasks` state channel, survives context summarization. → `async-subagents.md:137-141`
- **For Nexus v1:** Use sync subagents. Async is a v2 enhancement for true background execution with mid-flight steering. → `async-subagents.md:32-41`

---

## memory.md — Persistent Memory

Long-term memory that persists across conversations via filesystem-backed files. Agent reads/writes memory with its built-in file tools. Backend controls where files are stored.

**What Nexus needs:**
- **Agent-scoped memory** — single namespace `["nexus"]` since we're local/single-user. Every conversation reads/writes the same memory. → `memory.md:26-53`
- `CompositeBackend` routing `/memories/` to `StoreBackend` backed by SQLite. → `memory.md:26-53`
- Memory files (`AGENTS.md`) are always loaded into system prompt — keep minimal. → `memory.md:77-86` in context-engineering.md
- Agent can update memory via `edit_file` during conversation (default writable). → `memory.md:461-476`
- **Seeding memory** — use `store.put()` to pre-populate initial preferences. → `memory.md:60-119`
- **Background consolidation** (v2) — separate consolidation agent reviews recent conversations, merges into memory on a schedule. Reduces in-conversation latency. → `memory.md:345-459`

---

## skills.md — Agent Skills

Reusable capabilities via `SKILL.md` files with progressive disclosure. Each skill is a directory with a `SKILL.md` (frontmatter metadata + instructions) plus optional scripts, docs, and templates.

**What Nexus needs:**
- **SKILL.md format:** frontmatter (`name`, `description`, optionally `license`, `compatibility`, `metadata`, `allowed-tools`) + markdown body with instructions. → `skills.md:100-147`
- **Progressive disclosure** — only frontmatter loaded at startup, full content on demand when agent decides it's relevant. → `skills.md:27-32`
- Pass skills via `skills: ["/skills/"]` to `createDeepAgent`. → `skills.md:149-303`
- **Sub-agent skills** — custom sub-agents do NOT inherit. Must explicitly pass `skills: ["/skills/research/"]`. State is fully isolated. → `skills.md:351-376`
- **Skills vs Memory:** skills = on-demand/task-specific/potentially large, memory = always loaded/small/conventions. → `skills.md:390-401`
- **Nexus skills to create:**
  - `/skills/deep-research/SKILL.md` — multi-source Tavily/Exa research workflow
  - `/skills/build-app/SKILL.md` — code generation + sandbox execution workflow
  - `/skills/generate-image/SKILL.md` — Imagen-based image generation workflow

---

## sandbox.md — Sandbox Execution

Isolated code execution environments as backends. Sandboxes give agents both filesystem tools AND the `execute` tool for running shell commands.

**What Nexus needs:**
- **`BaseSandbox` only requires `execute()`** — all other tools auto-derived. Adding a new provider = implement one method. → `sandbox.md:337-365`
- **"Sandbox as tool" pattern** — agent runs on host (Next.js backend), calls `execute()` which hits AIO Sandbox over HTTP. API keys stay outside the sandbox. → `sandbox.md:269-324`
- **Two planes of file access:** agent tools (via `execute()` during runs) vs file transfer APIs (`uploadFiles`/`downloadFiles` from application code). → `sandbox.md:384-422`
- **Seeding:** `uploadFiles()` with `Uint8Array` content before agent runs. → `sandbox.md:425-442`
- **Retrieving artifacts:** `downloadFiles()` after agent finishes. → `sandbox.md:444-463`
- **Lifecycle:** For Nexus, assistant-scoped — single persistent AIO Docker container, stays running. → `sandbox.md:146-153`

---

## streaming.md — Real-time Streaming

How to stream events from deep agent runs and sub-agents. Built on LangGraph's streaming with first-class sub-agent support.

**What Nexus needs:**
- `agent.stream()` with `subgraphs: true` yields `[namespace, chunk]` pairs. Namespace identifies which agent produced the event. → `streaming.md:17-51`
- **Namespace routing:** empty = main agent, `tools:UUID` = sub-agent. Use to route events to correct UI card. → `streaming.md:54-85`
- **Three stream modes (combine all):**
  - `"updates"` — step-by-step progress → update card status. → `streaming.md:88-155`
  - `"messages"` — individual LLM tokens → stream text into cards. → `streaming.md:158-204`
  - `"custom"` — user-defined events via `config.writer` → progress bars. → `streaming.md:265-346`
- **Multi-mode streaming:** `streamMode: ["updates", "messages", "custom"]` with `subgraphs: true` gets everything in one stream. → `streaming.md:348-407`
- **Subagent lifecycle tracking pattern:** PENDING (task tool call in `model_request`) → RUNNING (events from `tools:UUID` namespace) → COMPLETE (ToolMessage in `tools` node). Ready-made code to adapt. → `streaming.md:411-491`
- **Frontend streaming:** references `useStream` React hook and frontend patterns. → `streaming.md:493-497`

---

## frontend/ Subfolder

### frontend/overview.md — Frontend Architecture Overview

High-level architecture for building UIs with DeepAgents. `useStream` from `@langchain/react` is the primary hook.

**What Nexus needs:**
- `useStream` hook: `stream.values.todos` (todo list), `stream.subagents` (all sub-agent streams), `stream.messages` (main agent messages). → `frontend/overview.md:60-75`
- Three documented patterns: subagent streaming cards, todo list, sandbox IDE. → `frontend/overview.md:78-91`
- Connects to LangGraph server at `localhost:2024` — for Nexus, we either run `langgraph dev` or build custom SSE in Next.js API routes. → `frontend/overview.md:62-69`

### frontend/ai-elements.md — AI Elements (shadcn/ui Components)

Composable shadcn/ui-based components for AI chat interfaces, with a first-class `useStream` bridge from LangChain.

**What Nexus needs:**
- **Install:** `npm install @langchain/react @ai-elements/react` then `npx ai-elements@latest add conversation message prompt-input tool reasoning suggestion`. Components are editable source files (shadcn-style). → `frontend/ai-elements.md:213-220`
- **Key components:** `Conversation`, `Message`/`MessageContent`/`MessageResponse`, `Tool`/`ToolHeader`/`ToolContent`/`ToolInput`/`ToolOutput`, `Reasoning`, `PromptInput`/`PromptInputTextarea`/`PromptInputSubmit`, `Suggestion`. → `frontend/ai-elements.md:230-258`
- **Wiring pattern:** iterate `stream.messages` → `HumanMessage.isInstance()` renders user bubble, `AIMessage.isInstance()` renders assistant response + inline tool calls. → `frontend/ai-elements.md:260-330`
- **Fully customizable** — source files, not dependency. Can restyle everything for Perplexity dark theme. → `frontend/ai-elements.md:333-338`

### frontend/subagent-streaming.md — Subagent Cards UI Pattern

Complete React pattern for rendering sub-agent progress as collapsible cards. This is the most important frontend doc for Nexus's 70% execution panel.

**What Nexus needs:**
- **`filterSubagentMessages: true`** on `useStream` — keeps coordinator messages clean, sub-agent content accessible via `stream.subagents`. → `frontend/subagent-streaming.md:875-889`
- **`stream.getSubagentsByMessage(msg.id)`** — returns sub-agents spawned by a specific coordinator message. → `frontend/subagent-streaming.md:1061-1072`
- **`SubagentStreamInterface`** — the data model: `id`, `status` (pending/running/complete/error), `messages`, `result`, `toolCall.args.subagent_type` (agent name), `toolCall.args.description`, `startedAt`/`completedAt`. → `frontend/subagent-streaming.md:1024-1059`
- **Ready-made components to adapt:**
  - `SubagentCard` — collapsible card with title, description, streaming content, status badge, elapsed time. → `frontend/subagent-streaming.md:1074-1151`
  - `StatusIcon` / `StatusBadge` — visual indicators (pending/running/complete/error). → `frontend/subagent-streaming.md:1153-1185`
  - `SubagentProgress` — progress bar showing completed/total. → `frontend/subagent-streaming.md:1187-1218`
  - `MessageWithSubagents` — layout: message + sub-agent cards nested below. → `frontend/subagent-streaming.md:1220-1256`
  - `SynthesisIndicator` — "Synthesizing results..." while coordinator assembles final response. → `frontend/subagent-streaming.md:1258-1291`
- **`stream.subagents` Map** for global progress indicators. → `frontend/subagent-streaming.md:1314-1328`
- Submit with `{ streamSubgraphs: true }`. Default recursion limit is 10,000. → `frontend/subagent-streaming.md:1005-1022`

### frontend/sandbox.md — IDE-like Sandbox UI Pattern (v2 Feature)

Three-panel IDE layout with file browser, code viewer, and chat. Shows how to sync files in real-time as the agent works.

**What Nexus needs (future enhancement):**
- **Architecture:** Deep agent + Custom API server (Hono via `langgraph.json` `http.app`) + IDE frontend. → `frontend/sandbox.md:875-917`
- **Thread-scoped sandbox lifecycle** — each conversation gets its own sandbox. → `frontend/sandbox.md:925-960`
- **Real-time file sync** — watch `ToolMessage` for `write_file`/`edit_file`/`execute` → refresh that file in the UI. → `frontend/sandbox.md:1284-1337`
- **File state management** — track original vs current filesystem snapshots for diff display. → `frontend/sandbox.md:1258-1282`
- **Three-panel layout:** file tree | code/diff viewer | chat. → `frontend/sandbox.md:1570-1600`
- Could integrate as an optional "IDE mode" tab in Nexus v2.
