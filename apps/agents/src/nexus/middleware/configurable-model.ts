import { createMiddleware } from "langchain";
import { z } from "zod/v4";
import { resolveOverride } from "../models/index.js";

/**
 * APPROACH: Closure-per-agent factory (Approach 3)
 *
 * WHY: The `wrapModelCall` `request.runtime` object contains only these fields:
 *   { context, store, configurable, writer, interrupt, signal }
 * Neither `runtime` nor `request` carries an `agentName` field. The
 * `configurable` map comes from the LangGraph RunnableConfig and is NOT
 * populated with the calling agent's name by deepagents — deepagents invokes
 * sub-agents with the same config it received (pass-through). The
 * `lc_agent_name` that ReactAgent sets lives in `metadata`, which is never
 * forwarded into the middleware runtime. Approaches 1 and 2 are therefore not
 * viable.
 *
 * SOLUTION: Export a `createConfigurableModelMiddleware(agentName)` factory.
 * Each agent gets its own middleware instance with the agent name captured in
 * the closure. The orchestrator uses `createConfigurableModelMiddleware("nexus-orchestrator")`.
 * Sub-agents call the factory with their own name and attach the result via
 * `SubAgent.middleware`.
 *
 * The legacy named export `configurableModelMiddleware` is kept (as a
 * re-export pointing at the orchestrator instance) so no existing imports break.
 */

/**
 * Context schema for model selection.
 *
 * `model` — legacy single-string override used by orchestratorNode to pass
 * the classifier-translated model to the orchestrator.
 *
 * `models` — per-role map of `role → "provider:model-id"` (or bare id).
 * Sub-agent role keys match each agent's `name` field: "research", "code",
 * "creative", "general-purpose". The orchestrator is a special case: its
 * middleware instance is bound to "nexus-orchestrator" (the DeepAgent name),
 * but the frontend sends the key as "orchestrator"; `orchestratorNode`
 * unpacks `models.orchestrator` and re-injects it via the legacy `ctx.model`
 * path, so this middleware's Priority-2 branch handles orchestrator overrides.
 * Extra keys are harmless — middleware only looks up the key matching its
 * bound agent name.
 */
export const modelContextSchema = z.object({
  model: z
    .string()
    .optional()
    .describe(
      "Legacy model override — bare id (e.g., 'gemini-3-flash-preview') or 'provider:id'",
    ),
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
 * Priority inside wrapModelCall:
 *   1. Per-role override from `ctx.models[agentName]`
 *   2. Legacy single-model override from `ctx.model`
 *   3. Pass through (use the agent's static model)
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

      // Priority 1: per-role override for this specific agent
      const perRoleOverride = ctx.models?.[agentName];
      // Priority 2: legacy single-model override
      const override = perRoleOverride ?? ctx.model;

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
