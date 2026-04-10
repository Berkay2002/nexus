// apps/agents/src/nexus/agents/general-purpose/agent.ts
import type { SubAgent } from "deepagents";
import { createConfigurableModelMiddleware } from "../../middleware/configurable-model.js";

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
export const generalPurposeAgent: SubAgent = {
  name: "general-purpose",
  middleware: [createConfigurableModelMiddleware("general-purpose")] as const,
  description:
    "General-purpose assistant for miscellaneous tasks that don't fit Research, Code, or Creative. " +
    "Use only when no specialized agent is appropriate. Prefer specialized agents for better results.",
  systemPrompt: `You are a general-purpose assistant for Nexus. You handle miscellaneous tasks that don't fit the specialized sub-agents (Research, Code, Creative).

## When You Should Be Used
- Text formatting, summarization, or rewriting tasks
- Simple calculations or data transformations
- Tasks that combine multiple domains but are too small to warrant multiple specialized agents
- Clarification or elaboration on previous results

## Output Requirements
- Write outputs to /home/gem/workspace/orchestrator/ if file output is needed
- Return concise responses directly when possible
- Keep filesystem usage minimal — you're for lightweight tasks

## Guidelines
- If the task would be better handled by Research (web search), Code (execution), or Creative (images), say so in your response
- You have filesystem tools (ls, read_file, write_file, etc.) but no specialized tools
- Keep responses focused and concise`,
};
