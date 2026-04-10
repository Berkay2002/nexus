# Z.AI Reasoning Preservation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-enable GLM thinking on the Z.AI provider by round-tripping `reasoning_content` verbatim on every outbound request, via a thin `ChatOpenAI` subclass used only by the `zai` factory.

**Architecture:** LangChain's `@langchain/openai` already captures `reasoning_content` on the inbound path (streaming + non-streaming) into `AIMessage.additional_kwargs.reasoning_content`. The bug is outbound only: `convertMessagesToCompletionsMessageParams` drops it when serializing messages for the next request. We fix this with a `ZaiChatOpenAI extends ChatOpenAI` subclass that overrides `_generate`, `_streamResponseChunks`, and `completionWithRetry`. The two entry methods set an `AsyncLocalStorage`-scoped reasoning array (built from input LC messages); `completionWithRetry` reads that context and mutates outbound `request.messages` in place to re-attach `reasoning_content` on assistant params. Z.AI-only, safe no-op fallback when context is missing or counts mismatch.

**Tech Stack:** TypeScript, LangChain (`@langchain/openai`, `@langchain/core`), Node 22 `AsyncLocalStorage`, Vitest.

**Spec:** `docs/superpowers/specs/2026-04-10-zai-reasoning-preservation-design.md`

---

## File Structure

**Create:**
- `apps/agents/src/nexus/models/zai-chat-model.ts` — `ZaiChatOpenAI` subclass, `buildReasoningMap`, `injectReasoningContent`, module-scoped `AsyncLocalStorage`
- `apps/agents/src/nexus/models/__tests__/zai-chat-model.test.ts` — unit tests (no API key)
- `apps/agents/src/nexus/models/__tests__/zai-chat-model.integration.test.ts` — gated integration test (real z.ai key)

**Modify:**
- `apps/agents/src/nexus/models/providers.ts` — `zai` factory uses `ZaiChatOpenAI`, drop `ZAI_DISABLE_THINKING`
- `CLAUDE.md` — replace the z.ai thinking gotcha paragraph

**Delete (after merge, separate step):**
- Memory note `project_zai_thinking_middleware.md` — resolved

---

### Task 1: Scaffold `ZaiChatOpenAI` with `buildReasoningMap`

**Files:**
- Create: `apps/agents/src/nexus/models/zai-chat-model.ts`
- Test: `apps/agents/src/nexus/models/__tests__/zai-chat-model.test.ts`

- [ ] **Step 1: Write failing tests for `buildReasoningMap`**

Create `apps/agents/src/nexus/models/__tests__/zai-chat-model.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { buildReasoningMap } from "../zai-chat-model.js";

describe("buildReasoningMap", () => {
  it("returns empty array when no AIMessages present", () => {
    const map = buildReasoningMap([
      new SystemMessage("sys"),
      new HumanMessage("hi"),
    ]);
    expect(map).toEqual([]);
  });

  it("captures reasoning_content from AIMessages in order", () => {
    const ai1 = new AIMessage({
      content: "first answer",
      additional_kwargs: { reasoning_content: "thinking one" },
    });
    const ai2 = new AIMessage({
      content: "second answer",
      additional_kwargs: {},
    });
    const map = buildReasoningMap([
      new SystemMessage("sys"),
      new HumanMessage("q1"),
      ai1,
      new ToolMessage({ content: "tool-result", tool_call_id: "t1" }),
      ai2,
      new HumanMessage("q2"),
    ]);
    expect(map).toEqual(["thinking one", null]);
  });

  it("treats non-string reasoning_content as null", () => {
    const ai = new AIMessage({
      content: "x",
      additional_kwargs: { reasoning_content: 42 as unknown as string },
    });
    expect(buildReasoningMap([ai])).toEqual([null]);
  });

  it("treats empty reasoning_content as null", () => {
    const ai = new AIMessage({
      content: "x",
      additional_kwargs: { reasoning_content: "" },
    });
    expect(buildReasoningMap([ai])).toEqual([null]);
  });

  it("handles AIMessageChunk the same as AIMessage", () => {
    const chunk = new AIMessageChunk({
      content: "x",
      additional_kwargs: { reasoning_content: "chunk reasoning" },
    });
    expect(buildReasoningMap([chunk])).toEqual(["chunk reasoning"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/agents && npx vitest run src/nexus/models/__tests__/zai-chat-model.test.ts`
