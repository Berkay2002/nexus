---
created: 2026-04-13
updated: 2026-04-13
tags: [langchain, testing, vitest, integration]
sources: [raw/langchain/langchain/test/integration-testing.md]
---

# LangChain Integration Testing

Integration tests verify that an agent works correctly with real model APIs and external services. Unlike [[langchain-unit-testing]] which uses fakes and mocks, integration tests make actual network calls to confirm credentials are valid, components work together end-to-end, and latency is acceptable.

## Separate Unit and Integration Tests

Keep integration tests separate from unit tests. Integration tests are slower and require live API credentials — they should not run on every file save.

Use the file naming convention `*.int.test.ts` for all integration tests. Configure vitest to include or exclude them based on mode:

```ts
// vitest.config.ts
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig((env) => {
  if (env.mode === "int") {
    return {
      test: {
        testTimeout: 100_000,
        include: ["**/*.int.test.ts"],
        setupFiles: ["dotenv/config"],
      },
    };
  }

  return {
    test: {
      testTimeout: 30_000,
      exclude: ["**/*.int.test.ts", ...configDefaults.exclude],
    },
  };
});
```

> **Warning — mode detection is explicit.** The `env.mode === "int"` branch only activates when vitest is invoked with `--mode int`. The default run excludes `*.int.test.ts` files entirely. There is no auto-detection; you must use the scripts below.

Add `package.json` scripts:

```json
{
  "scripts": {
    "test": "vitest",
    "test:integration": "vitest --mode int"
  }
}
```

Run integration tests explicitly with `npm run test:integration`.

## Timeouts

The integration-mode config sets `testTimeout: 100_000` (100 seconds). This is intentionally much higher than the unit test default of 30 seconds — LLM API calls can be slow, especially under load. Omitting this causes flaky failures on slow responses.

## Manage API Keys

### dotenv in vitest

Add `dotenv/config` to `setupFiles` in the integration-mode config block. This instructs vitest to load `.env` before any test file runs.

> **Warning — Nexus-specific gotcha (from `CLAUDE.md`):** Vitest does NOT auto-load `.env` even with `setupFiles: ["dotenv/config"]` in some environments. For integration tests needing API keys in this project, source the file and export the variables explicitly before running:
>
> ```bash
> source .env && export OPENAI_API_KEY && npm run test:integration
> ```
>
> Relying solely on the vitest `dotenv/config` setup file has been observed to leave `process.env` variables undefined in `apps/agents` integration tests.

Add `.env` to `.gitignore` to prevent committing credentials. In CI, inject secrets through the provider's secrets manager (e.g., GitHub Actions secrets).

### Skip tests when keys are missing

Use `test.skipIf` to gracefully skip rather than hard-fail when a key is absent:

```ts
import { test } from "vitest";

test.skipIf(!process.env.OPENAI_API_KEY)(
  "agent responds with tool call",
  async () => {
    // ...
  }
);
```

## Assert on Structure, Not Content

LLM responses are nondeterministic — exact string assertions will be flaky. Instead, verify structural properties: message types, tool call names, argument shapes, and message count.

```ts
test("agent calls weather tool", async () => {
  const agent = createAgent({ model: "claude-sonnet-4-6", tools: [getWeather] });
  const result = await agent.invoke({
    messages: [new HumanMessage("What's the weather in SF?")]
  });

  const aiMsg = result.messages.find(
    (m) => AIMessage.isInstance(m) && m.tool_calls?.length
  );
  expect(aiMsg).toContainToolCall({ name: "get_weather" });
  expect(result.messages.at(-1)).toBeAIMessage();
});
```

## Custom Test Matchers

`@langchain/core` ships vitest matchers for readable structural assertions. Register them once in a setup file:

```ts
// vitest.setup.ts
import { langchainMatchers } from "@langchain/core/testing";
expect.extend(langchainMatchers);
```

Reference it in the vitest config under `setupFiles`. TypeScript types are included automatically — no extra config for autocomplete.

### Message type matchers

| Matcher | Checks |
|---|---|
| `toBeHumanMessage(expected?)` | Value is a `HumanMessage`. Optionally match content (string) or fields (object). |
| `toBeAIMessage(expected?)` | Value is an `AIMessage`. |
| `toBeSystemMessage(expected?)` | Value is a `SystemMessage`. |
| `toBeToolMessage(expected?)` | Value is a `ToolMessage`. Optionally match `tool_call_id` etc. |

### Tool call matchers (on AIMessage)

| Matcher | Checks |
|---|---|
| `toHaveToolCalls(expected)` | Exactly the given tool calls, order-independent. |
| `toHaveToolCallCount(n)` | Exactly `n` tool calls. |
| `toContainToolCall(expected)` | At least one matching tool call. Supports `.not`. |
| `toHaveToolMessages(expected)` | Message array contains given `ToolMessage` instances, in order. |

### Interrupt and structured response matchers

```ts
// LangGraph interrupt
expect(result).toHaveBeenInterrupted();
expect(result).toHaveBeenInterrupted("confirm_action");

// Structured response
expect(result).toHaveStructuredResponse();
expect(result).toHaveStructuredResponse({ name: "Alice", age: 30 });
```

## Reduce Cost and Latency

Integration tests call real APIs and incur real costs. Practices to keep suites affordable:

- **Use smaller models** — `gemini-flash-lite` or equivalent where only tool calling and response structure need verification, not quality.
- **Set `maxTokens`** — cap response length to avoid expensive completions.
- **Limit test scope** — one behavior per test; avoid chaining many LLM calls when a single-turn test suffices.
- **Run selectively** — use `npm run test:integration` only in CI or before deploy, not on every save.

```ts
const agent = createAgent({
  model: "gemini-3.1-flash-lite-preview",
  tools: [getWeather],
  modelArgs: { maxTokens: 256 },
});
```

## Related

- [[langchain-testing-overview]]
- [[langchain-unit-testing]]
- [[agent-evals]]
- [[langgraph-testing]]

## Sources

- `raw/langchain/langchain/test/integration-testing.md` — full source for vitest config, naming convention, dotenv setup, custom matchers, and cost-control patterns
- `CLAUDE.md` (Nexus project root) — Nexus-specific gotcha: vitest does not auto-load `.env`; must `source .env && export VAR_NAME` before running integration tests in `apps/agents`
