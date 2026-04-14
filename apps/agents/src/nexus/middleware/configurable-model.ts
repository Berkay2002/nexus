import { createMiddleware } from "langchain";
import { z } from "zod/v4";
import { resolveOverride } from "../models/index.js";

/**
 * APPROACH: Closure-per-agent factory
 *
 * WHY: The `wrapModelCall` `request.runtime` object exposes only
 *   { context, store, configurable, writer, interrupt, signal }
 * and neither `runtime` nor `request` carries an `agentName`. The
 * `configurable` map from LangGraph's RunnableConfig is NOT populated with
 * the calling agent's name by deepagents — sub-agents are invoked with the
 * same config the orchestrator received. The `lc_agent_name` ReactAgent sets
 * lives in `metadata`, which is never forwarded into the middleware runtime.
 *
 * SOLUTION: `createConfigurableModelMiddleware(agentName)` captures the
 * agent's name in a closure so each agent gets its own middleware instance
 * keyed by the DeepAgent's `name` field. The orchestrator binds to
 * `"nexus-orchestrator"`; sub-agents bind to their own names
 * (`"research"`, `"code"`, `"creative"`, `"general-purpose"`).
 *
 * CONTEXT SHAPE: `ctx.models` is a per-role map of `role → "provider:model-id"`
 * (or a bare id). Each middleware instance looks up ONLY the key matching
 * its bound agentName, so the map cannot leak across agents: the research
 * middleware cannot read the code middleware's override, and the
 * orchestrator's resolved model under `ctx.models["nexus-orchestrator"]`
 * cannot bleed into any sub-agent.
 *
 * Extra keys in the map are harmless — each middleware ignores anything
 * that isn't its own agentName.
 *
 * LEGACY NOTE: An earlier version of this middleware supported a shared
 * `ctx.model` single-string slot as a fallback. That slot was visible to
 * every agent and caused a cross-agent leak (the orchestrator's resolved
 * default-tier model silently overrode sub-agents' tier-resolved static
 * models). It has been removed. `orchestratorNode` now writes its resolved
 * model into `ctx.models["nexus-orchestrator"]` so it hits the same
 * Priority-1 path as every other agent.
 */

export const modelContextSchema = z.object({
  models: z
    .record(z.string(), z.string())
    .optional()
    .describe(
      "Per-role model overrides — map of agent name → 'provider:model-id' or bare id",
    ),
});

/**
 * Factory that creates a ConfigurableModel middleware instance bound to a
 * specific agent name.
 *
 * Resolution inside wrapModelCall:
 *   1. Look up `ctx.models[agentName]` — if set, resolve and use it.
 *   2. Otherwise pass through and use the agent's static model.
 *
 * Unresolvable overrides (provider missing, bad id) warn and pass through
 * rather than silently picking a different provider via tier-priority.
 *
 * @param agentName - The name of the agent this middleware is attached to
 */
export function createConfigurableModelMiddleware(agentName: string) {
  return createMiddleware({
    name: `ConfigurableModel:${agentName}`,
    contextSchema: modelContextSchema,
    wrapModelCall: async (request, handler) => {
      const ctx = request.runtime.context;
      if (!ctx) return handler(request);

      const override = ctx.models?.[agentName];
      if (!override) return handler(request);

      // Resolve the override strictly — no tier-priority fallback. If the
      // override can't be satisfied, warn and pass through to the agent's
      // static model rather than silently picking an unrelated provider.
      const model = resolveOverride(override);
      if (!model) {
        console.warn(
          `[ConfigurableModel:${agentName}] override "${override}" could not be resolved — falling back to the agent's static model. Set a provider API key (GEMINI_API_KEY, GOOGLE_API_KEY, GOOGLE_CLOUD_PROJECT, ANTHROPIC_API_KEY, OPENAI_API_KEY) for the chosen model, or pick a different model.`,
        );
        return handler(request);
      }

      return handler({ ...request, model });
    },
  });
}

/**
 * Pre-built middleware instance for the orchestrator agent.
 * Kept as a named export so existing `orchestrator.ts` import is unchanged.
 */
export const configurableModelMiddleware =
  createConfigurableModelMiddleware("nexus-orchestrator");
