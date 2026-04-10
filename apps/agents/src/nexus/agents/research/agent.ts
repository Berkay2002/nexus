import type { SubAgent } from "deepagents";
import { researchTools } from "../../tools/index.js";
import { resolveTier } from "../../models/index.js";
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
 */
export function createResearchAgent(): SubAgent | null {
  const model = resolveTier("deep-research");
  if (!model) return null;
  return {
    name: RESEARCH_AGENT_NAME,
    description: RESEARCH_AGENT_DESCRIPTION,
    systemPrompt: RESEARCH_SYSTEM_PROMPT,
    tools: [...researchTools],
    model,
  };
}