Expected: FAIL — module `../zai-chat-model.js` not found.

- [ ] **Step 3: Create `zai-chat-model.ts` with `buildReasoningMap`**

Create `apps/agents/src/nexus/models/zai-chat-model.ts`:

```ts
import { AsyncLocalStorage } from "node:async_hooks";
import type { BaseMessage } from "@langchain/core/messages";
import { AIMessage, AIMessageChunk } from "@langchain/core/messages";
import { ChatOpenAI, type ChatOpenAIFields } from "@langchain/openai";

/**
 * Per-call scope for the reasoning_content array built from LC messages on
 * the way in. Populated by _generate/_streamResponseChunks, consumed by
 * completionWithRetry right before the HTTP call.
 */
const reasoningCtx = new AsyncLocalStorage<(string | null)[]>();

/**
 * Walk LC input messages in order. For every AIMessage (or AIMessageChunk),
 * push its reasoning_content string, or null if missing/invalid. The Nth
 * entry in the returned array corresponds to the Nth assistant-role param
 * in the outbound OpenAI request (LC's converter is order-preserving and
 * we don't use the audio-splitting path on z.ai).
 */
export function buildReasoningMap(messages: BaseMessage[]): (string | null)[] {
  const map: (string | null)[] = [];
  for (const msg of messages) {
    if (!(msg instanceof AIMessage || msg instanceof AIMessageChunk)) continue;
    const raw = msg.additional_kwargs?.reasoning_content;
    if (typeof raw === "string" && raw.length > 0) {
      map.push(raw);
    } else {
      map.push(null);
    }
  }
  return map;
}

export class ZaiChatOpenAI extends ChatOpenAI {
  constructor(fields?: ChatOpenAIFields) {
    super(fields);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/agents && npx vitest run src/nexus/models/__tests__/zai-chat-model.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/agents/src/nexus/models/zai-chat-model.ts apps/agents/src/nexus/models/__tests__/zai-chat-model.test.ts
git commit -m "feat(models/zai): scaffold ZaiChatOpenAI with buildReasoningMap"
```

---

### Task 2: `injectReasoningContent` with count-mismatch safety

**Files:**
- Modify: `apps/agents/src/nexus/models/zai-chat-model.ts`
- Test: `apps/agents/src/nexus/models/__tests__/zai-chat-model.test.ts`

- [ ] **Step 1: Add failing tests for `injectReasoningContent`**

Append to `apps/agents/src/nexus/models/__tests__/zai-chat-model.test.ts`:

```ts
import { injectReasoningContent } from "../zai-chat-model.js";
import { vi } from "vitest";

describe("injectReasoningContent", () => {
  it("sets reasoning_content on assistant messages in order", () => {
    const request = {
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "q1" },
        { role: "assistant", content: "a1" },
        { role: "tool", tool_call_id: "t1", content: "r" },
        { role: "assistant", content: "a2" },
      ],
    };
    injectReasoningContent(request, ["thinking-1", "thinking-2"]);
    expect(request.messages[2]).toMatchObject({
      role: "assistant",
      reasoning_content: "thinking-1",
    });
    expect(request.messages[4]).toMatchObject({
      role: "assistant",
      reasoning_content: "thinking-2",
    });
    expect(request.messages[0]).not.toHaveProperty("reasoning_content");
    expect(request.messages[1]).not.toHaveProperty("reasoning_content");
    expect(request.messages[3]).not.toHaveProperty("reasoning_content");
  });

  it("skips null entries without mutating that assistant", () => {
    const request = {
      messages: [
        { role: "assistant", content: "a1" },
        { role: "assistant", content: "a2" },
      ],
    };
    injectReasoningContent(request, [null, "thinking-2"]);
    expect(request.messages[0]).not.toHaveProperty("reasoning_content");
    expect(request.messages[1]).toMatchObject({
      reasoning_content: "thinking-2",
    });
  });

  it("warns and leaves request untouched on count mismatch", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const request = {
      messages: [
        { role: "assistant", content: "a1" },
      ],
    };
    injectReasoningContent(request, ["one", "two"]);
    expect(request.messages[0]).not.toHaveProperty("reasoning_content");
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toMatch(/\[ZaiChatOpenAI\]/);
    warn.mockRestore();
  });

  it("is a no-op when map is empty and no assistants present", () => {
    const request = { messages: [{ role: "user", content: "q" }] };
    injectReasoningContent(request, []);
    expect(request.messages[0]).toEqual({ role: "user", content: "q" });
  });

  it("handles missing request.messages gracefully", () => {
    const request: { messages?: unknown[] } = {};
    expect(() => injectReasoningContent(request, ["x"])).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/agents && npx vitest run src/nexus/models/__tests__/zai-chat-model.test.ts`
