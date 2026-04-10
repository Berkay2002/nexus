import type { SubAgent } from "deepagents";
import { creativeTools } from "../../tools/index.js";
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
  model: "google-genai:gemini-3.1-flash-image-preview",
};
