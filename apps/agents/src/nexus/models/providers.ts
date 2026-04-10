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
// Z.AI is OpenAI-wire-compatible, so we reuse ChatOpenAI pointed at the z.ai
// base URL. Users on the GLM Coding Plan set ZAI_BASE_URL to
// `https://api.z.ai/api/coding/paas/v4` to hit the subscription endpoint.
const ZAI_DEFAULT_BASE_URL = "https://api.z.ai/api/paas/v4";

// Thinking is enabled by default on GLM-5.1 / GLM-4.7, but LangChain's
// ChatOpenAI silently drops `reasoning_content` between turns, so multi-turn
// tool-using agents lose chain-of-thought continuity and (on the Coding Plan)
// cache hits. Until we ship a proper round-trip middleware, disable thinking
// explicitly so behavior is predictable. See follow-up memory
// `project_zai_thinking_middleware.md`.
const ZAI_DISABLE_THINKING = { thinking: { type: "disabled" } } as const;

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
    new ChatOpenAI({
      model: id,
      apiKey: process.env.ZAI_API_KEY,
      configuration: {
        baseURL: process.env.ZAI_BASE_URL ?? ZAI_DEFAULT_BASE_URL,
      },
      modelKwargs: { ...ZAI_DISABLE_THINKING },
      ...(opts ?? {}),
    }) as unknown as BaseChatModel,
};
