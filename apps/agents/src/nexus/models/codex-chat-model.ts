import { BaseChatModel, type BaseChatModelParams } from "@langchain/core/language_models/chat_models";
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import type { ChatResult } from "@langchain/core/outputs";
import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";

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
    tools: Parameters<BaseChatModel["bindTools"]>[0],
    kwargs?: Partial<this["ParsedCallOptions"]>,
  ): ReturnType<BaseChatModel["bindTools"]> {
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

  async _generate(
    _messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    throw new Error("CodexChatModel._generate not implemented yet (Task 11)");
  }
}
