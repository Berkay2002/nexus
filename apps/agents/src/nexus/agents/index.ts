// apps/agents/src/nexus/agents/index.ts
import type { SubAgent } from "deepagents";

export { createResearchAgent } from "./research/agent.js";
export {
  RESEARCH_AGENT_NAME,
  RESEARCH_AGENT_DESCRIPTION,
  RESEARCH_SYSTEM_PROMPT,
} from "./research/prompt.js";

export { createCodeAgent } from "./code/agent.js";
export {
  CODE_AGENT_NAME,
  CODE_AGENT_DESCRIPTION,
  CODE_SYSTEM_PROMPT,
} from "./code/prompt.js";

export { createCreativeAgent } from "./creative/agent.js";
export {
  CREATIVE_AGENT_NAME,
  CREATIVE_AGENT_DESCRIPTION,
  CREATIVE_SYSTEM_PROMPT,
} from "./creative/prompt.js";

export { generalPurposeAgent } from "./general-purpose/agent.js";

import { createResearchAgent } from "./research/agent.js";
import { createCodeAgent } from "./code/agent.js";
import { createCreativeAgent } from "./creative/agent.js";
import { generalPurposeAgent } from "./general-purpose/agent.js";

/**
 * Build the list of Nexus sub-agents available given the current provider
 * environment. Only agents whose required model tier can be resolved are
 * included; the general-purpose agent is always present because it defers
 * model selection to the orchestrator.
 *
 * Note: All sub-agents get the `execute` tool auto-provisioned via the shared
 * sandbox backend — not just Code. This is accepted because filtering is not
 * supported by DeepAgents, and the Research/Creative prompts don't reference it.
 */
export function getNexusSubagents(): SubAgent[] {
  const agents: SubAgent[] = [generalPurposeAgent];
  const research = createResearchAgent();
  if (research) agents.push(research);
  const code = createCodeAgent();
  if (code) agents.push(code);
  const creative = createCreativeAgent();
  if (creative) agents.push(creative);
  return agents;
}
