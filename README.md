<p align="center">
  <img src="apps/web/public/logo/logo-text.png" alt="Nexus" width="320" />
</p>

# Nexus

Local-first AI agent platform. One prompt → multiple specialized agents
work in parallel → assembled deliverable. Inspired by Perplexity Computer.

## Prerequisites

- Node.js 20+
- Docker (for the AIO Sandbox container)
- Google Gemini credentials — one of:
  - **Vertex AI** (recommended — safest, no keys in env): Google Cloud project with Vertex AI enabled + `gcloud auth application-default login`
  - **API key**: `GOOGLE_API_KEY` or `GEMINI_API_KEY` from https://aistudio.google.com/apikey
- Tavily API key — https://tavily.com

## Setup

1. Clone and install:
   ```
   git clone <repo>
   cd nexus
   npm install
   ```

2. Copy env template and choose one Google auth path in `.env`:
   ```
   cp .env.example .env
   ```

   **Option A — Vertex AI (recommended):**
   ```
   GOOGLE_CLOUD_PROJECT="your-project-id"
   GOOGLE_CLOUD_LOCATION="us-central1"
   TAVILY_API_KEY="..."
   ```
   Then run `gcloud auth application-default login` (one-time). `@langchain/google` auto-selects Vertex AI whenever ADC is present and no `GOOGLE_API_KEY` is set.

   **Option B — API key:**
   ```
   GOOGLE_API_KEY="..."           # or GEMINI_API_KEY="..."
   TAVILY_API_KEY="..."
   ```

3. Start the AIO Sandbox (separate terminal):
   ```
   docker run --security-opt seccomp=unconfined --rm -it -p 8080:8080 \
     ghcr.io/agent-infra/sandbox:latest
   ```

4. Start Nexus:
   ```
   npm run dev
   ```

   Runs LangGraph on :2024 and Next.js on :3000. On startup you should see
   `[nexus] preflight ok (google auth: vertex-adc)` (or `api-key`).

5. Open http://localhost:3000.

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

- **"Cannot reach LangGraph server"** — `npm run dev` isn't running, or it crashed.
  Check the terminal for a `[nexus] preflight warning`.
- **"AIO Sandbox unreachable"** — start the Docker container (step 3 above).
- **Vertex AI auth errors** — re-run `gcloud auth application-default login` and
  verify `GOOGLE_CLOUD_PROJECT` matches a project with Vertex AI enabled.
- **"TAVILY_API_KEY is not set"** — fill in `.env`, restart `npm run dev`.
