# Nexus — Design Specification

**Date:** 2026-04-10
**Status:** Draft
**Project:** Nexus — Local-first AI Agent Platform

---

## 1. Project Overview & Goals

**Nexus** is a local-first AI agent platform that takes a single user prompt and orchestrates multiple AI agents to research, build, and create deliverables — inspired by Perplexity Computer but scoped for a single developer running locally.

### Goals

- One prompt → multiple specialized agents work in parallel → assembled deliverable
- Real-time visibility into what each agent is doing (streaming cards, todo progress)
- Provider-agnostic architecture (Google Gemini default, but swappable)
- Polished, Perplexity Computer-inspired dark UI
- Strong portfolio piece demonstrating orchestration, real-time streaming, and full-stack TypeScript

### Non-Goals (explicitly out of scope)

- Cloud deployment / multi-user / auth
- 400+ integrations — focused toolset (Tavily, Exa, Imagen, sandbox)
- Async background execution / scheduling / email
- Voice input
- Billing / token spend tracking UI
- Interactive mid-execution steering (v1 is fire-and-forget)

### Success Criteria

- User types "Research AI in K-12 education and create a comprehensive report" → Nexus decomposes, researches via Tavily/Exa, writes the report in the sandbox, and delivers a polished markdown document
- The user watches the entire process in real-time with agent cards showing streaming progress
- The system handles simple prompts (single-agent) and complex prompts (multi-agent) through the same interface

---

## 2. Technology Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript end-to-end |
| Orchestration | DeepAgents (Approach A — native, `createDeepAgent`) |
| Models | Google Gemini: `gemini-3-flash-preview` (orchestrator/router), `gemini-3.1-pro-preview` (sub-agents), `gemini-3.1-flash-image-preview` (images), `gemini-embedding-2-preview` (future semantic memory) |
| Execution | AIO Sandbox (Docker container — shell, browser, filesystem, Jupyter) |
| Search | Tavily (Search, Extract, Map) + Exa (neural/semantic search) |
| Frontend | Next.js App Router + Tailwind CSS + shadcn/ui + AI Elements (`@ai-elements/react`) |
| Streaming | `@langchain/langgraph-sdk/react` (`useStream` hook) |
| Persistence | SQLite + Drizzle ORM (`better-sqlite3`) |
| Monorepo | Turborepo (scaffolded from `npx create-agent-chat-app`) |
| Agent server | LangGraph dev server (`langgraph dev` at `localhost:2024`) |

---

## 3. System Architecture

### Three-Process Local Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Process 1: AIO Sandbox (Docker)                        │
│  docker run ... -p 8080:8080 ghcr.io/agent-infra/sandbox│
│  ├── Shared filesystem (/home/gem/)                     │
│  ├── Shell execution                                    │
│  ├── Browser (VNC + CDP)                                │
│  └── Jupyter / VSCode                                   │
│  Exposed at: localhost:8080                              │
└─────────────────────────────────────────────────────────┘
         ▲ HTTP (sandbox SDK)
         │
┌─────────────────────────────────────────────────────────┐
│  Process 2: LangGraph Dev Server                        │
│  langgraph dev                                          │
│  ├── Meta-Router (silent model classifier)              │
│  ├── Nexus Orchestrator (DeepAgent, Flash or Pro)       │
│  │   ├── write_todos (planning)                         │
│  │   ├── Skills (progressive disclosure)                │
│  │   └── task tool (sub-agent spawning)                 │
│  ├── Research Sub-Agent (Pro + Tavily/Exa)              │
│  ├── Code Sub-Agent (Pro + sandbox execute)             │
│  ├── Creative Sub-Agent (Pro + Imagen)                  │
│  ├── AIOSandboxBackend (BaseSandbox → sandbox SDK)      │
│  └── CompositeBackend                                   │
│      ├── / → AIOSandboxBackend (ephemeral workspace)    │
│      └── /memories/ → StoreBackend (SQLite persistence) │
│  Exposed at: localhost:2024                              │
└─────────────────────────────────────────────────────────┘
         ▲ useStream (LangGraph protocol)
         │
