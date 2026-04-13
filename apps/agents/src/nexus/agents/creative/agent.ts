import type { SubAgent } from "deepagents";
import { creativeTools } from "../../tools/index.js";
import { resolveTier, buildTierFallbacks } from "../../models/index.js";
import { createConfigurableModelMiddleware } from "../../middleware/configurable-model.js";
import { createModelFallbackMiddleware } from "../../middleware/model-fallback.js";
import {
  CREATIVE_AGENT_NAME,
  CREATIVE_AGENT_DESCRIPTION,
  CREATIVE_SYSTEM_PROMPT,
} from "./prompt.js";

/**
 * Creative sub-agent factory.
 *
 * Returns `null` if no provider is available for the image tier.
 */
export function createCreativeAgent(): SubAgent | null {
  const model = resolveTier("image");
  if (!model) return null;
  const fallbacks = buildTierFallbacks("image");
  const middleware = [
    createConfigurableModelMiddleware(CREATIVE_AGENT_NAME),
    ...(fallbacks.length > 0
      ? [createModelFallbackMiddleware(CREATIVE_AGENT_NAME, fallbacks)]
      : []),
  ];
  return {
    name: CREATIVE_AGENT_NAME,
    description: CREATIVE_AGENT_DESCRIPTION,
    systemPrompt: CREATIVE_SYSTEM_PROMPT,
    tools: [...creativeTools],
    model,
    middleware,
  };
}
