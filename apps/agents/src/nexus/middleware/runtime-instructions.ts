import { createMiddleware } from "langchain";
import { z } from "zod/v4";

export const runtimeInstructionsContextSchema = z.object({
  runtimeInstructions: z
    .string()
    .optional()
    .describe("Hidden runtime guidance appended to the model system prompt"),
});

export function createRuntimeInstructionsMiddleware(agentName: string) {
  return createMiddleware({
    name: `RuntimeInstructions:${agentName}`,
    contextSchema: runtimeInstructionsContextSchema,
    wrapModelCall: async (request, handler) => {
      const runtimeInstructions = request.runtime.context?.runtimeInstructions;
      if (
        typeof runtimeInstructions !== "string" ||
        runtimeInstructions.trim().length === 0
      ) {
        return handler(request);
      }

      const baseSystemPrompt = request.systemPrompt ?? "";
      const mergedSystemPrompt =
        baseSystemPrompt.trim().length > 0
          ? `${baseSystemPrompt}\n\n## Runtime Constraints\n${runtimeInstructions}`
          : `## Runtime Constraints\n${runtimeInstructions}`;

      return handler({ ...request, systemPrompt: mergedSystemPrompt });
    },
  });
}
