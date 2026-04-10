import type { SubAgent } from "deepagents";
import { researchTools } from "../../tools/index.js";
import { createGoogleModel } from "../../models.js";
import {
  RESEARCH_AGENT_NAME,
  RESEARCH_AGENT_DESCRIPTION,
  RESEARCH_SYSTEM_PROMPT,
} from "./prompt.js";

// Note: exa_search omitted per project decision — Tavily only, no Exa (see CLAUDE.md)
export const researchAgent: SubAgent = {
  name: RESEARCH_AGENT_NAME,
  description: RESEARCH_AGENT_DESCRIPTION,
  systemPrompt: RESEARCH_SYSTEM_PROMPT,
  tools: [...researchTools],
  model: createGoogleModel("gemini-3.1-pro-preview"),
};