┌─────────────────────────────────────────────────────────┐
│  Process 3: Next.js Frontend                            │
│  next dev (scaffolded from Agent Chat UI)               │
│  ├── Proxy to LangGraph server (from agent-chat-ui)     │
│  ├── useStream hook (@langchain/react)                  │
│  ├── AI Elements (shadcn/ui source components)          │
│  ├── Landing page (tagline + prompt input)              │
│  └── Execution view (30/70 split)                       │
│      ├── Left 30%: Todo list + sub-agent statuses       │
│      └── Right 70%: Agent execution cards + final result│
│  Exposed at: localhost:3000                              │
└─────────────────────────────────────────────────────────┘
```

### Data Flow for a Single Prompt

1. User types prompt at `localhost:3000`, hits submit
2. Frontend calls `stream.submit()` via `useStream` → hits LangGraph server at `:2024`
3. LangGraph server runs the **meta-router** — a single fast LLM call (Flash) that classifies the prompt and returns a model choice
4. The selected model is injected into the **Nexus Orchestrator** via `ConfigurableModel` middleware
5. Orchestrator loads relevant skills, creates a plan (`write_todos`), spawns sub-agents via `task` tool
6. Sub-agents execute with their own tools — Research uses Tavily/Exa, Code uses `execute` on the sandbox, Creative uses Imagen
7. All agents share the AIO Sandbox filesystem — research writes findings, code reads them and builds on them
8. Streaming events flow back: `[namespace, chunk]` pairs with `subgraphs: true`
9. Frontend routes events by namespace — empty = orchestrator (updates left panel), `tools:UUID` = sub-agent (updates right panel cards)
10. Orchestrator synthesizes sub-agent results into final response, shown as the last message in the 70% panel

### Key Architectural Decisions

- **Agent Chat UI scaffold** — keep LangGraph proxy, thread management, `useStream` wiring. Strip default UI, replace with Nexus design.
- **CompositeBackend** — ephemeral workspace in AIO Sandbox, `/memories/` persisted to SQLite
- **BaseSandbox requires only `execute()`** — port Python `AIOSandboxBackend` to TypeScript (~50-80 lines)
- **Runtime context** propagates API keys (Google, Tavily, Exa) to all sub-agents automatically

---

## 4. Meta-Router

### Purpose

A silent, fast classifier that runs before the orchestrator. Analyzes the user's prompt and selects which Gemini model should serve as the orchestrator.

### How It Works

- A single LLM call using `gemini-3-flash-preview` (always Flash — must be fast and cheap)
- Takes the user's raw prompt as input
- Returns structured output via `withStructuredOutput`: `{ model: string, reasoning: string }`
- Result passed to orchestrator's `ConfigurableModel` middleware for runtime model swap

### Classification Criteria

- **Intent complexity** — Single-step task vs multi-step project
- **Implied scope** — Even vague prompts like "build me something cool" imply a large project requiring Pro
- **Domain signals** — Research-heavy, code-heavy, creative, multi-domain
- **Clarity** — Specific enough to act on, or will orchestrator need clarification (either way, vague-but-big still needs Pro)

### Model Selection Output

- `gemini-3-flash-preview` — Simple, single-domain tasks. Quick answers, single sub-agent or no sub-agents needed.
- `gemini-3.1-pro-preview` — Complex, multi-step, multi-domain tasks. Requires sophisticated planning, multiple sub-agents, or quality decomposition.

### What It Does NOT Do

- Does not load skills (orchestrator does that)
- Does not decompose the task
- Does not interact with the user
- Does not route to specific sub-agents
- Does not modify the prompt

### Implementation Shape

A LangGraph node that runs before the main orchestrator graph. Pre-processing step in the overall agent graph, not a separate agent.

---

## 5. Nexus Orchestrator

### Purpose

The central brain. A DeepAgent instance that receives the user's prompt, understands intent, plans work, loads relevant skills, and delegates to specialized sub-agents.

### Configuration

- Created via `createDeepAgent()` with model selected by meta-router
- Model injected at runtime via `ConfigurableModel` middleware
- Backend: `CompositeBackend` (AIO Sandbox + SQLite StoreBackend)
- Memory: `/memories/AGENTS.md` — always loaded
- Skills: `/skills/` directory with progressive disclosure

### Orchestrator Behavior Per Prompt

1. **Receives the prompt** with full system prompt (memory, skill frontmatter, tool descriptions, sub-agent descriptions)
2. **Assesses the task** — clear or vague? Single-step or multi-step? Which domain(s)?
3. **If vague:** Responds asking for clarification. No sub-agents spawned. UI shows orchestrator's message in 30/70 view.
4. **If clear:** Loads relevant skills (full `SKILL.md` files), creates plan via `write_todos`
5. **Delegates work** — Spawns sub-agents via `task` tool. Each call specifies sub-agent type and task description.
6. **Synthesizes results** — After sub-agents return, assembles final deliverable. May write to sandbox filesystem and present summary.
7. **Updates memory** — If it learns something worth remembering, updates `/memories/AGENTS.md` via `edit_file`.

### System Prompt Assembly (by DeepAgents)

1. Custom Nexus system prompt (role, behavior, delegation guidelines)
2. Base DeepAgent prompt (planning, filesystem, sub-agent instructions)
3. Todo list prompt
4. Memory content (`AGENTS.md`)
5. Skills frontmatter list
6. Filesystem tool docs
7. Sub-agent descriptions (Research, Code, Creative)

### Context Management (automatic)

- Offloading: tool results > 20k tokens saved to filesystem, replaced with pointer
- Summarization: at 85% context window, old messages LLM-summarized
- Sub-agent isolation: each runs with fresh context, returns only concise report

---

## 6. Shared Workspace & Filesystem Convention

All agents share the same AIO Sandbox filesystem. DeepAgents provides **context isolation** (fresh conversation per sub-agent) but NOT filesystem isolation. Agents coordinate via a structured directory convention.

### Workspace Structure

The workspace lives under the AIO Sandbox's home directory at `/home/gem/workspace/`.

```
/home/gem/workspace/
├── shared/                          ← Final assembled deliverables
│   ├── report.md
│   ├── app/
│   └── assets/
│
├── research/                        ← Research sub-agent workspace
│   ├── task_abc123/                 ← First research instance (by tool call ID)
│   │   ├── findings.md
│   │   ├── sources.json
│   │   └── raw/
│   ├── task_def456/                 ← Second research instance
│   │   ├── findings.md
│   │   └── ...
│   └── ...
│
├── code/                            ← Code sub-agent workspace
│   ├── task_jkl012/
│   │   ├── src/
│   │   ├── package.json
│   │   └── build-log.md
│   └── ...
│
├── creative/                        ← Creative sub-agent workspace
│   ├── task_pqr678/
│   │   ├── hero.png
│   │   └── prompt-used.md
│   └── ...
│
└── orchestrator/                    ← Orchestrator's scratch space
    ├── plan.md
    └── synthesis-notes.md
