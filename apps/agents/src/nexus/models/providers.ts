import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatGoogle } from "@langchain/google/node";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import { ZaiChatOpenAI } from "./zai-chat-model.js";
import type { ProviderId } from "./types.js";

export interface ModelBuildOptions {
  temperature?: number;
  maxTokens?: number;
}

/**
 * Thin factory wrappers for each supported provider. Call sites should not
 * instantiate chat models directly — go through `resolveTier` in `registry.ts`,
 * which enforces env-var availability before reaching these factories.
 */
// Z.AI is OpenAI-wire-compatible, so we reuse ChatOpenAI via ZaiChatOpenAI,
// a subclass that round-trips reasoning_content to preserve GLM thinking
// across multi-turn tool calls. Users on the GLM Coding Plan set ZAI_BASE_URL
// to `https://api.z.ai/api/coding/paas/v4` to hit the subscription endpoint.
const ZAI_DEFAULT_BASE_URL = "https://api.z.ai/api/paas/v4";

export const providerFactories: Record<
  ProviderId,
  (id: string, opts?: ModelBuildOptions) => BaseChatModel
> = {
  google: (id, opts) =>
    new ChatGoogle({ model: id, ...(opts ?? {}) }) as unknown as BaseChatModel,
  anthropic: (id, opts) =>
    new ChatAnthropic({ model: id, ...(opts ?? {}) }) as unknown as BaseChatModel,
  openai: (id, opts) =>
    new ChatOpenAI({ model: id, ...(opts ?? {}) }) as unknown as BaseChatModel,
  zai: (id, opts) =>
    new ZaiChatOpenAI({
      model: id,
      apiKey: process.env.ZAI_API_KEY,
      configuration: {
        baseURL: process.env.ZAI_BASE_URL ?? ZAI_DEFAULT_BASE_URL,
      },
      ...(opts ?? {}),
    }) as unknown as BaseChatModel,
};
