---
created: 2026-04-12
updated: 2026-04-12
tags: [google, gemini, langchain, reference, streaming]
sources: [raw/references/google-gen-ai-reference.md]
---

# `@langchain/google` API Reference

`@langchain/google` is the unified LangChain JavaScript/TypeScript package for Google AI models. It exposes `ChatGoogle` as its primary class, uses direct REST calls (not the Google `genai` library), and supports both Google AI Studio and Vertex AI backends. It replaces the older `@langchain/google-genai` and `@langchain/google-vertexai` packages.

## Content

### Primary Class: `ChatGoogle`

Exported from both `@langchain/google` (index) and `@langchain/google/node`. Instantiate with a model ID string:

```typescript
import { ChatGoogle } from "@langchain/google";

const model = new ChatGoogle("gemini-2.5-flash");
```

Supports tool calling, structured output, streaming, multimodal input, reasoning, image generation, and text-to-speech. For full configuration options see the [[google-provider]] article.

### Specialty Tools

`ChatGoogle` supports Gemini-specific "Specialty Tools" beyond standard LangChain tool calling:

- **Code Execution** — lets the model run code in a sandboxed interpreter and return results
- **Grounding with Google Search** — attaches live search results to model responses, reducing hallucination on current-events queries

Pass these as tools in the `tools` array on the call options (`ChatGoogleCallOptions`).

### Exported Classes

| Class | Purpose |
|---|---|
| `ChatGoogle` | Primary chat model — AI Studio or Vertex AI |
| `GoogleRequestCallbackHandler` | Base class for intercepting raw Google API requests |
| `GoogleRequestLogger` | Logs request/response payloads for debugging |
| `GoogleRequestRecorder` | Records requests for replay in tests |

`GoogleRequestLogger` and `GoogleRequestRecorder` are useful during development when you need to inspect the raw REST payloads sent to the Google API rather than the LangChain message abstraction.

### Key Interfaces

| Interface | Purpose |
|---|---|
| `ChatGoogleParams` | Constructor parameters (model ID, temperature, safety settings, etc.) |
| `ChatGoogleCallOptions` | Per-call overrides (tools, stop sequences, specialty tools) |
| `GoogleCustomEventInfo` | Shape of custom events emitted via `GoogleRequestCallbackHandler` |

### Implementation Notes

- Uses **direct REST calls** — does not depend on the `@google/genai` npm package
- Entrypoints: `@langchain/google` (default) and `@langchain/google/node` (Node.js-specific build)
- Both entrypoints export the same set of classes and interfaces
- Package depends on `@langchain/core`; pin all LangChain packages to the same `@langchain/core` version

### Adding New Entrypoints

To export a new file from the package, either re-export from `src/index.ts` or add the path to the `exports` field in `package.json`, then run `pnpm build`.

## Related

- [[google-provider]]
- [[chat-google-generative-ai]]
- [[langchain-models]]
- [[langchain-tools]]

## Sources

- `raw/references/google-gen-ai-reference.md` — package README: classes, interfaces, specialty tools, REST implementation detail, entrypoints