```

### Convention Rules

- Top-level folders by **agent type**: `research/`, `code/`, `creative/`, `orchestrator/`
- Within each, folders by **task tool call ID** (LangGraph-native `toolCall.id` like `call_abc123`). Unique per sub-agent invocation.
- Sub-agents instructed in system prompts to write to `/home/gem/workspace/{type}/task_{id}/`
- Orchestrator passes task ID to each sub-agent as part of task description
- Any agent **can read from any path** — orchestrator tells agents where to look via task descriptions
- Final deliverables assembled in `/home/gem/workspace/shared/`

### Example Flow

1. Orchestrator spawns research `task_abc123`: "Research AI in K-12 education, write to `/home/gem/workspace/research/task_abc123/`"
2. Orchestrator spawns research `task_def456`: "Research teacher tools in classrooms 2026, write to `/home/gem/workspace/research/task_def456/`"
3. Both complete. Orchestrator spawns code `task_jkl012`: "Read `/home/gem/workspace/research/task_abc123/findings.md` and `/home/gem/workspace/research/task_def456/findings.md`, create formatted report in `/home/gem/workspace/shared/report.md`"

---

## 7. Sub-Agents

Three sub-agent types, each defined as a `SubAgent` config passed to `createDeepAgent`. Each type can be spawned multiple times — every invocation gets its own context and workspace folder.

### Research Sub-Agent

- **Model:** `gemini-3.1-pro-preview`
- **Tools:** `tavily_search`, `tavily_extract`, `tavily_map`, `exa_search`
- **System prompt directives:**
  - Write all outputs to `/home/gem/workspace/research/task_{id}/`
  - Create `findings.md` (synthesized summary), `sources.json` (structured source list), raw data in `raw/`
  - Return concise summary (< 500 words) to orchestrator — full data in filesystem
  - Cite sources with URLs
  - Use Tavily Map to understand site structure before deep extraction
  - Use Exa for semantic search when keyword search insufficient

### Code Sub-Agent

- **Model:** `gemini-3.1-pro-preview`
- **Tools:** `execute` (auto from sandbox), filesystem tools
- **System prompt directives:**
  - Write all outputs to `/home/gem/workspace/code/task_{id}/`
  - Can read from any `/home/gem/workspace/` path
  - Use `execute` for shell commands: install deps, run scripts, test code
  - Iterate on errors — read error, fix code, retry
  - Write `build-log.md` summarizing what was built and how to run it
  - Return concise summary to orchestrator

### Creative Sub-Agent

- **Model:** `gemini-3.1-flash-image-preview`
- **Tools:** `generate_image`, filesystem tools
- **System prompt directives:**
  - Write all outputs to `/home/gem/workspace/creative/task_{id}/`
  - Save images with descriptive filenames
  - Write `prompt-used.md` documenting prompts for reproducibility
  - Can read from other workspaces to understand context
  - Return concise summary listing files and descriptions

### Sub-Agent Commonalities

All sub-agents share:
- Same AIO Sandbox filesystem (read anywhere, write to designated folder)
- Filesystem tools auto-provided by sandbox backend
- Runtime context propagation (API keys flow automatically)
- Context isolation (fresh conversation, returns only final report)
- `write_todos` tool for internal planning on complex subtasks

The orchestrator controls: which type to spawn, what task to give, what files to read from other workspaces, where to write output.

> **Note:** Implementation plans for each sub-agent will go deep into: exact system prompts, error handling strategies, retry logic, output formats, edge cases (rate limits, command failures, content filtering).

---

## 8. Backend & Persistence

### CompositeBackend Structure

```
CompositeBackend
├── Default route (/) → AIOSandboxBackend
│   ├── Extends BaseSandbox
│   ├── execute() → sandbox.shell.exec()
│   ├── uploadFiles() → sandbox.file.write()
│   ├── downloadFiles() → sandbox.file.read()
│   └── All other fs tools auto-derived from execute()
│
└── /memories/ route → StoreBackend
    ├── Backed by SQLite via Drizzle ORM
    ├── Namespace: ["nexus"] (single-user, agent-scoped)
    └── Persists across sessions
