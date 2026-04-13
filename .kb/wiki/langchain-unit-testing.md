---
created: 2026-04-13
updated: 2026-04-13
tags: [langchain, testing, vitest, langchain-core]
sources: [raw/langchain/langchain/test/unit-testing.md]
---

# LangChain Unit Testing

Unit tests for LangChain agents exercise small, deterministic pieces of agent logic in isolation. By replacing the real LLM with [[fake-model]] — an in-memory fixture — tests run fast, cost nothing, and require no API keys.

## When to unit-test vs. integration-test

Unit tests are the right tool when you want to verify:

- **Agent routing logic** — does the agent call the correct tool given a scripted model response?
- **Retry / error handling** — does the agent recover correctly when the model throws?
- **Message assembly** — are the right messages being sent to the model?
- **Tool call parsing** — does the application correctly handle an `AIMessage` with `tool_calls`?

For tests that must verify real model behavior (prompt quality, structured-output parsing against a live schema), see [[langchain-integration-testing]].

## Test structure

The minimal pattern is:

1. Create a [[fake-model]] with queued responses.
2. Pass the model into the agent or chain under test.
3. Invoke the agent.
4. Assert on the output and, optionally, on what the model received (`model.calls`).

```typescript
import { describe, test, expect } from "vitest";
import { fakeModel } from "langchain";
import { AIMessage, HumanMessage } from "@langchain/core/messages";

describe("my agent", () => {
  test("returns expected text", async () => {
    const model = fakeModel()
      .respond(new AIMessage("Hello!"));

    const result = await model.invoke([new HumanMessage("Hi")]);
    expect(result.content).toBe("Hello!");
  });
});
```

## Testing tool-calling agents

Script the agentic loop by queuing a tool-call response first, then a text response. The [[fake-model]] handles `bindTools()` transparently — the bound model shares the same queue and call recording.

```typescript
import { fakeModel } from "langchain";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const getWeather = tool(
  async ({ city }) => `72°F and sunny in ${city}`,
  {
    name: "get_weather",
    description: "Get weather for a city",
    schema: z.object({ city: z.string() }),
  }
);

const model = fakeModel()
  .respondWithTools([{ name: "get_weather", args: { city: "SF" }, id: "call_1" }])
  .respond(new AIMessage("It's 72°F and sunny in SF!"));

const bound = model.bindTools([getWeather]);

// Drive the agent loop manually in the test
const messages: any[] = [new HumanMessage("Weather in SF?")];
const r1 = await bound.invoke(messages);
messages.push(r1);

for (const tc of r1.tool_calls!) {
  const result = await getWeather.invoke(tc.args);
  messages.push(new ToolMessage({ content: result as string, tool_call_id: tc.id! }));
}

const r2 = await bound.invoke(messages);
expect(r2.content).toBe("It's 72°F and sunny in SF!");
expect(model.callCount).toBe(2);
```

## In-memory persistence

For agents that read or write memory, use an in-memory store (e.g., LangGraph's `MemorySaver` or a local `Map`) instead of a real database. This keeps tests hermetic and removes the need to clean up state between runs.

## Asserting model inputs

[[fake-model]] records every invocation. After running the agent, inspect `model.calls` to verify the model received the correct messages, system prompts, or tool definitions:

```typescript
// After invoking the agent...
expect(model.callCount).toBe(2);
expect(model.calls[0].messages[0].content).toBe("Weather in SF?");
```

This replaces the need for a separate spy/mock library for the model layer.

## Counter-intuitive behaviors

> **Warning:** If your agent invokes the model more times than you queued responses, `fakeModel` throws immediately with a message like `"no response queued for invocation N"`. Queue one response per expected model call — missing responses surface as test failures, not silent hangs.

> **Warning:** Each `respond()` entry (including factory functions) is a single-use queue entry. To reuse the same dynamic logic for multiple turns, call `.respond(fn)` multiple times.

> **Warning:** `.structuredResponse()` ignores the Zod schema passed to `.withStructuredOutput()`. The fake always returns the configured value. Tests that rely on schema validation logic must use [[langchain-integration-testing]] instead.

## Vitest setup

No special setup is required. `fakeModel` is a plain TypeScript class with no side effects. Import from `"langchain"`:

```typescript
import { fakeModel } from "langchain";
```

Vitest does not auto-load `.env`. Unit tests using `fakeModel` do not need any environment variables because no real API is called.

## Related

- [[fake-model]] — full API reference for the fakeModel fixture
- [[langchain-integration-testing]] — tests against real model provider APIs
- [[langchain-testing-overview]] — choosing between unit and integration testing
- [[langgraph-testing]] — testing LangGraph graphs specifically
- [[langchain-tools]] — how LangChain tools are defined for use in agent tests

## Sources

- `raw/langchain/langchain/test/unit-testing.md` — primary source; all fakeModel API details
