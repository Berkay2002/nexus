import { BaseChatModel, type BaseChatModelParams } from "@langchain/core/language_models/chat_models";
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

  async _generate(
    _messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    throw new Error("CodexChatModel._generate not implemented yet (Task 11)");
  }
}
