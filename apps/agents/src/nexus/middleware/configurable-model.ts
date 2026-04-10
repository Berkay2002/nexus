import { createMiddleware } from "langchain";
import { z } from "zod/v4";
import { resolveTier } from "../models/index.js";

/**
 * Context schema for model selection.
 * The `model` field is optional — when absent, the default model is used.
 */
export const modelContextSchema = z.object({
  model: z
    .string()
    .optional()
    .describe(
      "Model override — bare id (e.g., 'gemini-3-flash-preview') or 'provider:id'",
    ),
});

/**
 * ConfigurableModel middleware.
 *
 * Intercepts every model call and swaps the model if `runtime.context.model`
 * is set. The override string is passed to `resolveTier("default", override)`
 * which accepts a bare id or `provider:id` syntax and enforces provider
 * availability.
 *
 * Task 3 will extend this with per-role routing via a `models` map.
 *
 * Usage: Pass as middleware to createDeepAgent, and invoke the agent with
 * `{ context: { model: "gemini-3-flash-preview" } }` to override.
 */
export const configurableModelMiddleware = createMiddleware({
  name: "ConfigurableModel",
  contextSchema: modelContextSchema,
  wrapModelCall: async (request, handler) => {
    const modelName = request.runtime.context?.model;
    if (!modelName) {
      return handler(request);
    }
    const model = resolveTier("default", modelName);
    if (!model) {
      return handler(request);
    }
    return handler({ ...request, model });
  },
});
