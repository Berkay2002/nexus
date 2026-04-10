import { createMiddleware } from "langchain";
import { initChatModel } from "langchain/chat_models/universal";
import { z } from "zod/v4";

/**
 * Context schema for model selection.
 * The `model` field is optional — when absent, the default model is used.
 */
export const modelContextSchema = z.object({
  model: z.string().optional().describe("Model name to use (e.g., 'google-genai:gemini-3-flash-preview')"),
});

/**
 * ConfigurableModel middleware.
 *
 * Intercepts every model call and swaps the model if `runtime.context.model` is set.
 * Uses `initChatModel` from langchain to dynamically resolve the model by name.
 *
 * Usage: Pass as middleware to createDeepAgent, and invoke the agent with
 * `{ context: { model: "google-genai:gemini-3-flash-preview" } }` to override.
 */
export const configurableModelMiddleware = createMiddleware({
  name: "ConfigurableModel",
  contextSchema: modelContextSchema,
  wrapModelCall: async (request, handler) => {
    const modelName = request.runtime.context?.model;
    if (!modelName) {
      // No model override — use the default
      return handler(request);
    }
    const model = await initChatModel(modelName);
    return handler({ ...request, model });
  },
});
