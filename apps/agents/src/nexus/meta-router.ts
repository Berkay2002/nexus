import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { z } from "zod/v4";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { NexusState } from "./state.js";

/**
 * Structured output schema for the meta-router.
 * Constrains model selection to the two supported Gemini models.
 */
export const routerOutputSchema = z.object({
  model: z
    .enum(["gemini-2.0-flash", "gemini-2.5-pro-preview-05-06"])
    .describe("The Gemini model to use for the orchestrator"),
  reasoning: z
    .string()
    .describe("Brief reasoning for the model selection (1-2 sentences)"),
});

export type RouterOutput = z.infer<typeof routerOutputSchema>;

const ROUTER_SYSTEM_PROMPT = `You are a silent request classifier. Your job is to analyze the user's prompt and decide which Gemini model should handle it.

Classification criteria:
- Intent complexity: Single-step task vs multi-step project
- Implied scope: Even vague prompts like "build me something cool" imply a large project requiring Pro
- Domain signals: Research-heavy, code-heavy, creative, or multi-domain
- Clarity: Specific enough to act on directly, or requires sophisticated planning

Model selection:
- "gemini-2.0-flash" — Simple, single-domain tasks. Quick answers, single sub-agent or no sub-agents needed. Examples: "What is X?", "Summarize this article", "Convert this CSV to JSON"
- "gemini-2.5-pro-preview-05-06" — Complex, multi-step, multi-domain tasks. Requires sophisticated planning, multiple sub-agents, or quality decomposition. Examples: "Build me a website", "Research X and write a report with visualizations", "Create a marketing campaign"

When in doubt, choose Pro. It's better to over-provision than under-provision.

Respond ONLY with the structured output. Do not include any other text.`;

/**
 * Meta-router LangGraph node.
 *
 * Always uses gemini-2.0-flash (fast, cheap) to classify the user's prompt.
 * Returns { routerResult } to be written to graph state.
 */
export async function metaRouter(
  state: NexusState,
): Promise<Pick<NexusState, "routerResult">> {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.0-flash",
    temperature: 0,
  });

  const structuredModel = model.withStructuredOutput(routerOutputSchema, {
    name: "RouterOutput",
  });

  const lastMessage = state.messages[state.messages.length - 1];
  const userContent =
    typeof lastMessage.content === "string"
      ? lastMessage.content
      : JSON.stringify(lastMessage.content);

  const result = await structuredModel.invoke([
    new SystemMessage(ROUTER_SYSTEM_PROMPT),
    new HumanMessage(userContent),
  ]);

  return {
    routerResult: {
      model: result.model,
      reasoning: result.reasoning,
    },
  };
}
