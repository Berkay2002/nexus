// apps/agents/src/nexus/agents/general-purpose/agent.ts
import type { SubAgent } from "deepagents";
import { buildTierFallbacks } from "../../models/index.js";
import { createConfigurableModelMiddleware } from "../../middleware/configurable-model.js";
import { createModelFallbackMiddleware } from "../../middleware/model-fallback.js";
import {
  DEFAULT_WORKSPACE_ROOT,
  renderWorkspaceTemplate,
} from "../../backend/workspace.js";

const GENERAL_PURPOSE_SYSTEM_PROMPT_TEMPLATE = `You are a general-purpose assistant for Nexus. You handle miscellaneous tasks that don't fit the specialized sub-agents (Research, Code, Creative).

## When You Should Be Used
- Text formatting, summarization, or rewriting tasks
- Simple calculations or data transformations
- Tasks that combine multiple domains but are too small to warrant multiple specialized agents
- Clarification or elaboration on previous results

## Output Requirements
- Write outputs to {workspaceRoot}/orchestrator/ if file output is needed — this is your absolute, thread-scoped workspace path. Use it in full whenever you call filesystem tools.
- Return concise responses directly when possible
- Keep filesystem usage minimal — you're for lightweight tasks

## Shared Workspace
All agents share a **unified filesystem** in the AIO Sandbox. You can read files from ANY path under {workspaceRoot}/ — not just your own output directory. Use \`ls {workspaceRoot}/\` to explore what exists from other agents.

## Guidelines
- If the task would be better handled by Research (web search), Code (execution), or Creative (images), say so in your response
- You have filesystem tools (ls, read_file, write_file, etc.) but no specialized tools
- Keep responses focused and concise`;

const generalPurposeFallbacks = buildTierFallbacks("default");
const generalPurposeMiddleware = [
  createConfigurableModelMiddleware("general-purpose"),
  ...(generalPurposeFallbacks.length > 0
    ? [createModelFallbackMiddleware("general-purpose", generalPurposeFallbacks)]
    : []),
];

/**
 * General-purpose subagent override.
 *
 * DeepAgents always adds a default general-purpose subagent that inherits
 * all tools and skills from the main agent. By passing a SubAgent with
 * name "general-purpose", we override it with controlled behavior.
 *
 * This override instructs the GP agent to suggest using specialized agents
 * instead of attempting tasks itself, acting as a fallback for truly
 * miscellaneous work that doesn't fit Research, Code, or Creative.
 */
export function createGeneralPurposeAgent(
  workspaceRoot: string = DEFAULT_WORKSPACE_ROOT,
): SubAgent {
  return {
    name: "general-purpose",
    middleware: generalPurposeMiddleware,
    description:
      "General-purpose assistant for miscellaneous tasks that don't fit Research, Code, or Creative. " +
      "Use only when no specialized agent is appropriate. Prefer specialized agents for better results.",
    systemPrompt: renderWorkspaceTemplate(
      GENERAL_PURPOSE_SYSTEM_PROMPT_TEMPLATE,
      workspaceRoot,
    ),
  };
}

/**
 * Back-compat default export (uses DEFAULT_WORKSPACE_ROOT).
 * Prefer `createGeneralPurposeAgent(workspaceRoot)` so the GP agent learns
 * the thread-scoped workspace path like other sub-agents.
 */
export const generalPurposeAgent: SubAgent = createGeneralPurposeAgent();
