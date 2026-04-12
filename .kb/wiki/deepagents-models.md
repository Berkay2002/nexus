---
created: 2026-04-12
updated: 2026-04-12
tags: [deepagents, models, configurable-model, provider-agnostic, tier-routing]
sources: [raw/langchain/deepagents/models.md]
---

# DeepAgents Model Configuration

DeepAgents accepts any [[langchain-models|LangChain chat model]] that supports tool calling. Models can be supplied as a `provider:model` string, a pre-configured instance, or swapped at runtime via middleware.

## Content

### Passing a Model to createDeepAgent

[[create-deep-agent]] accepts a `model` parameter that can be:

- A `provider:model` string (e.g., `"anthropic:claude-sonnet-4-6"`, `"openai:gpt-4.1"`) — resolved internally via [[init-chat-model]]
- A configured chat model instance (e.g., `new ChatAnthropic({ ... })` from [[chat-anthropic]])

Using a string is the shortest path. Passing an instance is necessary when you need provider-specific parameters (e.g., extended thinking `budgetTokens`, `maxTokens`).

### Configuring Model Parameters

Two approaches:

**Via `initChatModel`** — provider-agnostic factory; supports extra kwargs forwarded to the underlying provider:

```typescript
import { initChatModel } from "langchain/chat_models/universal";

const model = await initChatModel("anthropic:claude-sonnet-4-6", {
  maxTokens: 16000,
  thinking: { type: "enabled", budgetTokens: 10000 },
});
const agent = createDeepAgent({ model });
```

**Via provider class** — direct instantiation with full type safety:

```typescript
import { ChatAnthropic } from "@langchain/anthropic";

const model = new ChatAnthropic({
  model: "claude-sonnet-4-6",
  maxTokens: 16000,
  thinking: { type: "enabled", budgetTokens: 10000 },
});
const agent = createDeepAgent({ model });
```

### Suggested Models

Models validated on the DeepAgents eval suite (necessary but not sufficient for complex tasks):

| Provider | Recommended Models |
|---|---|
| Anthropic | `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5` |
| OpenAI | `gpt-5.4`, `gpt-4o`, `gpt-4.1`, `o4-mini`, `o3` |
| Google | `gemini-3-flash-preview`, `gemini-3.1-pro-preview` |
| Open-weight | `GLM-5`, `Kimi-K2.5`, `qwen3.5-397B-A17B` via OpenRouter/Fireworks/Ollama |

### Runtime Model Selection (Configurable Model Pattern)

To let users or callers pick a model at runtime without rebuilding the agent, use LangChain middleware. This is the pattern Nexus implements as `createConfigurableModelMiddleware`:

```typescript
import { initChatModel, createMiddleware } from "langchain";
import * as z from "zod";

const contextSchema = z.object({ model: z.string() });

const configurableModel = createMiddleware({
  name: "ConfigurableModel",
  wrapModelCall: async (request, handler) => {
    const modelName = request.runtime.context.model;
    const model = await initChatModel(modelName);
    return handler({ ...request, model });
  },
});

const agent = await createDeepAgent({
  model: "anthropic:claude-sonnet-4-6", // default fallback
  middleware: [configurableModel],
  contextSchema,
});

// Override per invocation:
await agent.invoke(messages, { context: { model: "openai:gpt-4.1" } });
```

The default model passed to `createDeepAgent` acts as a fallback when no `context.model` is provided. The middleware intercepts every model call and resolves the active model from `request.runtime.context`.

### Per-Subagent Model Overrides

Each [[subagent-interface|SubAgent]] can carry its own model or inherit from the orchestrator. Because each subagent is constructed independently, you pass a different model string or instance to each `SubAgent` definition. Nexus uses this to assign tier-appropriate models: `deep-research` tier for the research subagent, `code` tier for the code subagent.

### Provider-Agnostic Pattern

The `provider:model` string format decouples code from provider SDKs — the same string can be swapped across deployments by changing config rather than code. Combined with the configurable-model middleware, you get a fully provider-agnostic pipeline: default model is set at agent construction, per-call override comes in through `context`, and [[init-chat-model]] handles instantiation in both cases.

## Related

- [[init-chat-model]]
- [[create-deep-agent]]
- [[subagent-interface]]
- [[config-runtime-context]]
- [[dynamic-runtime-context]]

## Sources

- `raw/langchain/deepagents/models.md` — provider:model string format, initChatModel usage, configurable-model middleware pattern, suggested models table
