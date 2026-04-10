<p align="center">
  <img src="apps/web/public/logo/logo-text.png" alt="Nexus" width="320" />
</p>

# Nexus

Local-first AI agent platform. One prompt → multiple specialized agents
work in parallel → assembled deliverable. Inspired by Perplexity Computer.

## Prerequisites

- Node.js 20+
- Docker (for the AIO Sandbox container)
- **At least one model provider** (see [Providers](#providers) below)
- Tavily API key — https://tavily.com

## Providers

Nexus is provider-agnostic. Set credentials for **any one** of the providers
below and Nexus will auto-detect it on startup. Setting more than one lets the
tier router pick the best model per role.

| Provider          | Env vars                                                      | Tiers covered                                    |
| ----------------- | ------------------------------------------------------------- | ------------------------------------------------ |
| Google (Vertex)   | `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION` + ADC login   | classifier, default, code, deep-research, image |
| Google (AI Studio)| `GEMINI_API_KEY`                                              | classifier, default, code, deep-research, image |
| Anthropic         | `ANTHROPIC_API_KEY`                                           | classifier, default, code, deep-research         |
| OpenAI            | `OPENAI_API_KEY`                                              | classifier, default, code, deep-research         |
| Z.AI (GLM)        | `ZAI_API_KEY` (+ optional `ZAI_BASE_URL`)                     | classifier, default, code, deep-research         |

**Image generation requires Google** — the creative sub-agent disables itself
if no Google credentials are present.

### Tiers

Every agent asks the registry for a **tier**, not a specific model. Tiers:

- `classifier` — fast routing decisions (Flash Lite / Haiku / nano / GLM-4.7)
- `default` — general-purpose reasoning (Flash / Sonnet / GPT-5.4 / GLM-5 Turbo)
- `code` — code generation and refactors (Sonnet / Opus / GPT-5.4 / GLM-5.1)
- `deep-research` — long-horizon research with the frontier model of each provider (Gemini 3.1 Pro / Claude Opus 4.6 / GPT-5.4 / GLM-5.1)
- `image` — image generation (Gemini 3.1 Flash Image; Google only)

Priority order per tier is defined in `apps/agents/src/nexus/models/registry.ts`.

## Setup

1. Clone and install:
   ```
   git clone <repo>
   cd nexus
   npm install
   ```

2. Copy the env template and fill in **one** provider plus Tavily:
   ```
   cp .env.example .env
   ```

   Vertex users also run `gcloud auth application-default login` once. Z.AI
   GLM Coding Plan users should set
   `ZAI_BASE_URL=https://api.z.ai/api/coding/paas/v4`.

3. Start the AIO Sandbox (separate terminal):
   ```
   docker run --security-opt seccomp=unconfined --rm -it -p 8080:8080 \
     ghcr.io/agent-infra/sandbox:latest
   ```

4. Start Nexus:
   ```
   npm run dev
   ```

   Runs LangGraph on :2024 and Next.js on :3000. The startup log shows which
   providers were detected and how each tier resolved:
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

   Nexus fails fast on startup if no provider can satisfy the `default` tier.

5. Open http://localhost:3000.

## Runtime model overrides

The settings gear in the top-right of the UI opens a panel that lists every
model the server detected (`/api/models`) and lets you override the model
per role (orchestrator, router, research, code, creative). Overrides are
passed through on each run via `configurable.models` and scoped to the
current session — they are not persisted server-side.

## Architecture

Three processes: AIO Sandbox (Docker :8080), LangGraph dev server (:2024),
Next.js frontend (:3000). See `docs/superpowers/specs/2026-04-10-nexus-design.md`
for the full design spec.

## Commands

- `npm run dev` — start both servers
- `npm run build` — build all workspaces
- `npm run lint` — lint all workspaces
- `cd apps/agents && npm test` — run agent tests (unit tests don't need credentials)

## Troubleshooting

- **`No provider can satisfy the 'default' tier`** — no provider env vars
  detected. Set at least one of `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` /
  `OPENAI_API_KEY` / `ZAI_API_KEY` (or a Vertex `GOOGLE_CLOUD_PROJECT` with
  ADC) and restart.
- **Creative sub-agent disabled** — image generation requires Google. Add a
  Google credential if you need `generate_image`.
- **Vertex AI auth errors** — re-run `gcloud auth application-default login`
  and verify `GOOGLE_CLOUD_PROJECT` matches a project with Vertex AI enabled.
- **Z.AI 404 / model-not-found** — if you're on the GLM Coding Plan, set
  `ZAI_BASE_URL=https://api.z.ai/api/coding/paas/v4`. The default base URL
  (`https://api.z.ai/api/paas/v4`) only serves the pay-as-you-go catalog.
- **"Cannot reach LangGraph server"** — `npm run dev` isn't running, or it
  crashed during preflight. Check the terminal output.
- **"AIO Sandbox unreachable"** — start the Docker container (step 3 above).
- **"TAVILY_API_KEY is not set"** — fill in `.env`, restart `npm run dev`.
