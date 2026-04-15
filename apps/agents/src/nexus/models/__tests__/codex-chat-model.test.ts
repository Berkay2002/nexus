import { describe, expect, it, vi } from "vitest";
import { CodexChatModel } from "../codex-chat-model.js";
import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { ChatGenerationChunk } from "@langchain/core/outputs";

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

  it("emits only function_call items for a tool-only AIMessage with empty content", () => {
    const ai = new AIMessage({
      content: "",
      tool_calls: [
        { name: "bash", args: { cmd: "ls" }, id: "call_1", type: "tool_call" },
      ],
    });
    const { input } = (
      model as unknown as {
        _convertMessages: (msgs: BaseMessage[]) => { instructions: string; input: unknown[] };
      }
    )._convertMessages([ai]);
    // No assistant message block should be emitted — the Responses API gets
    // confused if we hand it an empty-content assistant turn before a
    // function_call. This test documents the current (correct) behavior.
    expect(input).toEqual([
      {
        type: "function_call",
        name: "bash",
        arguments: JSON.stringify({ cmd: "ls" }),
        call_id: "call_1",
      },
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

describe("CodexChatModel._convertSseEventToChunk", () => {
  it("converts output_text.delta into a text chunk", () => {
    const chunk = CodexChatModel._convertSseEventToChunk({
      type: "response.output_text.delta",
      delta: "hello",
    });
    expect(chunk).toBeInstanceOf(ChatGenerationChunk);
    expect(chunk!.text).toBe("hello");
    expect(chunk!.message.content).toBe("hello");
  });

  it("converts reasoning_summary_text.delta into a reasoning chunk", () => {
    const chunk = CodexChatModel._convertSseEventToChunk({
      type: "response.reasoning_summary_text.delta",
      delta: "thinking...",
    });
    expect(chunk).not.toBeNull();
    expect(chunk!.message.content).toBe("");
    expect(
      (chunk!.message as AIMessageChunk).additional_kwargs?.reasoning_content,
    ).toBe("thinking...");
    expect(chunk!.text).toBe("");
  });

  it("converts output_item.done with function_call into tool_call_chunks", () => {
    const chunk = CodexChatModel._convertSseEventToChunk({
      type: "response.output_item.done",
      output_index: 0,
      item: {
        type: "function_call",
        name: "bash",
        arguments: JSON.stringify({ cmd: "ls" }),
        call_id: "tc-1",
      },
    });
    expect(chunk).not.toBeNull();
    const msg = chunk!.message as AIMessageChunk;
    expect(msg.tool_call_chunks).toEqual([
      {
        name: "bash",
        args: JSON.stringify({ cmd: "ls" }),
        id: "tc-1",
        index: 0,
        type: "tool_call_chunk",
      },
    ]);
  });

  it("returns null for output_item.done with message type", () => {
    const chunk = CodexChatModel._convertSseEventToChunk({
      type: "response.output_item.done",
      output_index: 0,
      item: { type: "message", content: [] },
    });
    expect(chunk).toBeNull();
  });

  it("extracts usage_metadata from response.completed", () => {
    const chunk = CodexChatModel._convertSseEventToChunk({
      type: "response.completed",
      response: {
        model: "gpt-5.4",
        usage: { input_tokens: 12, output_tokens: 34, total_tokens: 46 },
      },
    });
    expect(chunk).not.toBeNull();
    const msg = chunk!.message as AIMessageChunk;
    expect(msg.usage_metadata).toEqual({
      input_tokens: 12,
      output_tokens: 34,
      total_tokens: 46,
    });
    expect((msg.response_metadata as Record<string, unknown>).model).toBe("gpt-5.4");
  });

  it("returns null for known no-op event types without warning", () => {
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    try {
      expect(
        CodexChatModel._convertSseEventToChunk({ type: "response.in_progress" }),
      ).toBeNull();
      expect(debugSpy).not.toHaveBeenCalled();
    } finally {
      debugSpy.mockRestore();
    }
  });

  it("returns null but warns for unknown response.* event types", () => {
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    try {
      expect(
        CodexChatModel._convertSseEventToChunk({ type: "response.foo.bar" }),
      ).toBeNull();
      expect(debugSpy).toHaveBeenCalledTimes(1);
      expect(debugSpy.mock.calls[0][0]).toContain("response.foo.bar");
    } finally {
      debugSpy.mockRestore();
    }
  });

  it("returns null without warning for non-response.* event types", () => {
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    try {
      expect(
        CodexChatModel._convertSseEventToChunk({ type: "heartbeat" }),
      ).toBeNull();
      expect(debugSpy).not.toHaveBeenCalled();
    } finally {
      debugSpy.mockRestore();
    }
  });

  it("emits a name-only tool_call_chunk on output_item.added for function_call", () => {
    const chunk = CodexChatModel._convertSseEventToChunk({
      type: "response.output_item.added",
      output_index: 0,
      item: {
        type: "function_call",
        name: "bash",
        call_id: "tc-1",
        arguments: "",
      },
    });
    expect(chunk).not.toBeNull();
    const msg = chunk!.message as AIMessageChunk;
    expect(msg.tool_call_chunks).toEqual([
      {
        name: "bash",
        args: "",
        id: "tc-1",
        index: 0,
        type: "tool_call_chunk",
      },
    ]);
  });

  it("returns null for output_item.added with non-function_call item type", () => {
    expect(
      CodexChatModel._convertSseEventToChunk({
        type: "response.output_item.added",
        output_index: 0,
        item: { type: "message", content: [] },
      }),
    ).toBeNull();
  });

  it("emits an args-only tool_call_chunk on function_call_arguments.delta", () => {
    const chunk = CodexChatModel._convertSseEventToChunk({
      type: "response.function_call_arguments.delta",
      output_index: 0,
      item_id: "fc-1",
      delta: '{"cmd":',
    });
    expect(chunk).not.toBeNull();
    const msg = chunk!.message as AIMessageChunk;
    expect(msg.tool_call_chunks).toEqual([
      {
        name: "",
        args: '{"cmd":',
        id: "fc-1",
        index: 0,
        type: "tool_call_chunk",
      },
    ]);
  });
});

function makeSseResponse(lines: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const line of lines) {
        controller.enqueue(encoder.encode(line + "\n"));
      }
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

describe("CodexChatModel _streamResponseChunks + _generate (mocked fetch)", () => {
  const sseLines = [
    `data: {"type":"response.output_text.delta","delta":"Hel"}`,
    `data: {"type":"response.output_text.delta","delta":"lo"}`,
    `data: {"type":"response.output_text.delta","delta":" world"}`,
    `data: {"type":"response.completed","response":{"model":"gpt-5.4","usage":{"input_tokens":5,"output_tokens":3,"total_tokens":8}}}`,
  ];

  it("streams text deltas as individual chunks", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(makeSseResponse(sseLines));
    try {
      const model = new CodexChatModel({ accessToken: "tok", accountId: "acct" });
      const chunks: ChatGenerationChunk[] = [];
      const stream = (
        model as unknown as {
          _streamResponseChunks: (
            msgs: BaseMessage[],
            opts: unknown,
          ) => AsyncGenerator<ChatGenerationChunk>;
        }
      )._streamResponseChunks([new HumanMessage("hi")], {});
      for await (const chunk of stream) chunks.push(chunk);
      // 3 text delta chunks + 1 completion metadata chunk
      expect(chunks.length).toBe(4);
      expect(chunks[0].text).toBe("Hel");
      expect(chunks[1].text).toBe("lo");
      expect(chunks[2].text).toBe(" world");
      expect(chunks[3].text).toBe("");
      const finalMsg = chunks[3].message as AIMessageChunk;
      expect(finalMsg.usage_metadata?.total_tokens).toBe(8);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("_generate accumulates chunks into a single ChatResult", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(makeSseResponse(sseLines));
    try {
      const model = new CodexChatModel({ accessToken: "tok", accountId: "acct" });
      const result = await model.invoke([new HumanMessage("hi")]);
      expect(result.content).toBe("Hello world");
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("throws immediately when _streamResponseChunks is called with an already-aborted signal", async () => {
    // fetch mock that never resolves — if we reach it, the abort plumbing is broken
    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(
      () =>
        new Promise(() => {
          /* never resolves */
        }),
    );
    try {
      const model = new CodexChatModel({ accessToken: "tok", accountId: "acct" });
      const controller = new AbortController();
      controller.abort();
      const stream = (
        model as unknown as {
          _streamResponseChunks: (
            msgs: BaseMessage[],
            opts: unknown,
          ) => AsyncGenerator<ChatGenerationChunk>;
        }
      )._streamResponseChunks([new HumanMessage("hi")], { signal: controller.signal });
      await expect(async () => {
        for await (const _ of stream) {
          /* should not yield */
        }
      }).rejects.toThrow();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("stops streaming mid-flight when signal aborts after first chunk", async () => {
    // SSE response with one delta, then a reader that hangs forever.
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(
          encoder.encode(
            `data: {"type":"response.output_text.delta","delta":"a"}\n`,
          ),
        );
        // Do not close — stream stays open so the loop depends on abort.
      },
    });
    const hangResponse = new Response(body, {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(hangResponse);
    try {
      const model = new CodexChatModel({ accessToken: "tok", accountId: "acct" });
      const controller = new AbortController();
      const stream = (
        model as unknown as {
          _streamResponseChunks: (
            msgs: BaseMessage[],
            opts: unknown,
          ) => AsyncGenerator<ChatGenerationChunk>;
        }
      )._streamResponseChunks([new HumanMessage("hi")], { signal: controller.signal });
      const chunks: ChatGenerationChunk[] = [];
      const iter = stream[Symbol.asyncIterator]();
      const first = await iter.next();
      if (!first.done) chunks.push(first.value);
      controller.abort();
      // Cancelling the body reader unblocks the pending reader.read() with an error.
      try {
        await body.cancel();
      } catch {
        /* ignore */
      }
      // Further iteration must stop cleanly (loop exits after detecting abort).
      for (let i = 0; i < 5; i++) {
        const step = await iter.next().catch(() => ({ done: true, value: undefined }));
        if (step.done) break;
      }
      expect(chunks.length).toBe(1);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("merges function_call items from output_item.done into tool_calls", async () => {
    const toolLines = [
      `data: {"type":"response.output_item.done","output_index":0,"item":{"type":"function_call","name":"bash","arguments":"{\\"cmd\\":\\"ls\\"}","call_id":"tc-1"}}`,
      `data: {"type":"response.completed","response":{"model":"gpt-5.4","usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}}`,
    ];
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(makeSseResponse(toolLines));
    try {
      const model = new CodexChatModel({ accessToken: "tok", accountId: "acct" });
      const result = await model.invoke([new HumanMessage("run ls")]);
      expect(result.tool_calls).toEqual([
        { name: "bash", args: { cmd: "ls" }, id: "tc-1", type: "tool_call" },
      ]);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("retries once on 429 then succeeds (honors Retry-After: 0)", async () => {
    vi.useFakeTimers();
    try {
      const fetchSpy = vi.spyOn(global, "fetch");
      fetchSpy.mockResolvedValueOnce(
        new Response("rate limited", {
          status: 429,
          headers: { "Retry-After": "0" },
        }),
      );
      fetchSpy.mockResolvedValueOnce(
        makeSseResponse([
          `data: {"type":"response.output_text.delta","delta":"ok"}`,
          `data: {"type":"response.completed","response":{"model":"gpt-5.4","usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}}`,
        ]),
      );
      const model = new CodexChatModel({
        accessToken: "tok",
        accountId: "acct",
        retryMaxAttempts: 2,
      });
      const promise = model.invoke([new HumanMessage("hi")]);
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(result.content).toBe("ok");
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      fetchSpy.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });

  it("concatenates streamed function_call_arguments.delta chunks into tool_calls", async () => {
    const streamedLines = [
      `data: {"type":"response.output_item.added","output_index":0,"item":{"type":"function_call","name":"bash","call_id":"tc-1","arguments":""}}`,
      `data: {"type":"response.function_call_arguments.delta","output_index":0,"item_id":"tc-1","delta":"{\\"cmd\\""}`,
      `data: {"type":"response.function_call_arguments.delta","output_index":0,"item_id":"tc-1","delta":":\\"ls\\"}"}`,
      `data: {"type":"response.completed","response":{"model":"gpt-5.4","usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}}`,
    ];
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(makeSseResponse(streamedLines));
    try {
      const model = new CodexChatModel({ accessToken: "tok", accountId: "acct" });
      const result = await model.invoke([new HumanMessage("run ls")]);
      expect(result.tool_calls).toEqual([
        { name: "bash", args: { cmd: "ls" }, id: "tc-1", type: "tool_call" },
      ]);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
