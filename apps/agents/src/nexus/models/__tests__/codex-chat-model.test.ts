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

describe("CodexChatModel._convertTools", () => {
  const model = new CodexChatModel({ accessToken: "tok", accountId: "acct" });

  it("flattens wrapped function-calling tool shape", () => {
    const tools = [
      {
        type: "function",
        function: {
          name: "bash",
          description: "Run a shell command",
          parameters: { type: "object", properties: { cmd: { type: "string" } } },
        },
      },
    ];
    const result = (
      model as unknown as { _convertTools: (t: unknown[]) => unknown[] }
    )._convertTools(tools);
    expect(result).toEqual([
      {
        type: "function",
        name: "bash",
        description: "Run a shell command",
        parameters: { type: "object", properties: { cmd: { type: "string" } } },
      },
    ]);
  });

  it("passes through already-flat tools", () => {
    const tools = [
      { type: "function", name: "search", description: "Search the web", parameters: {} },
    ];
    const result = (
      model as unknown as { _convertTools: (t: unknown[]) => unknown[] }
    )._convertTools(tools);
    expect(result).toEqual(tools);
  });
});

import { CodexChatModel as CodexCls } from "../codex-chat-model.js";

describe("CodexChatModel SSE parser", () => {
  it("returns null for [DONE] marker", () => {
    expect(CodexCls._parseSseDataLine("data: [DONE]")).toBeNull();
  });

  it("returns null for event: lines", () => {
    expect(CodexCls._parseSseDataLine("event: response.completed")).toBeNull();
  });

  it("returns null for non-data lines", () => {
    expect(CodexCls._parseSseDataLine("")).toBeNull();
    expect(CodexCls._parseSseDataLine(": heartbeat")).toBeNull();
  });

  it("returns null for malformed JSON payload", () => {
    expect(CodexCls._parseSseDataLine("data: not-json")).toBeNull();
  });

  it("parses valid JSON payload", () => {
    expect(
      CodexCls._parseSseDataLine('data: {"type":"response.completed"}'),
    ).toEqual({ type: "response.completed" });
  });
});

describe("CodexChatModel._parseResponse", () => {
  const model = new CodexChatModel({ accessToken: "tok", accountId: "acct" });

  it("parses valid tool_calls", () => {
    const result = (
      model as unknown as { _parseResponse: (r: unknown) => { generations: Array<{ message: AIMessage }> } }
    )._parseResponse({
      model: "gpt-5.4",
      output: [
        {
          type: "function_call",
          name: "bash",
          arguments: JSON.stringify({ cmd: "pwd" }),
          call_id: "tc-1",
        },
      ],
      usage: {},
    });
    const msg = result.generations[0].message;
    expect(msg.tool_calls).toEqual([
      { name: "bash", args: { cmd: "pwd" }, id: "tc-1", type: "tool_call" },
    ]);
  });

  it("routes malformed tool arguments to invalid_tool_calls", () => {
    const result = (
      model as unknown as {
        _parseResponse: (r: unknown) => { generations: Array<{ message: AIMessage }> };
      }
    )._parseResponse({
      model: "gpt-5.4",
      output: [
        { type: "function_call", name: "bash", arguments: "{invalid", call_id: "tc-1" },
      ],
      usage: {},
    });
    const msg = result.generations[0].message;
    expect(msg.tool_calls).toEqual([]);
    expect(msg.invalid_tool_calls?.length).toBe(1);
    expect(msg.invalid_tool_calls?.[0]?.name).toBe("bash");
    expect(msg.invalid_tool_calls?.[0]?.id).toBe("tc-1");
    expect(msg.invalid_tool_calls?.[0]?.error).toMatch(/parse/i);
  });

  it("extracts reasoning content into additional_kwargs", () => {
    const result = (
      model as unknown as {
        _parseResponse: (r: unknown) => { generations: Array<{ message: AIMessage }> };
      }
    )._parseResponse({
      model: "gpt-5.4",
      output: [
        {
          type: "reasoning",
          summary: [{ type: "summary_text", text: "Thinking about it..." }],
        },
        {
          type: "message",
          content: [{ type: "output_text", text: "Here is the answer." }],
        },
      ],
      usage: {},
    });
    const msg = result.generations[0].message;
    expect(msg.content).toBe("Here is the answer.");
    expect(msg.additional_kwargs?.reasoning_content).toBe("Thinking about it...");
  });
});
