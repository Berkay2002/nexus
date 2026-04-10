import { createMiddleware } from "langchain";
import { z } from "zod/v4";
import { createGoogleModel } from "../models.js";

/**
 * Context schema for model selection.
 * The `model` field is optional — when absent, the default model is used.
 */
export const modelContextSchema = z.object({
  model: z
    .string()
    .optional()
    .describe("Gemini model name to use (e.g., 'gemini-3-flash-preview')"),
});

/**
 * ConfigurableModel middleware.
 *
 * Intercepts every model call and swaps the model if `runtime.context.model`
 * is set. Uses `createGoogleModel` so the resulting ChatGoogle picks up the
 * same env-driven platform auto-detection (Vertex ADC vs AI Studio API key)
 * used everywhere else in apps/agents.
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
    const model = createGoogleModel(modelName);
    return handler({ ...request, model });
  },
});
