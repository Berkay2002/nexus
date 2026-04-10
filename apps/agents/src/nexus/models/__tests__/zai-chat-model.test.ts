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