```

### AIOSandboxBackend (TypeScript Port)

- Extends `BaseSandbox` from `deepagents`
- Uses `@agent-infra/sandbox` TypeScript SDK
- Only `execute()` strictly required — `BaseSandbox` derives all filesystem tools
- `uploadFiles()` and `downloadFiles()` for seeding and artifact retrieval
- Connects to AIO Sandbox at `localhost:8080`
- `readonly id` returns static identifier (single sandbox instance)

### SQLite Persistence

- Drizzle ORM with `better-sqlite3` driver
- Database file: `./data/nexus.db`
- Used by `StoreBackend` for memory files (key-value with namespace isolation)
- Used by LangGraph checkpointer for thread state persistence

### Memory

- `/memories/AGENTS.md` — always loaded into orchestrator's system prompt
- Starts with minimal seed content
- Orchestrator updates via `edit_file` when it learns user preferences
- Persists across sessions via SQLite-backed StoreBackend

### Persistence Matrix

| Data | Storage | Lifetime |
|------|---------|----------|
| Agent workspace files (`/workspace/`) | AIO Sandbox filesystem | Until container restart |
| Memory (`/memories/AGENTS.md`) | SQLite via StoreBackend | Permanent across sessions |
| Thread state / conversation history | SQLite via checkpointer | Permanent across sessions |
| Todo list state | LangGraph agent state | Per-thread |
| Sub-agent intermediate context | In-memory (StateBackend) | Per sub-agent invocation |

---

## 9. Custom Tools

### Search & Research Tools (Research Sub-Agent)

**`tavily_search`** — Wraps `POST https://api.tavily.com/search`
- Inputs: `query` (required), `search_depth` (basic/advanced/fast/ultra-fast), `max_results` (1-20), `topic` (general/news/finance), `time_range` (day/week/month/year), `include_answer` (bool or basic/advanced), `include_raw_content` (bool or markdown/text), `include_images` (bool), `chunks_per_source` (1-3, for advanced depth), `include_domains`/`exclude_domains`
- Returns: results with `title`, `url`, `content`, `score`, optional `answer` and `raw_content`

**`tavily_extract`** — Wraps `POST https://api.tavily.com/extract`
- Inputs: `urls` (string/array, required), `query` (optional for reranking), `extract_depth` (basic/advanced), `chunks_per_source` (1-5, when query provided), `include_images` (bool)
- Returns: results with `url`, `raw_content`, plus `failed_results`

