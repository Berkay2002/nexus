import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { isProviderAvailable } from "./availability.js";
import { providerFactories, type ModelBuildOptions } from "./providers.js";
import type { ModelDescriptor, ProviderId, Tier } from "./types.js";

export const MODEL_CATALOG: ModelDescriptor[] = [
  // Google
  {
    provider: "google",
    id: "gemini-3.1-flash-lite-preview",
    label: "Gemini 3.1 Flash Lite",
    tiers: ["classifier"],
    capabilities: { tools: true, images: false },
  },
  {
    provider: "google",
    id: "gemini-3-flash-preview",
    label: "Gemini 3 Flash",
    tiers: ["default", "code"],
    capabilities: { tools: true, images: false },
  },
  {
    provider: "google",
    id: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro",
    tiers: ["deep-research"],
    capabilities: { tools: true, images: false },
  },
  {
    provider: "google",
    id: "gemini-3.1-flash-image-preview",
    label: "Gemini 3.1 Flash Image",
    tiers: ["image"],
    capabilities: { tools: true, images: true },
  },
  // Anthropic
  {
    provider: "anthropic",
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    tiers: ["classifier", "default"],
    capabilities: { tools: true, images: false },
  },
  {
    provider: "anthropic",
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    tiers: ["default", "code", "deep-research"],
    capabilities: { tools: true, images: false },
  },
  {
    provider: "anthropic",
    id: "claude-opus-4-6",
    label: "Claude Opus 4.6",
    tiers: ["code", "deep-research"],
    capabilities: { tools: true, images: false },
  },
  // OpenAI
  {
    provider: "openai",
    id: "gpt-5.4-nano",
    label: "GPT-5.4 nano",
    tiers: ["classifier"],
    capabilities: { tools: true, images: false },
  },
  {
    provider: "openai",
    id: "gpt-5.4-mini",
    label: "GPT-5.4 mini",
    tiers: ["classifier", "default", "code"],
    capabilities: { tools: true, images: false },
  },
  {
    provider: "openai",
    id: "gpt-5.4",
    label: "GPT-5.4",
    tiers: ["default", "code", "deep-research"],
    capabilities: { tools: true, images: false },
  },
];

export const TIER_PRIORITY: Record<Tier, ProviderId[]> = {
  classifier: ["google", "anthropic", "openai"],
  default: ["google", "anthropic", "openai"],
  code: ["anthropic", "google", "openai"],
  "deep-research": ["google", "anthropic", "openai"],
  image: ["google"],
};

/**
 * Parses an override string of shape `"provider:id"` or a bare `"id"` and
 * returns the matching catalog descriptor, or null if nothing matches.
 */
function findOverrideDescriptor(override: string): ModelDescriptor | null {
  const colonIdx = override.indexOf(":");
  if (colonIdx > 0) {
    const provider = override.slice(0, colonIdx) as ProviderId;
    const id = override.slice(colonIdx + 1);
    return (
      MODEL_CATALOG.find((m) => m.provider === provider && m.id === id) ?? null
    );
  }
  return MODEL_CATALOG.find((m) => m.id === override) ?? null;
}

function findTierDescriptor(tier: Tier): ModelDescriptor | null {
  for (const provider of TIER_PRIORITY[tier]) {
    if (!isProviderAvailable(provider)) continue;
    const entry = MODEL_CATALOG.find(
      (m) => m.provider === provider && m.tiers.includes(tier),
    );
    if (entry) return entry;
  }
  return null;
}

export function resolveTier(
  tier: Tier,
  override?: string,
  options?: ModelBuildOptions,
): BaseChatModel | null {
  if (override) {
    const descriptor = findOverrideDescriptor(override);
    if (descriptor && isProviderAvailable(descriptor.provider)) {
      return providerFactories[descriptor.provider](descriptor.id, options);
    }
    // Fall through to priority resolution.
  }
  const descriptor = findTierDescriptor(tier);
  if (!descriptor) return null;
  return providerFactories[descriptor.provider](descriptor.id, options);
}

export function listAvailableModels(): ModelDescriptor[] {
  return MODEL_CATALOG.filter((m) => isProviderAvailable(m.provider));
}

export function isTierAvailable(tier: Tier): boolean {
  return findTierDescriptor(tier) !== null;
}

export function getTierDefault(tier: Tier): ModelDescriptor | null {
  return findTierDescriptor(tier);
}
