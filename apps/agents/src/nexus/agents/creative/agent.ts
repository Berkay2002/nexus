import type { SubAgent } from "deepagents";
import { creativeTools } from "../../tools/index.js";
import { createGoogleModel } from "../../models.js";
import {
  CREATIVE_AGENT_NAME,
  CREATIVE_AGENT_DESCRIPTION,
  CREATIVE_SYSTEM_PROMPT,
} from "./prompt.js";

export const creativeAgent: SubAgent = {
  name: CREATIVE_AGENT_NAME,
  description: CREATIVE_AGENT_DESCRIPTION,
  systemPrompt: CREATIVE_SYSTEM_PROMPT,
  tools: [...creativeTools],
  model: createGoogleModel("gemini-3.1-flash-image-preview"),
};
