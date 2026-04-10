// apps/agents/src/nexus/agents/code/agent.ts
import type { SubAgent } from "deepagents";
import { resolveTier } from "../../models/index.js";
import {
  CODE_AGENT_NAME,
  CODE_AGENT_DESCRIPTION,
  CODE_SYSTEM_PROMPT,
} from "./prompt.js";

/**
 * Code sub-agent factory.
 *
 * Returns `null` if no provider is available for the code tier.
 *
 * No custom tools — relies entirely on auto-provisioned sandbox tools:
 * execute (shell), ls, read_file, write_file, edit_file, glob, grep.
 * These are provided automatically because the orchestrator uses a
 * sandbox backend (AIOSandboxBackend via CompositeBackend).
 */
export function createCodeAgent(): SubAgent | null {
  const model = resolveTier("code");
  if (!model) return null;
  return {
    name: CODE_AGENT_NAME,
    description: CODE_AGENT_DESCRIPTION,
    systemPrompt: CODE_SYSTEM_PROMPT,
    model,
  };
}
