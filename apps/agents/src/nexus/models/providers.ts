import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatGoogle } from "@langchain/google/node";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
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
};
