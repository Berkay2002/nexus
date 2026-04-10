// apps/agents/src/nexus/agents/code/agent.ts
import type { SubAgent } from "deepagents";
import {
  CODE_AGENT_NAME,
  CODE_AGENT_DESCRIPTION,
  CODE_SYSTEM_PROMPT,
} from "./prompt.js";

/**
 * Code sub-agent.
 *
 * No custom tools — relies entirely on auto-provisioned sandbox tools:
 * execute (shell), ls, read_file, write_file, edit_file, glob, grep.
 * These are provided automatically because the orchestrator uses a
 * sandbox backend (AIOSandboxBackend via CompositeBackend).
 */
export const codeAgent: SubAgent = {
  name: CODE_AGENT_NAME,
  description: CODE_AGENT_DESCRIPTION,
  systemPrompt: CODE_SYSTEM_PROMPT,
  model: "google-genai:gemini-3.1-pro-preview",
};
