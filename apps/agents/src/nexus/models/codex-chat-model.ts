import {
  BaseChatModel,
  type BaseChatModelParams,
  type BindToolsInput,
} from "@langchain/core/language_models/chat_models";
import {
  AIMessage,
  AIMessageChunk,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { ChatGenerationChunk, type ChatResult } from "@langchain/core/outputs";
import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import type { Runnable } from "@langchain/core/runnables";
import type { BaseLanguageModelInput } from "@langchain/core/language_models/base";

export type CodexReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh";

export interface CodexChatModelFields extends BaseChatModelParams {
  model?: string;
  reasoningEffort?: CodexReasoningEffort;
  thinkingEnabled?: boolean;
  retryMaxAttempts?: number;
  accessToken?: string;
  accountId?: string;
}

export class CodexChatModel extends BaseChatModel {
  model: string;
  reasoningEffort: CodexReasoningEffort;
  retryMaxAttempts: number;
  protected accessToken: string;
  protected accountId: string;

  constructor(fields: CodexChatModelFields = {}) {
    const { maxTokens: _dropMax, ...rest } = fields as CodexChatModelFields & {
      maxTokens?: number;
    };
    super(rest);

    this.retryMaxAttempts = rest.retryMaxAttempts ?? 3;
    if (this.retryMaxAttempts < 1) {
      throw new Error("retryMaxAttempts must be >= 1");
    }

    if (!rest.accessToken) {
      throw new Error("Codex CLI credential not found");
    }

    this.accessToken = rest.accessToken;
    this.accountId = rest.accountId ?? "";
    this.model = rest.model ?? "gpt-5.4";

    const thinkingEnabled = rest.thinkingEnabled ?? true;
    if (!thinkingEnabled) {
      this.reasoningEffort = "none";
    } else {
      this.reasoningEffort = rest.reasoningEffort ?? "medium";
    }
  }

  _llmType(): string {
    return "codex-responses";
  }

  static readonly BASE_URL = "https://chatgpt.com/backend-api/codex";

  static _parseSseDataLine(line: string): Record<string, unknown> | null {
    if (!line.startsWith("data:")) return null;
    const raw = line.slice(5).trim();
    if (!raw || raw === "[DONE]") return null;
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  static _normalizeContent(content: unknown): string {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .map((item) => CodexChatModel._normalizeContent(item))
        .filter((s) => s.length > 0)
        .join("\n");
    }
    if (content && typeof content === "object") {
      const obj = content as Record<string, unknown>;
      for (const key of ["text", "output"]) {
        const value = obj[key];
        if (typeof value === "string") return value;
      }
      if (obj.content !== undefined) return CodexChatModel._normalizeContent(obj.content);
      try {
        return JSON.stringify(obj);
      } catch {
        return String(obj);
      }
    }
    try {
      return JSON.stringify(content);
    } catch {
      return String(content);
    }
  }

  _convertMessages(messages: BaseMessage[]): {
    instructions: string;
    input: Array<Record<string, unknown>>;
  } {
    const instructionParts: string[] = [];
    const input: Array<Record<string, unknown>> = [];

    for (const msg of messages) {
      if (msg instanceof SystemMessage) {
        const text = CodexChatModel._normalizeContent(msg.content);
        if (text) instructionParts.push(text);
      } else if (msg instanceof HumanMessage) {
        input.push({ role: "user", content: CodexChatModel._normalizeContent(msg.content) });
      } else if (msg instanceof AIMessage) {
        const text = CodexChatModel._normalizeContent(msg.content);
        if (text) input.push({ role: "assistant", content: text });
        for (const tc of msg.tool_calls ?? []) {
          input.push({
            type: "function_call",
            name: tc.name,
            arguments:
              typeof tc.args === "object" && tc.args !== null
                ? JSON.stringify(tc.args)
                : String(tc.args ?? ""),
            call_id: tc.id ?? "",
          });
        }
      } else if (msg instanceof ToolMessage) {
        input.push({
          type: "function_call_output",
          call_id: msg.tool_call_id,
          output: CodexChatModel._normalizeContent(msg.content),
        });
      }
    }

    const instructions = instructionParts.length > 0
      ? instructionParts.join("\n\n")
      : "You are a helpful assistant.";

    return { instructions, input };
  }

  _convertTools(tools: unknown[]): Array<Record<string, unknown>> {
    const result: Array<Record<string, unknown>> = [];
    for (const tool of tools) {
      if (!tool || typeof tool !== "object") continue;
      const t = tool as Record<string, unknown>;
      if (t.type === "function" && t.function && typeof t.function === "object") {
        const fn = t.function as Record<string, unknown>;
        result.push({
          type: "function",
          name: fn.name,
          description: fn.description ?? "",
          parameters: fn.parameters ?? {},
        });
      } else if (typeof t.name === "string") {
        result.push({
          type: "function",
          name: t.name,
          description: t.description ?? "",
          parameters: t.parameters ?? {},
        });
      }
    }
    return result;
  }

  override bindTools(
    tools: BindToolsInput[],
    kwargs?: Partial<this["ParsedCallOptions"]>,
  ): Runnable<BaseLanguageModelInput, AIMessageChunk, this["ParsedCallOptions"]> {
    const formatted: Array<Record<string, unknown>> = [];
    for (const t of tools) {
      if (t && typeof t === "object") {
        if ("lc_serializable" in t || "name" in t) {
          const asAny = t as unknown as {
            name?: string;
            description?: string;
            schema?: unknown;
          };
          if (typeof asAny.name === "string") {
            formatted.push({
              type: "function",
              name: asAny.name,
              description: asAny.description ?? "",
              parameters: asAny.schema ?? { type: "object", properties: {} },
            });
            continue;
          }
        }
        formatted.push(...this._convertTools([t]));
      }
    }
    return this.withConfig({ tools: formatted, ...(kwargs ?? {}) } as unknown as Partial<
      this["ParsedCallOptions"]
    >);
  }

  protected _buildHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      "ChatGPT-Account-ID": this.accountId,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      originator: "codex_cli_rs",
    };
  }

  protected _buildPayload(
    messages: BaseMessage[],
    tools?: Array<Record<string, unknown>>,
  ): Record<string, unknown> {
    const { instructions, input } = this._convertMessages(messages);
    const payload: Record<string, unknown> = {
      model: this.model,
      instructions,
      input,
      store: false,
      stream: true,
      reasoning:
        this.reasoningEffort === "none"
          ? { effort: "none" }
          : { effort: this.reasoningEffort, summary: "detailed" },
    };
    if (tools && tools.length > 0) {
      payload.tools = this._convertTools(tools);
    }
    return payload;
  }

  /**
   * POST to the Codex responses endpoint with retry-on-429/500/529, exponential
   * backoff, and Retry-After header support. Returns the raw Response on success.
   * Honors the provided AbortSignal for both the underlying fetch and the retry
   * backoff wait (cancelling a run must not leave a pending setTimeout behind).
   */
  protected async _fetchCodexStream(
    headers: Record<string, string>,
    payload: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<Response> {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= this.retryMaxAttempts; attempt++) {
      signal?.throwIfAborted?.();
      try {
        const resp = await fetch(`${CodexChatModel.BASE_URL}/responses`, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          signal,
        });
        if (!resp.ok) {
          const err = new Error(
            `Codex API returned ${resp.status}: ${resp.statusText}`,
          ) as Error & { status: number; response: Response };
          err.status = resp.status;
          err.response = resp;
          throw err;
        }
        if (!resp.body) throw new Error("Codex API returned empty body");
        return resp;
      } catch (err) {
        lastError = err;
        if (signal?.aborted) throw err;
        const status = (err as { status?: number }).status;
        const retryable = status === 429 || status === 500 || status === 529;
        if (!retryable || attempt >= this.retryMaxAttempts) throw err;
        const base = CodexChatModel.RETRY_BASE_MS * Math.pow(2, attempt - 1);
        const jitterFactor = 0.8 + Math.random() * 0.4;
        let waitMs = Math.floor(base * jitterFactor);
        const retryAfter = (err as { response?: Response }).response?.headers?.get?.(
          "Retry-After",
        );
        if (retryAfter) {
          const parsed = Number.parseInt(retryAfter, 10);
          if (Number.isFinite(parsed)) waitMs = parsed * 1000;
        }
        console.warn(
          `[CodexChatModel] HTTP ${status}, retrying ${attempt}/${this.retryMaxAttempts} after ${waitMs}ms`,
        );
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(resolve, waitMs);
          if (signal) {
            const onAbort = () => {
              clearTimeout(t);
              reject(signal.reason ?? new Error("aborted"));
            };
            if (signal.aborted) onAbort();
            else signal.addEventListener("abort", onAbort, { once: true });
          }
        });
      }
    }
    throw lastError;
  }

  /** Base milliseconds for exponential backoff. Test-only override. */
  static RETRY_BASE_MS = 2000;

  /**
   * Async generator that reads an already-opened SSE Response line-by-line and
   * yields parsed event objects (non-null only). Unrelated to Codex payload shape.
   * If an AbortSignal is provided, the loop exits early after each reader.read()
   * when the signal has been aborted.
   */
  protected async *_streamSseEvents(
    response: Response,
    signal?: AbortSignal,
  ): AsyncGenerator<Record<string, unknown>> {
    if (!response.body) throw new Error("Codex API returned empty body");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (signal?.aborted) return;
      buffer += decoder.decode(value, { stream: true });
      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIdx).replace(/\r$/, "");
        buffer = buffer.slice(newlineIdx + 1);
        const data = CodexChatModel._parseSseDataLine(line);
        if (data) yield data;
      }
    }
    // Flush any trailing line the stream didn't terminate with \n.
    if (buffer.length > 0) {
      const data = CodexChatModel._parseSseDataLine(buffer.replace(/\r$/, ""));
      if (data) yield data;
    }
  }

  /**
   * Pure function that maps one Codex SSE event to a ChatGenerationChunk, or
   * null if the event type is not one we emit chunks for.
   */
  static _convertSseEventToChunk(
    event: Record<string, unknown>,
  ): ChatGenerationChunk | null {
    const eventType = event.type;

    if (eventType === "response.output_text.delta") {
      const delta = typeof event.delta === "string" ? event.delta : "";
      return new ChatGenerationChunk({
        message: new AIMessageChunk({ content: delta }),
        text: delta,
      });
    }

    if (eventType === "response.reasoning_summary_text.delta") {
      const delta = typeof event.delta === "string" ? event.delta : "";
      return new ChatGenerationChunk({
        message: new AIMessageChunk({
          content: "",
          additional_kwargs: { reasoning_content: delta },
        }),
        text: "",
      });
    }

    if (eventType === "response.output_item.done") {
      const item = event.item;
      if (!item || typeof item !== "object") return null;
      const itemObj = item as Record<string, unknown>;
      if (itemObj.type !== "function_call") return null;
      const name = typeof itemObj.name === "string" ? itemObj.name : "";
      const argsStr =
        typeof itemObj.arguments === "string" ? itemObj.arguments : "{}";
      const callId = typeof itemObj.call_id === "string" ? itemObj.call_id : "";
      const outputIndex =
        typeof event.output_index === "number" ? event.output_index : 0;
      return new ChatGenerationChunk({
        message: new AIMessageChunk({
          content: "",
          tool_call_chunks: [
            {
              name,
              args: argsStr,
              id: callId,
              index: outputIndex,
              type: "tool_call_chunk",
            },
          ],
        }),
        text: "",
      });
    }

    if (eventType === "response.completed") {
      const response =
        event.response && typeof event.response === "object"
          ? (event.response as Record<string, unknown>)
          : {};
      const usageRaw =
        response.usage && typeof response.usage === "object"
          ? (response.usage as Record<string, unknown>)
          : {};
      const input_tokens =
        typeof usageRaw.input_tokens === "number" ? usageRaw.input_tokens : 0;
      const output_tokens =
        typeof usageRaw.output_tokens === "number" ? usageRaw.output_tokens : 0;
      const total_tokens =
        typeof usageRaw.total_tokens === "number"
          ? usageRaw.total_tokens
          : input_tokens + output_tokens;
      const model = typeof response.model === "string" ? response.model : undefined;
      return new ChatGenerationChunk({
        message: new AIMessageChunk({
          content: "",
          usage_metadata: {
            input_tokens,
            output_tokens,
            total_tokens,
          },
          response_metadata: model ? { model } : {},
        }),
        text: "",
      });
    }

    return null;
  }

  override async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun,
  ): AsyncGenerator<ChatGenerationChunk> {
    options.signal?.throwIfAborted?.();
    const tools = (options as unknown as { tools?: Array<Record<string, unknown>> })
      .tools;
    const headers = this._buildHeaders();
    const payload = this._buildPayload(messages, tools);
    const response = await this._fetchCodexStream(headers, payload, options.signal);
    for await (const event of this._streamSseEvents(response, options.signal)) {
      const chunk = CodexChatModel._convertSseEventToChunk(event);
      if (chunk == null) continue;
      yield chunk;
      if (options.signal?.aborted) return;
      await runManager?.handleLLMNewToken(
        chunk.text ?? "",
        undefined,
        undefined,
        undefined,
        undefined,
        { chunk },
      );
    }
  }

  override async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    options.signal?.throwIfAborted?.();
    const stream = this._streamResponseChunks(messages, options, runManager);
    let finalChunk: ChatGenerationChunk | undefined;
    for await (const chunk of stream) {
      finalChunk = finalChunk?.concat(chunk) ?? chunk;
    }
    if (!finalChunk) {
      return { generations: [], llmOutput: {} };
    }
    const msg = finalChunk.message as AIMessageChunk;
    const usage = msg.usage_metadata;
    const respMeta = (msg.response_metadata as Record<string, unknown> | undefined) ?? {};
    return {
      generations: [finalChunk],
      llmOutput: {
        tokenUsage: {
          promptTokens: usage?.input_tokens ?? 0,
          completionTokens: usage?.output_tokens ?? 0,
          totalTokens: usage?.total_tokens ?? 0,
        },
        model_name:
          typeof respMeta.model === "string" ? respMeta.model : this.model,
      },
    };
  }
}