Expected: FAIL — `injectReasoningContent` not exported.

- [ ] **Step 3: Implement `injectReasoningContent`**

Add to `apps/agents/src/nexus/models/zai-chat-model.ts` (between `buildReasoningMap` and the class):

```ts
interface RequestLike {
  messages?: unknown;
}

/**
 * Mutate `request.messages` in place, setting `reasoning_content` on assistant
 * params in the order they appear. If the assistant count in the request does
 * not match the reasoning map length, log a warning and leave the request
 * untouched — safer than corrupting it.
 */
export function injectReasoningContent(
  request: RequestLike,
  map: (string | null)[],
): void {
  const messages = request.messages;
  if (!Array.isArray(messages)) return;

  const assistantIndices: number[] = [];
  for (let i = 0; i < messages.length; i++) {
    const entry = messages[i];
    if (
      entry &&
      typeof entry === "object" &&
      (entry as { role?: unknown }).role === "assistant"
    ) {
      assistantIndices.push(i);
    }
  }

  if (assistantIndices.length !== map.length) {
    if (map.length > 0) {
      console.warn(
        `[ZaiChatOpenAI] reasoning map/message count mismatch (map=${map.length}, assistants=${assistantIndices.length}); skipping injection`,
      );
    }
    return;
  }

  for (let i = 0; i < assistantIndices.length; i++) {
    const value = map[i];
    if (typeof value !== "string" || value.length === 0) continue;
    const entry = messages[assistantIndices[i]] as Record<string, unknown>;
    entry.reasoning_content = value;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/agents && npx vitest run src/nexus/models/__tests__/zai-chat-model.test.ts`