**`tavily_map`** — Wraps `POST https://api.tavily.com/map`
- Inputs: `url` (required), `instructions` (optional NL for crawler), `max_depth` (1-5), `max_breadth` (1-500), `limit`, `select_paths`/`exclude_paths`, `select_domains`/`exclude_domains`
- Returns: `base_url`, `urls[]`, `total_urls`

**`exa_search`** — Wraps `POST https://api.exa.ai/search` (or `exa-js` SDK)
- Inputs: `query` (required), `type` (neural/fast/auto/deep-lite/deep/deep-reasoning/instant), `numResults`, `category` (company/research paper/news/personal site/financial report/people), `contents` object (text, highlights, summary, subpages, extras), `includeDomains`/`excludeDomains`, date filters, `additionalQueries` (array for deep search), `systemPrompt` (for deep search), `outputSchema` (for structured output)
- Returns: results with `title`, `url`, `score`, `publishedDate`, `author`, plus content fields. Deep search variants also return synthesized `output`.

### Image Generation Tool (Creative Sub-Agent)

**`generate_image`** — Calls Gemini Imagen API via `gemini-3.1-flash-image-preview`
- Inputs: `prompt`, `filename`
- Behavior: generates image, saves to sub-agent workspace folder
- Returns: file path + description

### Sandbox Tools (auto-provided)

From `BaseSandbox` / `AIOSandboxBackend` — not custom: `execute`, `ls`, `read_file`, `write_file`, `edit_file`, `glob`, `grep`

### Meta-Router Classifier (internal)

Structured output LLM call (not a LangChain tool):
- Model: always `gemini-3-flash-preview`
- Output schema: `{ model: "gemini-3-flash-preview" | "gemini-3.1-pro-preview", reasoning: string }`

### Tool Registration

| Agent | Custom Tools | Auto Tools |
|-------|-------------|------------|
| Orchestrator | *(none — it delegates)* | `write_todos`, `task`, filesystem tools |
| Research Sub-Agent | `tavily_search`, `tavily_extract`, `tavily_map`, `exa_search` | filesystem tools |
| Code Sub-Agent | *(none)* | `execute`, filesystem tools |
| Creative Sub-Agent | `generate_image` | filesystem tools |

---

## 10. Skills System

Skills provide workflow-level instructions to the orchestrator and sub-agents. They're detailed playbooks loaded on-demand via progressive disclosure.

### How Skills Flow

1. Orchestrator starts with skill frontmatter loaded (names + descriptions only)
2. User prompt arrives, orchestrator checks which skills match
3. If matched, orchestrator reads full `SKILL.md` into context
4. Skill instructions guide planning — which sub-agents to spawn, in what order, with what task descriptions
5. Sub-agents can have their own skills (passed via `skills` parameter, independent from orchestrator)

### Starter Skills

| Skill | Description | Guides |
|-------|-------------|--------|
| `/skills/deep-research/` | Multi-source research on a topic | How to decompose research questions, when to use Tavily vs Exa, output format |
| `/skills/build-app/` | Create web apps/scripts/software | Plan → scaffold → implement → test → iterate, sandbox execution |
| `/skills/generate-image/` | Image generation and visual assets | Effective Imagen prompts, variations, naming conventions |
| `/skills/data-analysis/` | Data processing and visualization | Analysis pipeline planning, library installation in sandbox |
| `/skills/write-report/` | Formatted documents and reports | Report structure, reading from multiple sources, formatting conventions |

Skills are extensible — users add new skills by dropping a folder with `SKILL.md` into `/skills/`.

Actual `SKILL.md` content will be crafted during implementation (they are detailed prompt engineering).

---

## 11. Frontend Architecture

### Scaffold

Agent Chat UI (`npx create-agent-chat-app`) — keep LangGraph proxy, thread management, `useStream` wiring. Strip default UI, replace with Nexus design.

### Component Library

- shadcn/ui as base components (already in scaffold)
- AI Elements installed as editable source files (`npx ai-elements@latest add conversation message prompt-input tool reasoning suggestion`)
- Tailwind CSS, dark theme throughout

### Two UI States

#### Landing State (idle)

Full-width centered layout:
```
┌──────────────────────────────────────────────┐
│                                              │
│            [Nexus icon/logo]                 │
│                                              │
│           Nexus works.                       │
│   Everything AI can do, Nexus does for you.  │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ [Prompt textarea]              🎤  →  │  │
│  └────────────────────────────────────────┘  │
│                                              │
└──────────────────────────────────────────────┘
```

