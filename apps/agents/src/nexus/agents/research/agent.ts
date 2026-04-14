import type { SubAgent } from "deepagents";
import { researchTools } from "../../tools/index.js";
import { resolveTier, buildTierFallbacks } from "../../models/index.js";
import { createConfigurableModelMiddleware } from "../../middleware/configurable-model.js";
import { createModelFallbackMiddleware } from "../../middleware/model-fallback.js";
import {
  DEFAULT_WORKSPACE_ROOT,
  renderWorkspaceTemplate,
} from "../../backend/workspace.js";
import {
  RESEARCH_AGENT_NAME,
  RESEARCH_AGENT_DESCRIPTION,
  RESEARCH_SYSTEM_PROMPT,
} from "./prompt.js";

/**
 * Research sub-agent factory.
 *
 * Returns `null` if no provider is available for the deep-research tier.
 * Note: exa_search omitted per project decision — Tavily only, no Exa.
 *
 * @param workspaceRoot - Thread-scoped absolute workspace root. `{workspaceRoot}`
 *   placeholders in the system prompt are substituted with this value so the
 *   agent learns its full, real filesystem path.
 */
export function createResearchAgent(
  workspaceRoot: string = DEFAULT_WORKSPACE_ROOT,
): SubAgent | null {
  const model = resolveTier("deep-research");
  if (!model) return null;
  const fallbacks = buildTierFallbacks("deep-research");
  const middleware = [
    createConfigurableModelMiddleware(RESEARCH_AGENT_NAME),
    ...(fallbacks.length > 0
      ? [createModelFallbackMiddleware(RESEARCH_AGENT_NAME, fallbacks)]
      : []),
  ];
  return {
    name: RESEARCH_AGENT_NAME,
    description: RESEARCH_AGENT_DESCRIPTION,
    systemPrompt: renderWorkspaceTemplate(
      RESEARCH_SYSTEM_PROMPT,
      workspaceRoot,
    ),
    tools: [...researchTools],
    model,
    middleware,
  };
}
