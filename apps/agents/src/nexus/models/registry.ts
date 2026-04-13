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
  // Z.AI (GLM). OpenAI-wire-compatible; routed via ChatOpenAI + custom baseURL.
  // Users on the GLM Coding Plan set ZAI_BASE_URL to the /coding/ endpoint.
  {
    provider: "zai",
    id: "glm-4.7",
    label: "GLM-4.7",
    tiers: ["classifier", "default"],
    capabilities: { tools: true, images: false },
  },
  {
    provider: "zai",
    id: "glm-5-turbo",
    label: "GLM-5 Turbo",
    tiers: ["classifier", "default"],
    capabilities: { tools: true, images: false },
  },
  {
    provider: "zai",
    id: "glm-5.1",
    label: "GLM-5.1",
    tiers: ["default", "code", "deep-research"],
    capabilities: { tools: true, images: false },
  },
];

export const TIER_PRIORITY: Record<Tier, ProviderId[]> = {
  classifier: ["google", "anthropic", "openai", "zai"],
  default: ["anthropic", "openai", "zai", "google"],
  code: ["anthropic", "google", "openai", "zai"],
  "deep-research": ["google", "anthropic", "openai", "zai"],
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

/**
 * Resolve ONLY an explicit override, without any tier-priority fallback.
 * Returns null if the override is unparseable, not in the catalog, or its
 * provider isn't available. Use this when the caller needs to distinguish
 * "user's override worked" from "we silently picked something else".
 */
export function resolveOverride(
  override: string,
  options?: ModelBuildOptions,
): BaseChatModel | null {
  const descriptor = findOverrideDescriptor(override);
  if (!descriptor || !isProviderAvailable(descriptor.provider)) return null;
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

/**
 * Build the ordered fallback list for a tier — one model per *other* available
 * provider, in `TIER_PRIORITY[tier]` order, excluding whatever `resolveTier`
 * would pick as the primary. Used by `modelFallbackMiddleware` and the
 * meta-router's `withFallbacks` chain so that when the primary 429s we try
 * the next provider instead of throwing.
 */
export function buildTierFallbacks(
  tier: Tier,
  options?: ModelBuildOptions,
): BaseChatModel[] {
  const models: BaseChatModel[] = [];
  for (const provider of TIER_PRIORITY[tier]) {
    if (!isProviderAvailable(provider)) continue;
    const entry = MODEL_CATALOG.find(
      (m) => m.provider === provider && m.tiers.includes(tier),
    );
    if (!entry) continue;
    models.push(providerFactories[provider](entry.id, options));
  }
  return models.slice(1);
}
