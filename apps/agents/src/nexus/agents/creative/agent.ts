import type { SubAgent } from "deepagents";
import { creativeTools } from "../../tools/index.js";
import { resolveTier, buildTierFallbacks } from "../../models/index.js";
import { createConfigurableModelMiddleware } from "../../middleware/configurable-model.js";
import { createModelFallbackMiddleware } from "../../middleware/model-fallback.js";
import {
  DEFAULT_WORKSPACE_ROOT,
  renderWorkspaceTemplate,
} from "../../backend/workspace.js";
import {
  CREATIVE_AGENT_NAME,
  CREATIVE_AGENT_DESCRIPTION,
  CREATIVE_SYSTEM_PROMPT,
} from "./prompt.js";

/**
 * Creative sub-agent factory.
 *
 * Returns `null` if no provider is available for the image tier.
 *
 * @param workspaceRoot - Thread-scoped absolute workspace root. `{workspaceRoot}`
 *   placeholders in the system prompt are substituted with this value so the
 *   agent learns its full, real filesystem path.
 */
export function createCreativeAgent(
  workspaceRoot: string = DEFAULT_WORKSPACE_ROOT,
): SubAgent | null {
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
    systemPrompt: renderWorkspaceTemplate(
      CREATIVE_SYSTEM_PROMPT,
      workspaceRoot,
    ),
    tools: [...creativeTools],
    model,
    middleware,
  };
}
