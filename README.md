<p align="center">
  <img src="apps/web/public/logo/logo-text.png" alt="Nexus" width="320" />
</p>

<p align="center">
  <em>One prompt. Many agents. One deliverable. Running on your laptop.</em>
</p>

<p align="center">
  <a href="#setup">Setup</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#tools">Tools</a> ·
  <a href="#sub-agents">Sub-agents</a> ·
  <a href="#demo">Demo</a> ·
  <a href="#roadmap">Roadmap</a>
</p>

---

# Nexus

Nexus takes a single prompt, routes it through a classifier, hands it to an orchestrator that plans with a todo list, and fans work out to research, code, and creative sub-agents that share a sandboxed filesystem with shell, browser, code execution, Jupyter, and a catalog of 60 MCP tools they reach as files on disk. At the end you get a written report, code, or an image, assembled from whatever the agents produced along the way.

## Why I built this

I like open source because I can pull it apart. Perplexity Computer showed me a shape of product I wanted to exist, and ByteDance's [deer-flow](https://github.com/bytedance/deer-flow) showed me it could be built in the open. I wanted my own take on it, running locally, in a stack I actually know: LangChain, LangGraph, and DeepAgents. Nexus is the result: the Docker container and the agents live on your machine, and you swap providers by editing `.env`.

## What's in the box

- **Meta-router** (a Flash-tier classifier) decides whether your prompt needs one agent or a full orchestration.
- **Orchestrator** built on DeepAgents. Plans with a todo list, calls sub-agents, writes everything to a shared workspace.
- **AIO Sandbox**: one Docker container with shell, browser, filesystem, and Jupyter that every agent shares.
- **Provider-agnostic models**: five tiers (`classifier`, `default`, `code`, `deep-research`, `image`) resolved per role at runtime. Drop in Google, Anthropic, OpenAI, or Z.AI.
- **Two-layer tool surface**: a small set of hot tools bound to each sub-agent every turn, plus a cold catalog of 60 MCP tools the agent reaches by reading wrapper files inside the sandbox.

## Demo

A static preview of the execution view lives at `/demo` in the frontend (`apps/web/src/app/demo/page.tsx`). It runs on mocked data, so there's no backend or sandbox to set up, which means it can be deployed to Vercel as a UI-only preview.

The real thing needs a LangGraph server and the AIO Sandbox container running locally. Keep reading for that.

## Prerequisites

