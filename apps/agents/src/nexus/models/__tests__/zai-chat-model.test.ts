import { describe, it, expect } from "vitest";
import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { buildReasoningMap, injectReasoningContent } from "../zai-chat-model.js";
import { vi } from "vitest";

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
