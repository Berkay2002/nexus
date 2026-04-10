// apps/agents/src/nexus/agents/index.ts
export { researchAgent } from "./research/agent.js";
export {
  RESEARCH_AGENT_NAME,
  RESEARCH_AGENT_DESCRIPTION,
  RESEARCH_SYSTEM_PROMPT,
} from "./research/prompt.js";

export { codeAgent } from "./code/agent.js";
export {
  CODE_AGENT_NAME,
  CODE_AGENT_DESCRIPTION,
  CODE_SYSTEM_PROMPT,
} from "./code/prompt.js";

export { creativeAgent } from "./creative/agent.js";
export {
  CREATIVE_AGENT_NAME,
  CREATIVE_AGENT_DESCRIPTION,
  CREATIVE_SYSTEM_PROMPT,
} from "./creative/prompt.js";

export { generalPurposeAgent } from "./general-purpose/agent.js";

import { researchAgent } from "./research/agent.js";
import { codeAgent } from "./code/agent.js";
import { creativeAgent } from "./creative/agent.js";
import { generalPurposeAgent } from "./general-purpose/agent.js";

/**
 * All Nexus sub-agents, ready to pass to createDeepAgent({ subagents }).
 * Includes the general-purpose override to prevent DeepAgents from
 * adding an uncontrolled default agent.
 *
 * Note: All sub-agents get the `execute` tool auto-provisioned via the shared
 * sandbox backend — not just Code. This is accepted because filtering is not
 * supported by DeepAgents, and the Research/Creative prompts don't reference it.
 */
export const nexusSubagents = [
  researchAgent,
  codeAgent,
  creativeAgent,
  generalPurposeAgent,
] as const;