- Centered vertically and horizontally
- Tagline + prompt input with submit button
- No category chips, no example cards — minimal and clean
- On submit: transitions to execution state

#### Execution State (active)

30/70 split layout:
```
┌──────────┬───────────────────────────────────┐
│ 30%      │ 70%                               │
│          │                                   │
│ PLAN     │ [Orchestrator message]             │
│ ☑ Step 1 │                                   │
│ ◉ Step 2 │ ┌─ Research Agent (task_abc123) ─┐│
│ ○ Step 3 │ │ 🟢 gemini-3.1-pro-preview     ││
│ ○ Step 4 │ │ Searching for AI in K-12...    ││
│          │ │ ████████░░ streaming...         ││
│──────────│ └─────────────────────────────────┘│
│ AGENTS   │                                   │
│ ◉ Research│ ┌─ Code Agent (task_def456) ────┐│
│   running│ │ ⏳ pending                     ││
│ ⏳ Code  │ └─────────────────────────────────┘│
│   pending│                                   │
└──────────┴───────────────────────────────────┘
```

**Left panel (30%) — Mission Control Sidebar:**
- Top: Plan — real-time todo list from `stream.values.todos` with status icons
- Bottom: Agents — list of active sub-agents from `stream.subagents` with status badges and elapsed time

**Right panel (70%) — Execution & Results:**
- Orchestrator messages via AI Elements `Message` / `MessageResponse`
- Sub-agent cards (collapsible) showing: agent type + task ID, model badge, task description, streaming content, status badge, elapsed time
- Final synthesized result at bottom after completion

### Streaming Wiring

```typescript
const stream = useStream<typeof nexusAgent>({
  apiUrl: "http://localhost:2024",
  assistantId: "nexus",
  filterSubagentMessages: true,
});

// Left panel:
stream.values?.todos             // todo list (optional chain — values can be undefined initially)
stream.subagents                 // sub-agent instances (Map)

// Right panel:
stream.messages                  // coordinator messages
stream.getSubagentsByMessage(id) // sub-agents per message
stream.isLoading                 // true while agent is running (used for synthesis indicator + submit button state)

// Submit:
stream.submit(
  { messages: [{ type: "human", content: text }] },
  { streamSubgraphs: true }
);
```

**Note on model badges:** The `SubagentStreamInterface` does not include a `model` field. To show model names on agent cards, we'll derive them from `toolCall.args.subagent_type` — since each sub-agent type maps to a known model (research → Pro, code → Pro, creative → flash-image-preview), the frontend can map type → model name statically.

### Completion State

- UI stays in 30/70 split
- Todo list shows all items completed
- Agent cards collapsed
- Final result as last message in 70% panel
- Prompt input available at bottom (for future interactivity)

---

## 12. Project Structure

Turborepo monorepo, scaffolded via `npx create-agent-chat-app`. Two workspace apps.

```
nexus/
├── package.json                       # Turborepo workspace root
├── turbo.json                         # Turbo task config
├── langgraph.json                     # Graph registration → nexus graph
├── .env                               # API keys
│
├── apps/
│   ├── agents/                        # LangGraph agent server
│   │   ├── package.json
│   │   └── src/
│   │       ├── nexus/                 # ← Replace research-agent
│   │       │   ├── graph.ts           # Main graph: meta-router → orchestrator
│   │       │   ├── meta-router.ts     # Prompt classifier
│   │       │   ├── orchestrator.ts    # createDeepAgent config
│   │       │   ├── subagents/
│   │       │   │   ├── research.ts
│   │       │   │   ├── code.ts
│   │       │   │   └── creative.ts
│   │       │   ├── tools/
│   │       │   │   ├── tavily-search.ts
│   │       │   │   ├── tavily-extract.ts
│   │       │   │   ├── tavily-map.ts
│   │       │   │   ├── exa-search.ts
│   │       │   │   └── generate-image.ts
│   │       │   ├── backend/
│   │       │   │   ├── aio-sandbox.ts
│   │       │   │   ├── composite.ts
│   │       │   │   └── store.ts
│   │       │   ├── middleware/
│   │       │   │   └── configurable-model.ts
│   │       │   └── db/
│   │       │       ├── schema.ts
│   │       │       └── index.ts
│   │       ├── skills/
│   │       │   ├── deep-research/SKILL.md
│   │       │   ├── build-app/SKILL.md
│   │       │   ├── generate-image/SKILL.md
│   │       │   ├── data-analysis/SKILL.md
│   │       │   └── write-report/SKILL.md
│   │       └── memories/
│   │           └── AGENTS.md
│   │
│   └── web/                           # Next.js frontend (Agent Chat UI scaffold)
│       ├── package.json
│       ├── next.config.mjs
│       ├── tailwind.config.js
│       ├── components.json
│       └── src/
│           ├── app/
│           │   ├── layout.tsx         # Restyle: dark theme
│           │   ├── globals.css        # Restyle: Perplexity aesthetic
│           │   └── page.tsx           # Rewrite: landing ↔ execution
│           ├── components/
│           │   ├── ai-elements/       # ← NEW: AI Elements source files
│           │   ├── landing/           # ← NEW: Landing page
│           │   ├── execution/         # ← NEW: Execution view
│           │   ├── shared/            # ← NEW: Shared components
│           │   ├── thread/            # KEEP logic, strip UI
│           │   ├── ui/                # KEEP: shadcn/ui
│           │   └── icons/             # KEEP/MODIFY
│           ├── hooks/
│           │   ├── useMediaQuery.tsx   # Keep
│           │   └── use-nexus-stream.ts # ← NEW
│           ├── lib/                   # KEEP + MODIFY
│           └── providers/             # KEEP: Stream, Thread, client
│
└── data/                              # ← NEW: gitignored
    └── nexus.db
```

