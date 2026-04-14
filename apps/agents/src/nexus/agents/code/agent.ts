// apps/agents/src/nexus/agents/code/agent.ts
import type { SubAgent } from "deepagents";
import { codeTools } from "../../tools/index.js";
import { resolveTier, buildTierFallbacks } from "../../models/index.js";
import { createConfigurableModelMiddleware } from "../../middleware/configurable-model.js";
import { createModelFallbackMiddleware } from "../../middleware/model-fallback.js";
import {
  DEFAULT_WORKSPACE_ROOT,
  renderWorkspaceTemplate,
} from "../../backend/workspace.js";
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
 * Includes runtime API tools (sandbox_code_execute, sandbox_jupyter_*),
 * while still benefiting from auto-provisioned sandbox tools from the
 * backend (execute shell + filesystem helpers).
 *
 * @param workspaceRoot - Thread-scoped absolute workspace root. `{workspaceRoot}`
 *   placeholders in the system prompt are substituted with this value so the
 *   agent learns its full, real filesystem path.
 */
export function createCodeAgent(
  workspaceRoot: string = DEFAULT_WORKSPACE_ROOT,
): SubAgent | null {
  const model = resolveTier("code");
  if (!model) return null;
  const fallbacks = buildTierFallbacks("code");
  const middleware = [
    createConfigurableModelMiddleware(CODE_AGENT_NAME),
    ...(fallbacks.length > 0
      ? [createModelFallbackMiddleware(CODE_AGENT_NAME, fallbacks)]
      : []),
  ];
  return {
    name: CODE_AGENT_NAME,
    description: CODE_AGENT_DESCRIPTION,
    systemPrompt: renderWorkspaceTemplate(CODE_SYSTEM_PROMPT, workspaceRoot),
    tools: [...codeTools],
    model,
    middleware,
  };
}
