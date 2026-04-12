---
created: 2026-04-12
updated: 2026-04-12
tags: [deepagents, models, configurable-model, provider-agnostic, langchain]
sources: [raw/langchain/deepagents/models.md]
---

# initChatModel

`initChatModel` (TypeScript: `initChatModel`, Python: `init_chat_model`) is a LangChain universal factory that instantiates any supported chat model from a `provider:model` string. It is the resolution layer behind DeepAgents' model string support.

## Content

### Import and Basic Usage

```typescript
import { initChatModel } from "langchain/chat_models/universal";

// Returns a configured BaseChatModel instance
const model = await initChatModel("anthropic:claude-sonnet-4-6");

// With provider-specific parameters
const model = await initChatModel("anthropic:claude-sonnet-4-6", {
  maxTokens: 16000,
  thinking: { type: "enabled", budgetTokens: 10000 },
});
```

### String Format

The `provider:model-id` format is the canonical way to refer to a model across all LangChain-based tools:

- `"anthropic:claude-sonnet-4-6"` → [[chat-anthropic]] with `claude-sonnet-4-6`
- `"openai:gpt-4.1"` → [[chat-openai]] with `gpt-4.1`
- `"google-genai:gemini-3-flash-preview"` → [[chat-google-generative-ai]] with the Gemini model
- `"openai:gpt-4.1"` via a custom base URL → works for OpenAI-compatible endpoints (e.g., Z.AI's GLM)

For valid provider strings, see the `model_provider` parameter in the `initChatModel` reference docs.

### Role in DeepAgents

[[create-deep-agent]] accepts a model string and resolves it through `initChatModel` internally. The same factory is used inside the [[deepagents-models|configurable-model middleware]] pattern to swap models at runtime:

```typescript
const configurableModel = createMiddleware({
  name: "ConfigurableModel",
  wrapModelCall: async (request, handler) => {
    const model = await initChatModel(request.runtime.context.model);
    return handler({ ...request, model });
  },
});
```

### Extra kwargs Forwarding

Additional options passed to `initChatModel` are forwarded to the underlying provider constructor. This means you can set `maxTokens`, `temperature`, extended thinking budgets, or any provider-specific flag without importing the provider package directly — useful in provider-agnostic code that selects a model at runtime.

### Nexus Usage

Nexus does not call `initChatModel` directly. Instead, the `models/registry.ts` tier registry instantiates provider-specific classes (`ChatGoogleGenerativeAI`, `ChatAnthropic`, `ChatOpenAI`, `ZaiChatOpenAI`) based on available environment variables. The configurable-model middleware in `middleware/configurable-model.ts` then allows per-invocation overrides via `context.models`, following the same pattern documented here.

## Related

- [[deepagents-models]]
- [[create-deep-agent]]
- [[config-runtime-context]]
- [[langchain-models]]

## Sources

- `raw/langchain/deepagents/models.md` — provider:model string format, initChatModel signature, extra kwargs forwarding, middleware pattern usage