- Node.js 20+
- Docker (for the AIO Sandbox container)
- At least one model provider (see [Providers](#providers))
- A Tavily API key for search, extract, and map: [tavily.com](https://tavily.com)

## Providers

Nexus auto-detects providers from env vars. Set one and you're good. Set several and the tier router will pick a sensible model per role.

| Provider           | Env vars                                                    | Tiers covered                                   |
| ------------------ | ----------------------------------------------------------- | ----------------------------------------------- |
| Google (Vertex)    | `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION` + ADC login | classifier, default, code, deep-research, image |
| Google (AI Studio) | `GEMINI_API_KEY`                                            | classifier, default, code, deep-research, image |
| Anthropic          | `ANTHROPIC_API_KEY`                                         | classifier, default, code, deep-research        |
| OpenAI             | `OPENAI_API_KEY`                                            | classifier, default, code, deep-research        |
| Z.AI (GLM)         | `ZAI_API_KEY` (+ optional `ZAI_BASE_URL`)                   | classifier, default, code, deep-research        |

Image generation is Google-only for now. The creative sub-agent disables itself if no Google credentials are present. Loosening that is on the roadmap.

### Tiers

Agents ask for a tier, not a specific model. That's how you can swap providers without touching agent code.

- `classifier` — fast routing (Flash Lite, Haiku, nano, GLM-4.7)
- `default` — general reasoning (Flash, Sonnet, GPT-5.4, GLM-5 Turbo)
- `code` — code gen (Sonnet, Opus, GPT-5.4, GLM-5.1)
- `deep-research` — frontier models for long tasks (Gemini 3.1 Pro, Claude Opus 4.6, GPT-5.4, GLM-5.1)
- `image` — Gemini 3.1 Flash Image

The priority order per tier lives in `apps/agents/src/nexus/models/registry.ts`. Tweak it if you want a different default.

## Setup

1. Clone and install.

   ```
   git clone <repo>
   cd nexus
   npm install
   ```

2. Copy the env template and fill in one provider plus Tavily.

   ```
   cp .env.example .env
   ```

   Vertex users also run `gcloud auth application-default login` once. If you're on the GLM Coding Plan, set `ZAI_BASE_URL=https://api.z.ai/api/coding/paas/v4` (the default base URL only serves the pay-as-you-go catalog).

3. Start the AIO Sandbox in its own terminal.

   ```
   docker run --security-opt seccomp=unconfined --rm -it -p 8080:8080 \
     ghcr.io/agent-infra/sandbox:latest
   ```

4. Start Nexus.

   ```
   npm run dev
   ```

   This runs LangGraph on `:2024` and Next.js on `:3000`. The startup log tells you which providers were detected and how each tier resolved:

   ```
   [Nexus] Preflight
   [Nexus] Providers:
     google    [OK] (vertex-adc)
     anthropic [--] (ANTHROPIC_API_KEY not set)
     openai    [--] (OPENAI_API_KEY not set)
     zai       [--] (ZAI_API_KEY not set)
   [Nexus] Tier resolution:
     classifier    → google:gemini-3.1-flash-lite-preview
     default       → google:gemini-3-flash-preview
     code          → google:gemini-3-flash-preview
     deep-research → google:gemini-3.1-pro-preview
     image         → google:gemini-3.1-flash-image-preview
   ```

   Nexus fails fast if no provider can satisfy the `default` tier. No silent fallbacks.

5. Open http://localhost:3000.

## Runtime model overrides

The settings gear in the top-right of the UI opens a panel that lists every model the server detected (via `/api/models`) and lets you override the model per role: orchestrator, router, research, code, creative. Overrides go through `configurable.models` on each run and are session-scoped. Nothing is persisted server-side, so a reload resets you to the defaults.

## Architecture

Three processes, talking only over HTTP.

```
AIO Sandbox (Docker :8080) ←→ LangGraph dev server (:2024) ←→ Next.js (:3000)
```

- **AIO Sandbox** is one Docker container shared by all agents: shell, browser, filesystem, Jupyter. Workspace root is `/home/gem/workspace/`, with per-agent subfolders like `research/task_{id}/` and a `shared/` folder for final deliverables.
- **LangGraph server** hosts the meta-router, orchestrator, and sub-agents. The orchestrator is a DeepAgent with a `CompositeBackend` that routes `/memories/` and `/skills/` to SQLite (via Drizzle) and everything else to the sandbox.
- **Next.js frontend** streams subagent messages, todos, and tool calls via `useStream` from `@langchain/react` (not `@langchain/langgraph-sdk/react`, which is missing subagent features). The execution view renders a todo panel, agent status, live subagent cards, a workspace outputs panel that previews files dropped into `/shared/`, and dedicated artifact renderers for filesystem ops, code execution, and image generation.

Full design spec: `docs/superpowers/specs/2026-04-10-nexus-design.md`.

## Tools

Every sub-agent gets a small kit of hot tools bound to it on every turn. They cover the things agents do constantly: web search, browser automation, code and shell execution, Jupyter, image generation, and document conversion. Plus one search tool that opens the door to the cold catalog (see [Tool layering](#tool-layering)).

| Tool                              | What it does                                                              | Backed by    |
| --------------------------------- | ------------------------------------------------------------------------- | ------------ |
| **Search**                        |                                                                           |              |
| `tavily_search`                   | Web search with freshness, domain, and depth filters                      | Tavily       |
| `tavily_extract`                  | Pull clean markdown from a URL                                            | Tavily       |
| `tavily_map`                      | Crawl a site and return a URL graph                                       | Tavily       |
| **Browser**                       |                                                                           |              |
| `sandbox_browser_info`            | Inspect the current page (title, URL, DOM snapshot)                       | AIO Sandbox  |
| `sandbox_browser_screenshot`      | Capture a PNG of the current viewport                                     | AIO Sandbox  |
| `sandbox_browser_action`          | Click, type, scroll, navigate                                             | AIO Sandbox  |
| `sandbox_browser_config`          | Configure viewport, user agent, cookies                                   | AIO Sandbox  |
| **Code execution**                |                                                                           |              |
| `sandbox_code_execute`            | Run Python/Bash/JS one-shot in the sandbox                                | AIO Sandbox  |
| `sandbox_code_info`               | List installed languages and versions                                     | AIO Sandbox  |
| `sandbox_nodejs_execute`          | Run a Node.js script with full stdlib + npm                               | AIO Sandbox  |
| `sandbox_nodejs_info`             | Inspect the Node runtime (version, modules)                               | AIO Sandbox  |
| **Jupyter**                       |                                                                           |              |
| `sandbox_jupyter_create_session`  | Spin up a kernel for stateful work                                        | AIO Sandbox  |
| `sandbox_jupyter_execute`         | Run a cell in an existing kernel                                          | AIO Sandbox  |
| `sandbox_jupyter_info`            | Inspect kernel state, variables, history                                  | AIO Sandbox  |
| `sandbox_jupyter_list_sessions`   | List active kernels                                                       | AIO Sandbox  |
| `sandbox_jupyter_delete_session`  | Tear down a kernel                                                        | AIO Sandbox  |
| **MCP discovery**                 |                                                                           |              |
| `mcp_tool_search`                 | Search the cold catalog of 60 MCP tools by keyword, returns wrapper paths | Custom       |
| **Media**                         |                                                                           |              |
| `generate_image`                  | Generate or edit images via Gemini Imagen                                 | Google       |
| **Util**                          |                                                                           |              |
| `sandbox_util_convert_to_markdown`| Convert PDFs, DOCX, HTML, and other formats to LLM-readable markdown      | AIO Sandbox  |

These are the only tools the model sees in its system prompt. Everything else lives in the cold layer.

## Tool layering

Two layers, one mental model.

```
HOT — bound to sub-agents every turn       COLD — files in /home/gem/workspace/servers/
research / code sub-agents                  60 MCP tools as TypeScript wrapper files
                                       │
                                       ▼
                          mcp_tool_search   →   wrapper paths
                          read wrapper file →   schema + example
                          write Node script →   sandbox_nodejs_execute
```

The hot layer is what you see in the table above: ~20 tools that ship in every sub-agent's system prompt. The cold layer is the AIO Sandbox's full MCP catalog — 60 tools across `chrome_devtools_*` (27), `browser_*` (23), and `sandbox_*` (10) — exposed as TypeScript wrapper files under `/home/gem/workspace/servers/`. The agent reaches them by calling `mcp_tool_search`, getting a list of file paths, reading the wrapper for the schema and a worked example, and then writing a small Node script that imports and runs the wrapper via `sandbox_nodejs_execute`.

Why the indirection? Two reasons.

1. **Token cost.** Binding 60 schemas to a sub-agent puts every schema in the system prompt every turn — measured at ~55K tokens before the conversation starts. With the cold layer, an agent only pays for the wrappers it chooses to read on a given turn.
2. **Tool selection accuracy.** Models get worse at picking the right tool when the catalog is larger than 30-50 entries. Sixty tools is over the threshold. A search affordance plus a small hot kit beats one big flat namespace.

The whole thing is provider-agnostic by construction: no `defer_loading`, no beta headers, no `ChatAnthropic`-only branches. Same code path on Google, Anthropic, OpenAI, and Z.AI. Full design in `docs/superpowers/specs/2026-04-13-mcp-filesystem-of-tools-design.md`.

## Sub-agents

Sub-agents are self-contained — they do not inherit tools, prompts, or skills from the orchestrator. Each one is wired to its own tier and its own kit.

| Sub-agent         | Tier            | Tools                                                                                              |
| ----------------- | --------------- | -------------------------------------------------------------------------------------------------- |
| `research`        | `deep-research` | tavily search/extract/map, browser-*, util-convert-to-markdown, `mcp_tool_search`, `sandbox_nodejs_execute` |
| `code`            | `code`          | code/nodejs/jupyter execution, `mcp_tool_search`                                                   |
| `creative`        | `image`         | `generate_image`                                                                                   |
| `general-purpose` | `default`       | none — defers back to the orchestrator                                                             |

DeepAgents always adds a general-purpose sub-agent alongside custom ones. Nexus overrides its prompt to push work toward the specialised agents.

## Skills

Five orchestrator skills live as files under `apps/agents/src/nexus/skills/`:

- `deep-research` — multi-pass investigation with critique
- `build-app` — bootstrap a small project, write code, run it
- `generate-image` — image generation with prompt refinement
- `data-analysis` — CSV/Parquet analysis via Jupyter
- `write-report` — synthesise a markdown deliverable from collected materials

Skills are not embedded in the system prompt. They're loaded into the orchestrator's filesystem (under `/skills/`) at startup via the `CompositeBackend`'s `StoreBackend` route, and the orchestrator reads them on demand. Adding a skill is a matter of dropping a `SKILL.md` and templates folder under `skills/{name}/` and re-running.

## Project layout

```
apps/
  agents/src/nexus/
    graph.ts                meta-router + orchestrator wiring
    models/                 tier-based provider registry
    agents/{research,code,creative,general-purpose}/
    tools/{search,extract,map,generate-image,
           code-execute,code-info,nodejs-execute,nodejs-info,
           jupyter-{create,execute,info,list,delete}-session,
           browser-{info,screenshot,action,config},
           util-convert-to-markdown}/
    skills/{deep-research,build-app,...}/   # SKILL.md + templates
    backend/                aio-sandbox + composite + store
    middleware/             configurable per-role model swap, runtime instructions
  web/src/
    app/page.tsx                       landing ↔ execution switch
    app/demo/page.tsx                  mocked demo view (Vercel-deployable)
    components/execution/              todo panel, agent cards, prompt bar,
                                       workspace outputs panel,
                                       filesystem / execute / generate-image artifacts
    components/landing/                logo, tagline, prompt input
    components/settings/               runtime model override panel
    providers/                         LangGraph client + Stream provider
```

## Commands

- `npm run dev` — start both servers
- `npm run build` — build all workspaces
- `npm run lint` — lint everything
- `cd apps/agents && npm test` — agent tests (unit tests don't need credentials)

## Troubleshooting

- **`No provider can satisfy the 'default' tier`** — no provider env vars detected. Set at least one of `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `ZAI_API_KEY`, or a Vertex `GOOGLE_CLOUD_PROJECT` with ADC, then restart.
- **Creative sub-agent disabled** — image generation needs Google. Add a Google credential if you want `generate_image`.
- **Vertex AI auth errors** — re-run `gcloud auth application-default login` and check that `GOOGLE_CLOUD_PROJECT` points at a project with Vertex AI enabled.
- **Z.AI returns 404 or model-not-found** — you're probably on the GLM Coding Plan. Set `ZAI_BASE_URL=https://api.z.ai/api/coding/paas/v4`.
- **"Cannot reach LangGraph server"** — `npm run dev` isn't running, or it crashed during preflight. Check the terminal.
- **"AIO Sandbox unreachable"** — start the Docker container (step 3 above).
- **"TAVILY_API_KEY is not set"** — fill in `.env` and restart.

## Roadmap

MVP is done. What's next is less about shipping features and more about making the thing feel good to use. Full descriptions in [ROADMAP.md](ROADMAP.md).

**Now**
- `docker compose up` for the whole stack
- Cost and token meter per run

**Next**
- Interruptible agents with a redirect input
- "Why did you do that" inspector on every tool call
- Editable `AGENTS.md` for project-level instructions
- Critic sub-agent that reviews drafts before synthesis
- LangSmith trace integration in the UI
- Context caching across providers (Anthropic, Gemini, OpenAI)

**Later**
- Nexus exposes itself as an MCP server
- Import skills from a Git URL

## License

MIT. See [LICENSE](LICENSE).

## Acknowledgements

Inspired by Perplexity Computer and ByteDance's [deer-flow](https://github.com/bytedance/deer-flow). Built on [DeepAgents](https://github.com/langchain-ai/deepagents), [LangGraph](https://github.com/langchain-ai/langgraph), [AIO Sandbox](https://github.com/agent-infra/sandbox), and [Tavily](https://tavily.com).
