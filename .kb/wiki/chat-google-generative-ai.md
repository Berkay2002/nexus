---
created: 2026-04-12
updated: 2026-04-12
tags: [google, gemini, chat-model, langchain, tool-call, image-generation]
sources: [raw/langchain/providers/google/google-chat.md]
---

# ChatGoogle (ChatGoogleGenerativeAI)

`ChatGoogle` from [[google-provider]] (`@langchain/google`) is the unified LangChain [[chat-model-interface]] for Google's Gemini family. It replaces the older `@langchain/google-genai` and `@langchain/google-vertexai` packages and routes to either Google AI Studio or Vertex AI based on which credentials are present.

## Content

### Authentication

Authentication is resolved automatically at construction time:

- **API key** (`GOOGLE_API_KEY` env var or `apiKey` constructor param) → Google AI Studio (default)
- **`GOOGLE_APPLICATION_CREDENTIALS` / `GOOGLE_CLOUD_CREDENTIALS`** in Node.js → Vertex AI via OAuth ADC
- **`platformType: "gcp"` + API key** → Vertex AI Express Mode

### Constructor Parameters

| Parameter | Description |
|---|---|
| `model` | Gemini model ID (e.g. `"gemini-2.5-flash"`, `"gemini-2.5-pro"`) |
| `apiKey` | Google AI Studio API key; falls back to `GOOGLE_API_KEY` |
| `platformType` | `"gcp"` to force Vertex AI; defaults to auto-detect |
| `credentials` | Explicit service account credentials object (Vertex AI) |
| `temperature` | Sampling temperature — leave at default per Google best practice |
| `topP` / `topK` | Nucleus sampling; leave at default unless explicitly needed |
| `maxOutputTokens` | Cap on generated tokens |
| `safetySettings` | Array of `{ category, threshold }` objects (off by default in current Gemini) |
| `logprobs` | Number of top logprob candidates to return per token |
| `responseModalities` | Array of `"TEXT"`, `"IMAGE"`, `"AUDIO"` — required for image/audio generation |
| `speechConfig` | Voice name string or multi-speaker array for TTS output |
| `reasoningEffort` | `"minimal"` \| `"low"` \| `"medium"` \| `"high"` (alias `thinkingLevel`) |
| `maxReasoningTokens` | Token budget for thinking steps (alias `thinkingBudget`); `0` disables, `-1` uses model default |

### Supported Model IDs (Nexus-relevant)

| Model | Nexus tier |
|---|---|
| `gemini-2.5-flash` | `classifier` (meta-router Flash classifier) |
| `gemini-2.5-pro` | `deep-research` |
| `gemini-2.5-flash-image` / `gemini-2.5-flash-image-preview` | `image` tier (image generation) |
| `gemini-2.5-flash-preview-tts` | Speech/TTS (not a Nexus tier, informational) |

> The Nexus model registry (`apps/agents/src/nexus/models/registry.ts`) uses these IDs. Google is the **only** provider for the `image` tier.

### Tool Calling

Attach standard [[langchain-tools]] via `llm.bindTools([...])` (see [[bind-tools]]). Tool calls are returned in `aiMsg.tool_calls`.

**Gemini Specialty Tools** (cannot be mixed with standard tools in the same request):

- `{ codeExecution: {} }` — model generates and executes Python
- `{ googleSearch: {} }` — grounding with Google Search (preferred over legacy `googleSearchRetrieval`)
- `{ urlContext: {} }` — grounding via a specific URL
- `{ retrieval: { vertexAiSearch: { datastore: "..." } } }` — Vertex AI Search grounding (Vertex AI only)

### Structured Output

Use `llm.withStructuredOutput(zodSchema)` to receive typed JSON conforming to a Zod schema.

### Image Generation

Set `model: "gemini-2.5-flash-image"` and `responseModalities: ["IMAGE", "TEXT"]`. Generated images are returned as `file` blocks in `res.contentBlocks`:

```typescript
for (const block of res.contentBlocks) {
  if (block.type === "file" && block.data) {
    // block.data is base64; block.mimeType gives format
  }
}
```

This is how Nexus's `generate_image` tool works — it calls `ChatGoogle` on the `image` tier with these modality settings.

### Reasoning / Thinking

Gemini 2.5+ models can produce chain-of-thought blocks. Configure with `reasoningEffort` or `maxReasoningTokens`. Thought blocks appear in `res.contentBlocks` with `type: "reasoning"`.

### Multimodal Input

Pass `contentBlocks` inside [[langchain-messages]] to send images, audio, or video:

```typescript
new HumanMessage({
  contentBlocks: [
    { type: "text", text: "What is in this image?" },
    { type: "image", mimeType: "image/jpeg", data: base64String },
  ],
})
```

### Context Caching

Gemini performs implicit context caching automatically. Explicit caches created outside LangChain can be referenced via `{ cachedContent: "projects/.../cachedContents/..." }` as an invoke option.

### Safety Settings

```typescript
safetySettings: [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_LOW_AND_ABOVE" }
]
```

Default in current Gemini versions: safety settings are **off**.

### Import Path

```typescript
// Node.js (recommended)
import { ChatGoogle } from "@langchain/google/node";

// Web / Edge
import { ChatGoogle } from "@langchain/google";
```

## Related

- [[google-provider]]
- [[langchain-google-api-reference]] — complete `@langchain/google` API surface (constructors, methods, config shapes)
- [[langchain-models]]
- [[chat-model-interface]]
- [[bind-tools]]
- [[langchain-messages]]

## Sources

- `raw/langchain/providers/google/google-chat.md` — full `ChatGoogle` class reference: constructor params, authentication, tool calling, multimodal, image generation, TTS, reasoning, context caching, safety settings