Expected: PASS (all 10 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/agents/src/nexus/models/zai-chat-model.ts apps/agents/src/nexus/models/__tests__/zai-chat-model.test.ts
git commit -m "feat(models/zai): add injectReasoningContent with mismatch safety"
```

---

### Task 3: Wire overrides for `completionWithRetry` and entry methods

**Files:**
- Modify: `apps/agents/src/nexus/models/zai-chat-model.ts`
- Test: `apps/agents/src/nexus/models/__tests__/zai-chat-model.test.ts`

- [ ] **Step 1: Add failing test for end-to-end override behavior**

Append to the test file:

```ts
import { HumanMessage as HM } from "@langchain/core/messages";
import { ZaiChatOpenAI } from "../zai-chat-model.js";

describe("ZaiChatOpenAI overrides", () => {
  function makeStub() {
    const received: unknown[] = [];
    const model = new ZaiChatOpenAI({
      model: "glm-4.7",
      apiKey: "test-key",
      configuration: { baseURL: "https://example.invalid" },
    });
    // Stub super.completionWithRetry by replacing the method on the prototype
    // chain via Object.getPrototypeOf(Object.getPrototypeOf(model)).
    const superProto = Object.getPrototypeOf(Object.getPrototypeOf(model));
    const original = superProto.completionWithRetry;
    superProto.completionWithRetry = async function (req: unknown) {
      received.push(req);
      return {
        id: "stub",
        model: "glm-4.7",
        choices: [
          { index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      };
    };
    const restore = () => {
      superProto.completionWithRetry = original;
    };
    return { model, received, restore };
  }

  it("injects reasoning_content on outbound assistant messages via _generate", async () => {
    const { model, received, restore } = makeStub();
    try {
      const priorAI = new AIMessage({
        content: "prior answer",
        additional_kwargs: { reasoning_content: "prior thinking" },
      });
      await model.invoke([
        new SystemMessage("sys"),
        new HM("q1"),
        priorAI,
        new HM("q2"),
      ]);
      expect(received).toHaveLength(1);
      const req = received[0] as { messages: Array<{ role: string; reasoning_content?: string }> };
      const assistants = req.messages.filter((m) => m.role === "assistant");
      expect(assistants).toHaveLength(1);
      expect(assistants[0].reasoning_content).toBe("prior thinking");
    } finally {
      restore();
    }
  });

  it("isolates reasoning context between concurrent calls", async () => {
    const { model, received, restore } = makeStub();
    try {
      const ai = (text: string) =>
        new AIMessage({
          content: "prior",
          additional_kwargs: { reasoning_content: text },
        });
      await Promise.all([
        model.invoke([new HM("a"), ai("alpha"), new HM("a2")]),
        model.invoke([new HM("b"), ai("beta"), new HM("b2")]),
      ]);
      const reasonings = (received as Array<{ messages: Array<{ role: string; reasoning_content?: string }> }>)
        .map((r) => r.messages.find((m) => m.role === "assistant")?.reasoning_content)
        .sort();
      expect(reasonings).toEqual(["alpha", "beta"]);
    } finally {
      restore();
    }
  });

  it("falls through when completionWithRetry is called without context", async () => {
    const { model, received, restore } = makeStub();
    try {
      const req = {
        messages: [{ role: "assistant", content: "a" }],
      };
      // @ts-expect-error - calling protected method directly for test
      await model.completionWithRetry(req, {});
      expect(received).toHaveLength(1);
      const sent = received[0] as { messages: Array<Record<string, unknown>> };
      expect(sent.messages[0]).not.toHaveProperty("reasoning_content");
    } finally {
      restore();
    }
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `cd apps/agents && npx vitest run src/nexus/models/__tests__/zai-chat-model.test.ts`
Expected: the 3 new tests FAIL (overrides not yet implemented — `reasoning_content` not present on outbound).

- [ ] **Step 3: Add the overrides**

Replace the `ZaiChatOpenAI` class body in `apps/agents/src/nexus/models/zai-chat-model.ts`:

```ts
export class ZaiChatOpenAI extends ChatOpenAI {
  constructor(fields?: ChatOpenAIFields) {
    super(fields);
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: Parameters<ChatOpenAI["_generate"]>[2],
  ): ReturnType<ChatOpenAI["_generate"]> {
    const map = buildReasoningMap(messages);
    return reasoningCtx.run(map, () =>
      super._generate(messages, options, runManager),
    );
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: Parameters<ChatOpenAI["_streamResponseChunks"]>[2],
  ): AsyncGenerator<
    Awaited<ReturnType<AsyncGenerator<unknown>["next"]>>["value"]
  > {
    const map = buildReasoningMap(messages);
    // AsyncLocalStorage.run propagates through async generators on Node 18+
    // because the generator resumes on the same async context as its caller.
    const gen = reasoningCtx.run(map, () =>
      super._streamResponseChunks(messages, options, runManager),
    );
    // @ts-expect-error - generator return type is compatible at runtime
    yield* gen;
  }

  async completionWithRetry(
    ...args: Parameters<ChatOpenAI["completionWithRetry"]>
  ): ReturnType<ChatOpenAI["completionWithRetry"]> {
    const [request] = args;
    const map = reasoningCtx.getStore();
    if (map) {
      injectReasoningContent(request as unknown as RequestLike, map);
    }
    return (super.completionWithRetry as (...a: unknown[]) => Promise<unknown>)(
      ...args,
    ) as ReturnType<ChatOpenAI["completionWithRetry"]>;
  }
}
```

Note on typing: `ChatOpenAI`'s `_generate`, `_streamResponseChunks`, and `completionWithRetry` are loosely typed in the compiled `.d.ts`. If the compiler complains about the generator return type or `completionWithRetry` overload signatures, relax with `as unknown as` on the forwarded call — do **not** add logic the tests don't cover.

- [ ] **Step 4: Run all tests**

Run: `cd apps/agents && npx vitest run src/nexus/models/__tests__/zai-chat-model.test.ts`
Expected: PASS (all 13 tests).

- [ ] **Step 5: Typecheck the file**

Run: `cd apps/agents && npx tsc --noEmit -p tsconfig.json 2>&1 | grep zai-chat-model || echo "OK"`
Expected: `OK` (no errors originating from `zai-chat-model.ts`). Pre-existing errors elsewhere in the package are acknowledged in `CLAUDE.md` and should be ignored.

- [ ] **Step 6: Commit**

```bash
git add apps/agents/src/nexus/models/zai-chat-model.ts apps/agents/src/nexus/models/__tests__/zai-chat-model.test.ts
git commit -m "feat(models/zai): override generate+stream+completionWithRetry to echo reasoning_content"
```

---

### Task 4: Stream path coverage

**Files:**
- Modify: `apps/agents/src/nexus/models/__tests__/zai-chat-model.test.ts`

- [ ] **Step 1: Add failing test for streaming path**

Append to the test file:

```ts
describe("ZaiChatOpenAI streaming", () => {
  it("injects reasoning_content when streaming", async () => {
    const received: unknown[] = [];
    const model = new ZaiChatOpenAI({
      model: "glm-4.7",
      apiKey: "test-key",
      streaming: true,
      configuration: { baseURL: "https://example.invalid" },
    });
    const superProto = Object.getPrototypeOf(Object.getPrototypeOf(model));
    const original = superProto.completionWithRetry;
    superProto.completionWithRetry = async function (req: unknown) {
      received.push(req);
      // Return an async-iterable of one delta + done, shaped like the OpenAI SDK stream.
      return (async function* () {
        yield {
          id: "s1",
          model: "glm-4.7",
          choices: [{ index: 0, delta: { role: "assistant", content: "ok" }, finish_reason: null }],
        };
        yield {
          id: "s1",
          model: "glm-4.7",
          choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        };
      })();
    };
    try {
      const priorAI = new AIMessage({
        content: "prior",
        additional_kwargs: { reasoning_content: "stream thinking" },
      });
      const stream = await model.stream([
        new HM("q1"),
        priorAI,
        new HM("q2"),
      ]);
      for await (const _ of stream) {
        // drain
      }
      expect(received).toHaveLength(1);
      const req = received[0] as { messages: Array<{ role: string; reasoning_content?: string }> };
      const assistants = req.messages.filter((m) => m.role === "assistant");
      expect(assistants).toHaveLength(1);
      expect(assistants[0].reasoning_content).toBe("stream thinking");
    } finally {
      superProto.completionWithRetry = original;
    }
  });
});
```

- [ ] **Step 2: Run tests**

Run: `cd apps/agents && npx vitest run src/nexus/models/__tests__/zai-chat-model.test.ts`
Expected: 14 tests PASS. If the streaming test fails with ALS context loss (the reasoning_content is missing on the outbound request), proceed to Step 3. Otherwise skip to Step 5.

- [ ] **Step 3: (Fallback, only if Step 2 failed) Switch to buffered streaming**

Replace `_streamResponseChunks` in `apps/agents/src/nexus/models/zai-chat-model.ts` with the buffered variant:

```ts
  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: Parameters<ChatOpenAI["_streamResponseChunks"]>[2],
  ): AsyncGenerator<
    Awaited<ReturnType<AsyncGenerator<unknown>["next"]>>["value"]
  > {
    const map = buildReasoningMap(messages);
    const chunks: unknown[] = [];
    await reasoningCtx.run(map, async () => {
      const gen = super._streamResponseChunks(messages, options, runManager);
      for await (const chunk of gen) {
        chunks.push(chunk);
      }
    });
    for (const chunk of chunks) {
      // @ts-expect-error - yield value shape matches generator return
      yield chunk;
    }
  }
```

Document the tradeoff with a comment above the method:

```ts
  /**
   * Buffered streaming. We consume super's generator entirely inside the
   * reasoningCtx.run callback, then re-yield. This trades streaming latency
   * for guaranteed AsyncLocalStorage context propagation — the straight
   * `yield* reasoningCtx.run(...)` form loses context across yield points on
   * our Node version. See Task 4 Step 3 fallback note in the plan.
   */
```

- [ ] **Step 4: (Only if Step 3 ran) Re-run tests**

Run: `cd apps/agents && npx vitest run src/nexus/models/__tests__/zai-chat-model.test.ts`
Expected: all 14 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/agents/src/nexus/models/zai-chat-model.ts apps/agents/src/nexus/models/__tests__/zai-chat-model.test.ts
git commit -m "test(models/zai): cover streaming path for reasoning injection"
```

---

### Task 5: Wire `ZaiChatOpenAI` into the `zai` factory and re-enable thinking

**Files:**
- Modify: `apps/agents/src/nexus/models/providers.ts`

- [ ] **Step 1: Replace the `zai` factory**

Edit `apps/agents/src/nexus/models/providers.ts`.

Remove the `ZAI_DISABLE_THINKING` constant and its comment block (lines 22-28), and replace the `zai` factory (lines 40-49) with:

```ts
  zai: (id, opts) =>
    new ZaiChatOpenAI({
      model: id,
      apiKey: process.env.ZAI_API_KEY,
      configuration: {
        baseURL: process.env.ZAI_BASE_URL ?? ZAI_DEFAULT_BASE_URL,
      },
      ...(opts ?? {}),
    }) as unknown as BaseChatModel,
```

Add the import at the top of the file, next to the other imports:

```ts
import { ZaiChatOpenAI } from "./zai-chat-model.js";
```

After edit, the top of `providers.ts` should read:

```ts
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatGoogle } from "@langchain/google/node";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import { ZaiChatOpenAI } from "./zai-chat-model.js";
import type { ProviderId } from "./types.js";
```

And the z.ai-related constants/comments should be just:

```ts
// Z.AI is OpenAI-wire-compatible, so we reuse ChatOpenAI (via ZaiChatOpenAI,
// which round-trips reasoning_content to preserve GLM thinking) pointed at
// the z.ai base URL. Users on the GLM Coding Plan set ZAI_BASE_URL to
// `https://api.z.ai/api/coding/paas/v4` to hit the subscription endpoint.
const ZAI_DEFAULT_BASE_URL = "https://api.z.ai/api/paas/v4";
```

- [ ] **Step 2: Run existing registry tests**

Run: `cd apps/agents && npx vitest run src/nexus/models/__tests__/registry.test.ts`
Expected: PASS. These tests instantiate models via the factory — they should not regress.

- [ ] **Step 3: Run the full models test suite**

Run: `cd apps/agents && npx vitest run src/nexus/models/`
Expected: PASS (registry + zai-chat-model tests).

- [ ] **Step 4: Commit**

```bash
git add apps/agents/src/nexus/models/providers.ts
git commit -m "feat(models/zai): route zai factory through ZaiChatOpenAI, re-enable thinking"
```

---

### Task 6: Integration test (gated on `ZAI_API_KEY`)

**Files:**
- Create: `apps/agents/src/nexus/models/__tests__/zai-chat-model.integration.test.ts`

- [ ] **Step 1: Write the integration test**

Create `apps/agents/src/nexus/models/__tests__/zai-chat-model.integration.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ZaiChatOpenAI } from "../zai-chat-model.js";

const hasKey = Boolean(process.env.ZAI_API_KEY);

describe.skipIf(!hasKey)("ZaiChatOpenAI integration", () => {
  it("round-trips reasoning_content on a two-turn request", async () => {
    const capturedBodies: unknown[] = [];

    const customFetch: typeof fetch = async (input, init) => {
      if (init?.body && typeof init.body === "string") {
        try {
          capturedBodies.push(JSON.parse(init.body));
        } catch {
          // ignore non-JSON
        }
      }
      return fetch(input, init);
    };

    const model = new ZaiChatOpenAI({
      model: "glm-4.7",
      apiKey: process.env.ZAI_API_KEY,
      configuration: {
        baseURL: process.env.ZAI_BASE_URL ?? "https://api.z.ai/api/paas/v4",
        fetch: customFetch as unknown as (url: string, init: RequestInit) => Promise<Response>,
      },
    });

    // Turn 1: elicit a thinking-enabled response.
    const turn1 = await model.invoke([
      new SystemMessage("You are a concise assistant."),
      new HumanMessage("What is 17 times 23? Think briefly then answer."),
    ]);
    expect(turn1).toBeInstanceOf(AIMessage);
    const reasoning = (turn1 as AIMessage).additional_kwargs?.reasoning_content;
    // If z.ai returns no reasoning_content, skip the assertion — the contract
    // only matters when thinking is actually produced.
    if (typeof reasoning !== "string" || reasoning.length === 0) {
      console.warn("z.ai returned no reasoning_content on turn 1; skipping round-trip assertion");
      return;
    }

    // Turn 2: include turn 1's AI message verbatim and ask a follow-up.
    capturedBodies.length = 0;
    await model.invoke([
      new SystemMessage("You are a concise assistant."),
      new HumanMessage("What is 17 times 23? Think briefly then answer."),
      turn1 as AIMessage,
      new HumanMessage("Now multiply that by 2."),
    ]);

    expect(capturedBodies.length).toBeGreaterThan(0);
    const body = capturedBodies[capturedBodies.length - 1] as {
      messages: Array<{ role: string; reasoning_content?: string }>;
    };
    const assistants = body.messages.filter((m) => m.role === "assistant");
    expect(assistants.length).toBeGreaterThanOrEqual(1);
    expect(assistants[0].reasoning_content).toBe(reasoning);
  }, 60_000);
});
```

- [ ] **Step 2: Verify the test is skipped without a key**

Run: `cd apps/agents && npx vitest run src/nexus/models/__tests__/zai-chat-model.integration.test.ts`
Expected: 1 skipped (no `ZAI_API_KEY` in the default shell environment).

- [ ] **Step 3: (Manual) Run against real z.ai**

When a real key is available:

```bash
cd apps/agents
source ../../.env && export ZAI_API_KEY
npx vitest run src/nexus/models/__tests__/zai-chat-model.integration.test.ts
```

Expected: 1 passed. If it fails, inspect `capturedBodies` to see what the outbound request looks like.

This manual step is not a blocking checkbox for the automated pipeline — but it MUST be run before the PR is merged. Record the run outcome in the PR description.

- [ ] **Step 4: Commit**

```bash
git add apps/agents/src/nexus/models/__tests__/zai-chat-model.integration.test.ts
git commit -m "test(models/zai): add gated integration test for reasoning round-trip"
```

---

### Task 7: Update `CLAUDE.md` gotcha note

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Replace the z.ai gotcha paragraph**

In `CLAUDE.md`, find the paragraph in the "Known Gotchas" section that starts with "Model providers are auto-detected from env vars (Google / Anthropic / OpenAI / Z.AI)." It currently mentions that Z.AI reuses `ChatOpenAI`.

Append to that paragraph (after the existing sentence about the Coding Plan `ZAI_BASE_URL`):

```
GLM thinking is preserved automatically via `ZaiChatOpenAI` (`apps/agents/src/nexus/models/zai-chat-model.ts`), a thin `ChatOpenAI` subclass that re-attaches `reasoning_content` to assistant messages on every outbound request so chain-of-thought and Coding Plan cache hits survive multi-turn tool calls. No per-call configuration needed.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude-md): note ZaiChatOpenAI preserves GLM thinking automatically"
```

---

### Task 8: Resolve the follow-up memory note

**Files:**
- Delete: `C:\Users\eorhber\.claude\projects\C--Users-eorhber-projects-computer-use-nexus\memory\project_zai_thinking_middleware.md`
- Modify: `C:\Users\eorhber\.claude\projects\C--Users-eorhber-projects-computer-use-nexus\memory\MEMORY.md`

- [ ] **Step 1: Delete the memory file**

Remove `C:\Users\eorhber\.claude\projects\C--Users-eorhber-projects-computer-use-nexus\memory\project_zai_thinking_middleware.md` using the Bash `rm` command.

Run: `rm "/c/Users/eorhber/.claude/projects/C--Users-eorhber-projects-computer-use-nexus/memory/project_zai_thinking_middleware.md"`

- [ ] **Step 2: Remove the entry from `MEMORY.md`**

Edit `C:\Users\eorhber\.claude\projects\C--Users-eorhber-projects-computer-use-nexus\memory\MEMORY.md` and delete the line:

```
- [Z.AI thinking middleware (deferred)](project_zai_thinking_middleware.md) — GLM thinking disabled because LangChain drops `reasoning_content`; build round-trip middleware then re-enable
```

- [ ] **Step 3: Verify no stale references**

Run: Grep for `project_zai_thinking_middleware` across the repo and memory dir — expect no hits.

```bash
grep -r "project_zai_thinking_middleware" "/c/Users/eorhber/.claude/projects/C--Users-eorhber-projects-computer-use-nexus/memory/" || echo "clean"
```

Expected: `clean`.

(No commit — memory files are outside the git repo.)

---

## Final Verification

- [ ] **Run the full affected test suite**

Run: `cd apps/agents && npx vitest run src/nexus/models/`
Expected: all tests PASS; integration test SKIPPED (unless a real key is set).

- [ ] **Lint check**

Run: `cd apps/agents && npx eslint src/nexus/models/zai-chat-model.ts src/nexus/models/__tests__/zai-chat-model.test.ts src/nexus/models/providers.ts 2>&1 || true`
Expected: clean (or only pre-existing warnings unrelated to this change).

- [ ] **Manual integration run recorded in PR description**

Before merging, run Task 6 Step 3 against a real z.ai key and paste the outcome into the PR description (`1 passed` or failure details with capturedBodies inspection).
