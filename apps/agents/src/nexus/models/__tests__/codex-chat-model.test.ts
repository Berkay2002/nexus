import { describe, expect, it } from "vitest";
import { CodexChatModel } from "../codex-chat-model.js";
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";

describe("CodexChatModel constructor", () => {
  it("rejects retryMaxAttempts < 1", () => {
    expect(
      () =>
        new CodexChatModel({
          accessToken: "token",
          accountId: "acct",
          retryMaxAttempts: 0,
        }),
    ).toThrow(/retryMaxAttempts must be >= 1/);
  });

  it("throws when accessToken is missing", () => {
    expect(() => new CodexChatModel({ accountId: "acct" })).toThrow(
      /Codex CLI credential not found/,
    );
  });

  it("defaults model to gpt-5.4", () => {
    const model = new CodexChatModel({ accessToken: "tok", accountId: "acct" });
    expect(model.model).toBe("gpt-5.4");
  });

  it("defaults reasoningEffort to medium", () => {
    const model = new CodexChatModel({ accessToken: "tok", accountId: "acct" });
    expect(model.reasoningEffort).toBe("medium");
  });

  it("strips maxTokens field from fields record", () => {
    const model = new CodexChatModel({
      accessToken: "tok",
      accountId: "acct",
      // @ts-expect-error intentional — factory may pass this through
      maxTokens: 1234,
    });
    expect((model as unknown as { maxTokens?: number }).maxTokens).toBeUndefined();
  });
});

describe("CodexChatModel._convertMessages", () => {
  const model = new CodexChatModel({ accessToken: "tok", accountId: "acct" });

  it("concatenates multiple system messages with \\n\\n", () => {
    const { instructions, input } = (
      model as unknown as {
        _convertMessages: (msgs: BaseMessage[]) => { instructions: string; input: unknown[] };
      }
    )._convertMessages([
      new SystemMessage("First system prompt."),
      new SystemMessage("Second system prompt."),
      new HumanMessage("Hello"),
    ]);
    expect(instructions).toBe("First system prompt.\n\nSecond system prompt.");
    expect(input).toEqual([{ role: "user", content: "Hello" }]);
  });

  it("flattens structured text blocks", () => {
    const { instructions, input } = (
      model as unknown as {
        _convertMessages: (msgs: BaseMessage[]) => { instructions: string; input: unknown[] };
      }
    )._convertMessages([
      new HumanMessage({ content: [{ type: "text", text: "Hello from blocks" }] }),
    ]);
    expect(instructions).toBe("You are a helpful assistant.");
    expect(input).toEqual([{ role: "user", content: "Hello from blocks" }]);
  });

  it("converts AIMessage with tool_calls into function_call items", () => {
    const ai = new AIMessage({
      content: "calling tool",
      tool_calls: [{ name: "bash", args: { cmd: "ls" }, id: "call_1", type: "tool_call" }],
    });
    const { input } = (
      model as unknown as {
        _convertMessages: (msgs: BaseMessage[]) => { instructions: string; input: unknown[] };
      }
    )._convertMessages([ai]);
    expect(input).toEqual([
      { role: "assistant", content: "calling tool" },
      {
        type: "function_call",
        name: "bash",
        arguments: JSON.stringify({ cmd: "ls" }),
        call_id: "call_1",
      },
    ]);
  });

  it("converts ToolMessage into function_call_output", () => {
    const tm = new ToolMessage({
      content: "file1\nfile2",
      tool_call_id: "call_1",
    });
    const { input } = (
      model as unknown as {
        _convertMessages: (msgs: BaseMessage[]) => { instructions: string; input: unknown[] };
      }
    )._convertMessages([tm]);
    expect(input).toEqual([
      { type: "function_call_output", call_id: "call_1", output: "file1\nfile2" },
    ]);
  });
});
