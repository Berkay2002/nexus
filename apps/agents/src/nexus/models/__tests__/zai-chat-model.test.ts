import { describe, it, expect, vi } from "vitest";
import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { buildReasoningMap, injectReasoningContent, ZaiChatOpenAI } from "../zai-chat-model.js";

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

describe("ZaiChatOpenAI overrides", () => {
  function makeStub() {
    const received: unknown[] = [];
    const model = new ZaiChatOpenAI({
      model: "glm-4.7",
      apiKey: "test-key",
      configuration: { baseURL: "https://example.invalid" },
    });
    // The constructor has already patched model.completions.completionWithRetry
    // to wrap _originalCompletionWithRetry. We replace the stored original with
    // a stub so the patched wrapper runs (injecting reasoning_content), then
    // hands off to our stub instead of making a real HTTP call.
    const completions = (model as unknown as {
      completions: {
        _originalCompletionWithRetry: (req: unknown, opts?: unknown) => Promise<unknown>;
      };
    }).completions;
    const originalRestore = completions._originalCompletionWithRetry;
    completions._originalCompletionWithRetry = async function (req: unknown) {
      received.push(req);
      return {
        id: "stub",
        model: "glm-4.7",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "ok" },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      };
    };
    const restore = () => {
      completions._originalCompletionWithRetry = originalRestore;
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
        new HumanMessage("q1"),
        priorAI,
        new HumanMessage("q2"),
      ]);
      expect(received).toHaveLength(1);
      const req = received[0] as {
        messages: Array<{ role: string; reasoning_content?: string }>;
      };
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
        model.invoke([new HumanMessage("a"), ai("alpha"), new HumanMessage("a2")]),
        model.invoke([new HumanMessage("b"), ai("beta"), new HumanMessage("b2")]),
      ]);
      const reasonings = (
        received as Array<{
          messages: Array<{ role: string; reasoning_content?: string }>;
        }>
      )
        .map(
          (r) => r.messages.find((m) => m.role === "assistant")?.reasoning_content,
        )
        .sort();
      expect(reasonings).toEqual(["alpha", "beta"]);
    } finally {
      restore();
    }
  });

  it("falls through when no reasoning context is active", async () => {
    const { model, received, restore } = makeStub();
    try {
      const completions = (model as unknown as {
        completions: {
          completionWithRetry: (req: unknown, opts?: unknown) => Promise<unknown>;
        };
      }).completions;
      const req = {
        messages: [{ role: "assistant", content: "a" }],
      };
      await completions.completionWithRetry(req, {});
      expect(received).toHaveLength(1);
      const sent = received[0] as { messages: Array<Record<string, unknown>> };
      expect(sent.messages[0]).not.toHaveProperty("reasoning_content");
    } finally {
      restore();
    }
  });
});

describe("ZaiChatOpenAI streaming", () => {
  it("injects reasoning_content when streaming", async () => {
    const received: unknown[] = [];
    const model = new ZaiChatOpenAI({
      model: "glm-4.7",
      apiKey: "test-key",
      streaming: true,
      configuration: { baseURL: "https://example.invalid" },
    });
    const completions = (model as unknown as {
      completions: {
        _originalCompletionWithRetry: (req: unknown, opts?: unknown) => Promise<unknown>;
      };
    }).completions;
    const originalRestore = completions._originalCompletionWithRetry;
    completions._originalCompletionWithRetry = async function (req: unknown) {
      received.push(req);
      // Return an async-iterable of one content delta + a done chunk, shaped
      // like the OpenAI SDK streaming response.
      return (async function* () {
        yield {
          id: "s1",
          model: "glm-4.7",
          choices: [
            {
              index: 0,
              delta: { role: "assistant", content: "ok" },
              finish_reason: null,
            },
          ],
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
        new HumanMessage("q1"),
        priorAI,
        new HumanMessage("q2"),
      ]);
      for await (const _ of stream) {
        // drain
      }
      expect(received).toHaveLength(1);
      const req = received[0] as {
        messages: Array<{ role: string; reasoning_content?: string }>;
      };
      const assistants = req.messages.filter((m) => m.role === "assistant");
      expect(assistants).toHaveLength(1);
      expect(assistants[0].reasoning_content).toBe("stream thinking");
    } finally {
      completions._originalCompletionWithRetry = originalRestore;
    }
  });
});

describe("ZaiChatOpenAI.withConfig", () => {
  it("rebuilds as ZaiChatOpenAI so bindTools preserves the subclass and patches", () => {
    const model = new ZaiChatOpenAI({
      model: "glm-5.1",
      apiKey: "test-key",
      configuration: { baseURL: "https://example.invalid" },
    });
    const noop = tool(async () => "ok", {
      name: "noop",
      description: "test tool",
      schema: z.object({}),
    });
    const bound = model.bindTools([noop]);
    expect(bound).toBeInstanceOf(ZaiChatOpenAI);
    const boundCompletions = (bound as unknown as {
      completions: { _originalConvertDelta?: unknown; _originalCompletionWithRetry?: unknown };
    }).completions;
    expect(typeof boundCompletions._originalConvertDelta).toBe("function");
    expect(typeof boundCompletions._originalCompletionWithRetry).toBe("function");
  });

  it("survives a GLM first-delta without role after bindTools (role defaults to assistant, aggregated msg is AIMessageChunk)", async () => {
    const model = new ZaiChatOpenAI({
      model: "glm-5.1",
      apiKey: "test-key",
      streaming: true,
      configuration: { baseURL: "https://example.invalid" },
    });
    const noop = tool(async () => "ok", {
      name: "noop",
      description: "test tool",
      schema: z.object({}),
    });
    const bound = model.bindTools([noop]) as unknown as ZaiChatOpenAI;
    const boundCompletions = (bound as unknown as {
      completions: {
        _originalCompletionWithRetry: (req: unknown, opts?: unknown) => Promise<unknown>;
      };
    }).completions;
    const originalRestore = boundCompletions._originalCompletionWithRetry;
    boundCompletions._originalCompletionWithRetry = async function () {
      return (async function* () {
        // First delta: reasoning_content only, NO role (the GLM-5.1 bug).
        yield {
          id: "s1",
          model: "glm-5.1",
          choices: [
            {
              index: 0,
              delta: { reasoning_content: "thinking..." },
              finish_reason: null,
            },
          ],
        };
        yield {
          id: "s1",
          model: "glm-5.1",
          choices: [
            {
              index: 0,
              delta: { role: "assistant", content: "hello" },
              finish_reason: null,
            },
          ],
        };
        yield {
          id: "s1",
          model: "glm-5.1",
          choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        };
      })();
    };
    try {
      const stream = await bound.stream([new HumanMessage("hi")]);
      let aggregated: AIMessageChunk | undefined;
      for await (const chunk of stream) {
        aggregated = aggregated === undefined ? chunk : aggregated.concat(chunk);
      }
      expect(aggregated).toBeDefined();
      expect(aggregated).toBeInstanceOf(AIMessageChunk);
      expect((aggregated as AIMessageChunk)._getType()).toBe("ai");
      expect((aggregated as AIMessageChunk).content).toBe("hello");
    } finally {
      boundCompletions._originalCompletionWithRetry = originalRestore;
    }
  });
});
