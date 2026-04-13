---
created: 2026-04-12
updated: 2026-04-12
tags: [google, gemini, langchain, provider, vertex-ai]
sources: [raw/langchain/providers/google/google.md]
---

# Google Provider (`@langchain/google`)

`@langchain/google` is the unified LangChain JavaScript package for Google AI Studio and Google Cloud Vertex AI. It replaces the older `@langchain/google-genai` and `@langchain/google-vertexai` packages, consolidating both backends under a single `ChatGoogle` class. In Nexus, this provider is auto-detected at startup and used for the `classifier`, `deep-research`, and `image` tiers. See [[langchain-google-api-reference]] for the complete class surface, constructor options, and method signatures.

## Content

### Installation

```bash
npm install @langchain/google @langchain/core
```

### Authentication

**Google AI Studio** — set `GOOGLE_API_KEY`:

```bash
export GOOGLE_API_KEY=your-api-key
```

**Vertex AI** — set application default credentials:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

`ChatGoogle` detects which backend to use based on which credential is present.

### Primary Export: `ChatGoogle`

`ChatGoogle` is the recommended class for all new Gemini usage. It supersedes both `ChatGoogleGenerativeAI` (from `@langchain/google-genai`) and `ChatVertexAI` (from `@langchain/google-vertexai`).

```typescript
import { ChatGoogle } from "@langchain/google";

const model = new ChatGoogle("gemini-2.5-flash");
const res = await model.invoke([["human", "Hello"]]);
```

Supported models include `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-3.1-pro-preview`, and open models like Gemma.

### Supported Features

| Feature | Supported |
|---|---|
| Tool calling | Yes |
| Structured output | Yes |
| Streaming | Yes |
| Multimodal (image, audio, video) | Yes |
| Reasoning / thinking | Yes |
| Image generation | Yes |
| Text-to-speech | Yes |
| Google Search grounding | Yes (Gemini native tool) |
| Code execution | Yes (Gemini native tool) |

### Third-Party Models via Vertex AI

Anthropic Claude models are available through Vertex AI. Access is configured through the same `ChatGoogle` / Vertex AI credentials path.

### Legacy Packages

- **`@langchain/google-genai`** — exports `ChatGoogleGenerativeAI` for Google AI Studio. Built on a deprecated Google SDK; no new features.
- **`@langchain/google-vertexai`** — exports `ChatVertexAI` for Vertex AI. Superseded by `@langchain/google`.
- **`@langchain/google-common`** — internal shared abstractions; not for direct use.

All three remain under long-term support for existing users. Migrate to `@langchain/google` for new projects.

### Community Tools

Additional Google integrations live in `@langchain/community`: Google Calendar, Gmail, Google Places, Google Routes, Google Scholar, Google Trends.

### Nexus Auto-Detection

Nexus checks for `GOOGLE_API_KEY` (or Vertex AI credentials) at startup via `apps/agents/src/nexus/preflight.ts`. When present, Google is registered as a provider and assigned to three tiers in `models/registry.ts`:

- **`classifier`** — highest priority (Flash model for fast meta-routing)
- **`deep-research`** — highest priority (Pro model for thorough research)
- **`image`** — only provider (Google is the sole image-generation tier)

If Google credentials are absent, the `image` tier is unavailable entirely. See [[deepagents-models]] for how tier routing works across providers.

## Related

- [[chat-google-generative-ai]]
- [[langchain-google-api-reference]] — full API reference for `@langchain/google`
- [[deepagents-models]]
- [[langchain-models]]
- [[init-chat-model]]

## Sources

- `raw/langchain/providers/google/google.md` — installation, env vars, ChatGoogle class, supported features, legacy package notes
