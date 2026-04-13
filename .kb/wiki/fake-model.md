---
created: 2026-04-13
updated: 2026-04-13
tags: [langchain, testing, vitest, langchain-core]
sources: [raw/langchain/langchain/test/unit-testing.md]
---

# fakeModel

`fakeModel` is a builder-style fake chat model exported from `"langchain"`. It extends `BaseChatModel`, so it is a drop-in replacement for any real model in tests. Instead of calling an LLM API, it returns pre-scripted responses in queue order and records every invocation for later assertion.

Used as the primary fixture in [[langchain-unit-testing]].

## Import

```typescript
import { fakeModel } from "langchain";
```

## Core concept: response queue

`fakeModel` maintains an ordered queue of responses. Each call to `model.invoke()` dequeues and returns the next entry. The queue is built up with method chaining before the first invocation.

> **Warning:** If `invoke()` is called more times than there are queued responses, `fakeModel` throws immediately: `"no response queued for invocation N"`. Always queue exactly one entry per expected model call — or use `.alwaysThrow()` for error-only scenarios.

## Methods

### `.respond(response)`

Enqueues a single response. Returns `this` for chaining.

**Accepted types:**

| Value | Effect on invoke() |
|---|---|
| `AIMessage` | Returns the message |
| `Error` instance | Throws the error |
| Factory function `(messages) => BaseMessage \| Error` | Calls the function with the input messages; returns or throws based on the result |

```typescript
const model = fakeModel()
  .respond(new AIMessage("first"))
  .respond(new Error("rate limit"))
  .respond((msgs) => new AIMessage(`echo: ${msgs.at(-1)!.text}`));
```

> **Warning:** Factory functions are single-use queue entries. Queue the same function multiple times if you need it applied across multiple turns.

### `.respondWithTools(toolCalls)`

Shorthand for queueing an `AIMessage` with `tool_calls`. The `id` field is optional — a unique ID is auto-generated if omitted.

```typescript
model.respondWithTools([
  { name: "get_weather", args: { city: "SF" }, id: "call_1" },
]);

// Equivalent to:
model.respond(new AIMessage({
  content: "",
  tool_calls: [
    { name: "get_weather", args: { city: "SF" }, id: "call_1", type: "tool_call" },
  ],
}));
```

`.respond()` and `.respondWithTools()` can be mixed freely in any order, which is useful when scripting an agentic loop that alternates between tool calls and text responses.

### `.alwaysThrow(error)`

Makes every `invoke()` call throw the given error, regardless of any queued responses. Useful for testing retry logic and error-handling paths.

```typescript
const model = fakeModel().alwaysThrow(new Error("service unavailable"));

await model.invoke([...]); // throws
await model.invoke([...]); // throws again
```

### `.structuredResponse(value)`

Configures the return value for code that calls `.withStructuredOutput()`. The Zod schema argument to `.withStructuredOutput()` is ignored — the model always returns the configured value.

```typescript
const model = fakeModel()
  .structuredResponse({ temperature: 72, unit: "fahrenheit" });

const structured = model.withStructuredOutput(z.object({
  temperature: z.number(),
  unit: z.string(),
}));

const result = await structured.invoke([new HumanMessage("Weather?")]);
// result === { temperature: 72, unit: "fahrenheit" }
```

> **Warning:** Schema validation is not performed. Tests that need to verify the model correctly serializes/deserializes a structured output schema must use real providers via [[langchain-integration-testing]].

## Call recording

`fakeModel` records every invocation — including ones that throw — as a spy. No extra mock library needed.

| Property | Type | Description |
|---|---|---|
| `model.callCount` | `number` | Total number of times `invoke()` was called |
| `model.calls` | `Array` | Array of call records, one per invocation |
| `model.calls[n].messages` | `BaseMessage[]` | The messages passed to the n-th call |

```typescript
await model.invoke([new HumanMessage("q1")]);
await model.invoke([new HumanMessage("q2")]);

model.callCount; // 2
model.calls[0].messages[0].content; // "q1"
model.calls[1].messages[0].content; // "q2"
```

Calls are recorded even when the model throws:

```typescript
const model = fakeModel().respond(new Error("boom"));

try {
  await model.invoke([new HumanMessage("will fail")]);
} catch {}

model.callCount;               // 1
model.calls[0].messages[0].content; // "will fail"
```

## `bindTools()` behavior

Agent frameworks and [[langgraph-testing]] graphs call `model.bindTools(tools)` internally. `fakeModel` handles this transparently. The bound model shares the same response queue and `calls` recording as the original:

```typescript
const model = fakeModel()
  .respondWithTools([{ name: "search", args: { query: "weather" }, id: "1" }])
  .respond(new AIMessage("The weather is sunny."));

const bound = model.bindTools([searchTool]);

await bound.invoke([new HumanMessage("weather?")]);
await bound.invoke([new HumanMessage("thanks")]);

model.callCount; // 2  — inspect via the original, not `bound`
```

> **Warning:** After calling `bindTools()`, inspect call recording on the **original** model reference (`model.calls`), not on the `bound` return value.

## Full example (Vitest)

```typescript
import { describe, test, expect } from "vitest";
import { fakeModel } from "langchain";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const getWeather = tool(
  async ({ city }) => `72°F and sunny in ${city}`,
  { name: "get_weather", description: "Get weather", schema: z.object({ city: z.string() }) }
);

describe("weather agent", () => {
  test("calls get_weather and returns final answer", async () => {
    const model = fakeModel()
      .respondWithTools([{ name: "get_weather", args: { city: "SF" }, id: "call_1" }])
      .respond(new AIMessage("It's 72°F and sunny in SF!"));

    const bound = model.bindTools([getWeather]);
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
  });

  test("handles model errors", async () => {
    const model = fakeModel().respond(new Error("rate limit"));
    await expect(model.invoke([new HumanMessage("hi")])).rejects.toThrow("rate limit");
    expect(model.callCount).toBe(1);
  });
});
```

## Related

- [[langchain-unit-testing]] — how and when to use fakeModel in agent tests
- [[langchain-integration-testing]] — for tests that need real model behavior
- [[bind-tools]] — how tools are bound to chat models in LangChain
- [[with-structured-output]] — the real structured output API that .structuredResponse() stubs
- [[langchain-testing-overview]] — testing strategy overview

## Sources

- `raw/langchain/langchain/test/unit-testing.md` — complete fakeModel API and examples