### What We Keep from Agent Chat UI

- Turborepo workspace structure, build config, dev scripts
- `apps/web/src/providers/` — Stream, Thread, client (LangGraph connectivity)
- `apps/web/src/components/ui/` — shadcn/ui base components
- Proxy configuration to LangGraph server

### What We Strip/Replace

- `apps/agents/src/research-agent/` → `apps/agents/src/nexus/`
- `apps/web/src/components/thread/` — strip UI rendering, keep thread logic
- `apps/web/src/app/page.tsx` — complete rewrite
- `langgraph.json` graphs → point to Nexus graph

### Dev Workflow

```bash
# Prerequisite: AIO Sandbox running
docker run --security-opt seccomp=unconfined --rm -it -p 8080:8080 ghcr.io/agent-infra/sandbox:latest

# Start both apps (Turbo runs langgraph dev + next dev concurrently)
npm run dev

# Open: http://localhost:3000
```

---

## 13. Implementation Plan Decomposition

This spec breaks into 8 implementation plans. Each plan goes deep into internal logic, code structure, function signatures, error handling, edge cases, and testing. The spec defines *what* and *why*; plans define *how*.

### Plan 1: Foundation & Backend Infrastructure
- AIOSandboxBackend TypeScript port (extends BaseSandbox)
- SQLite setup with Drizzle ORM — note: StoreBackend wraps a `BaseStore` interface, not SQLite directly. Need a SQLite-backed `BaseStore` implementation (check if LangGraph provides one, or implement custom).
- CompositeBackend wiring (sandbox + StoreBackend) — **early verification needed:** no doc examples show a sandbox as the default route of a CompositeBackend. Test that the harness still detects `SandboxBackendProtocol` through the CompositeBackend wrapper and auto-provisions the `execute` tool.
- Database schema, connection, checkpointer (separate from StoreBackend — two distinct SQLite consumers)
- `.env` configuration — rewrite `.env.example` (remove Anthropic/Elastic/Pinecone/MongoDB/Cohere/OpenAI keys, add GOOGLE_API_KEY, TAVILY_API_KEY, EXA_API_KEY)
- Clean up `apps/agents/package.json` — remove scaffold dependencies (Anthropic, Elasticsearch, Pinecone, MongoDB, Cohere, OpenAI), add correct ones (@langchain/google-genai, @agent-infra/sandbox, better-sqlite3, drizzle-orm, etc.)
- Create `data/` directory and update `.gitignore`
- **Verify:** agent can execute commands in sandbox and persist memory

### Plan 2: Meta-Router & Orchestrator Core
- Meta-router node (Flash classifier with structured output)
- Main LangGraph graph (`graph.ts`) wiring meta-router → orchestrator — **must resolve:** how the meta-router node's output (model choice) gets into `runtime.context` for the ConfigurableModel middleware. Options: (a) meta-router writes to graph state, middleware reads from state instead of context, or (b) graph-level mechanism injects into context.
- ConfigurableModel middleware for runtime model swapping — must also define `contextSchema` (Zod schema) including the `model` field
- Orchestrator createDeepAgent config (system prompt, memory, skills paths)
- `langgraph.json` registration — update to `"nexus": "./apps/agents/src/nexus/graph.ts:graph"`
- **Verify:** prompt goes through meta-router, correct model selected, orchestrator responds

