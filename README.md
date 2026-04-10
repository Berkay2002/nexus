<p align="center">
  <img src="apps/web/public/logo/logo-text.png" alt="Nexus" width="320" />
</p>

<p align="center">
  <em>One prompt. Many agents. One deliverable. Running on your laptop.</em>
</p>

<p align="center">
  <a href="#setup">Setup</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#demo">Demo</a> ·
  <a href="#roadmap">Roadmap</a>
</p>

---

# Nexus

Nexus takes a single prompt, routes it through a classifier, hands it to an orchestrator that plans with a todo list, and fans work out to research, code, and creative sub-agents that share a sandboxed filesystem. At the end you get a written report, code, or an image, assembled from whatever the agents produced along the way.

## Why I built this

I like open source because I can pull it apart. Perplexity Computer showed me a shape of product I wanted to exist, and ByteDance's [deer-flow](https://github.com/bytedance/deer-flow) showed me it could be built in the open. I wanted my own take on it, running locally, in a stack I actually know: LangChain, LangGraph, and DeepAgents. Nexus is the result: the Docker container and the agents live on your machine, and you swap providers by editing `.env`.

## What's in the box

- **Meta-router** (a Flash-tier classifier) decides whether your prompt needs one agent or a full orchestration.
- **Orchestrator** built on DeepAgents. Plans with a todo list, calls sub-agents, writes everything to a shared workspace.
- **Sub-agents**: `research` (Tavily search, extract, map), `code`, `creative` (Gemini image gen), and a `general-purpose` fallback.
- **AIO Sandbox**: one Docker container with shell, browser, filesystem, and Jupyter that every agent shares.
- **Provider-agnostic models**: five tiers (`classifier`, `default`, `code`, `deep-research`, `image`) resolved per role at runtime. Drop in Google, Anthropic, OpenAI, or Z.AI.
- **Skills**: five orchestrator skills (`deep-research`, `build-app`, `generate-image`, `data-analysis`, `write-report`) loaded as files the orchestrator can read.
- **Streaming UI**: Next.js, shadcn, and AI Elements. A 30/70 split with a todo panel on the left and live subagent cards on the right. Every tool call, message, and todo update streams in as it happens.

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
- **Next.js frontend** streams subagent messages, todos, and tool calls via `useStream` from `@langchain/react` (not `@langchain/langgraph-sdk/react`, which is missing subagent features).

Full design spec: `docs/superpowers/specs/2026-04-10-nexus-design.md`.

## Project layout

```
apps/
  agents/src/nexus/
    graph.ts                meta-router + orchestrator wiring
    models/                 tier-based provider registry
    agents/{research,code,creative,general-purpose}/
    tools/{search,extract,map,generate-image}/
    skills/{deep-research,build-app,...}/   # SKILL.md + templates
    backend/                aio-sandbox + composite + store
    middleware/             configurable per-role model swap
  web/src/
    app/page.tsx            landing ↔ execution switch
    app/demo/page.tsx       mocked demo view (Vercel-deployable)
    components/execution/   todo panel, agent cards, prompt bar
    components/landing/     logo, tagline, prompt input
    providers/              LangGraph client + Stream provider
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

MVP is done. What's next is less about shipping features and more about making the thing feel good to use.

- **More providers** — anything OpenAI- or Anthropic-compatible should fall out cheaply. Groq and DeepSeek are the obvious next ones.
- **Image gen beyond Google** — loosen the creative sub-agent's hard Google dependency.

## License

MIT. See [LICENSE](LICENSE).

## Acknowledgements

Inspired by Perplexity Computer and ByteDance's [deer-flow](https://github.com/bytedance/deer-flow). Built on [DeepAgents](https://github.com/langchain-ai/deepagents), [LangGraph](https://github.com/langchain-ai/langgraph), [AIO Sandbox](https://github.com/agent-infra/sandbox), and [Tavily](https://tavily.com). 