### Plan 3: Custom Tools
- `tavily_search`, `tavily_extract`, `tavily_map` tool definitions with Zod schemas — use snake_case parameter names matching the actual APIs. Include all enum values and optional parameters per the API specs in `docs/custom/NEXUS.md`.
- `exa_search` tool definition — include all 7 type values (neural/fast/auto/deep-lite/deep/deep-reasoning/instant) and all 6 categories
- `generate_image` tool definition
- API key handling via runtime context — define explicit `contextSchema` with `googleApiKey`, `tavilyApiKey`, `exaApiKey` fields. Tools access via `runtime.context`.
- **Verify:** each tool works standalone with test inputs

### Plan 4: Sub-Agents
- Research sub-agent definition (SubAgent config, system prompt, tool registration)
- Code sub-agent definition
- Creative sub-agent definition
- **Address the general-purpose subagent:** DeepAgents always adds a GP subagent alongside custom ones. Either override it with `name: "general-purpose"` in the subagents list, or instruct the orchestrator's system prompt to prefer specialized agents. Must decide and implement.
- **Clarify `execute` tool availability:** Since all sub-agents share the sandbox backend, `execute` is auto-provisioned for ALL agents (not just Code). Either accept this or investigate filtering it out for Research and Creative.
- Workspace directory convention enforcement (system prompt instructions) — use `/home/gem/workspace/` as root
- **Verify:** orchestrator can spawn each sub-agent type, they write to correct workspace paths, tools work with runtime context propagation (not just standalone)

### Plan 5: Skills
- Write all SKILL.md files (deep-research, build-app, generate-image, data-analysis, write-report) — keep descriptions under 1024 characters (truncation limit), files under 10 MB
- Skills should include explicit sub-agent delegation patterns (e.g., "spawn Research sub-agents for each sub-question, then synthesize") — this is a novel use beyond single-agent skills shown in docs
- Ensure deep-research and write-report have clearly differentiated descriptions to avoid both loading unnecessarily
- Skills directory setup and registration
- **Verify:** orchestrator loads skills on demand, follows skill instructions during execution

### Plan 6: Frontend — Landing Page
- Strip Agent Chat UI default components
- Install AI Elements (`npm install @langchain/react @ai-elements/react` + `npx ai-elements@latest add ...`)
- Handle `Stream.tsx` configuration form — either ensure env vars are always set (so form never shows) or refactor `StreamProvider` to separate connectivity from config UI
- Build landing page (tagline + prompt input)
- Dark theme styling (Perplexity-inspired)
- Prompt submission wiring via useStream
- **Verify:** user can type and submit a prompt

### Plan 7: Frontend — Execution View
- 30/70 split layout
- Left panel: todo list (use `stream.values?.todos` with optional chaining) + agent status list (iterate `stream.subagents.values()`, filter by status)
- Right panel: agent cards with streaming, status badges, model badges (derived from `subagent_type` → model name mapping), elapsed time
- Synthesis indicator — use `stream.isLoading` + all subagents complete check (pattern from `subagent-streaming.md`)
- Completion state — submit button uses `stream.isLoading` for state (`"streaming"` vs `"ready"`)
- Stream wiring: `filterSubagentMessages`, `getSubagentsByMessage`, `stream.subagents`
- **Verify:** full end-to-end flow — submit prompt, watch agents work, see result

### Plan 8: End-to-End Integration & Polish
- Full flow testing (landing → execution → result)
- Memory persistence testing
- Error handling (sandbox unreachable, API key missing, model errors)
- UI polish and responsiveness
- README with setup instructions

### Plan Dependencies

```
Plan 1 (Foundation) → Plan 2 (Meta-Router & Orchestrator) → Plan 4 (Sub-Agents)
                   → Plan 3 (Tools) ↗
Plan 2 → Plan 5 (Skills)
Plan 6 (Landing) → Plan 7 (Execution View)
Plans 1-5 + Plans 6-7 → Plan 8 (Integration)
```

Plans 1-5 (backend) and Plans 6-7 (frontend) can progress in parallel once Plan 1 is done.
