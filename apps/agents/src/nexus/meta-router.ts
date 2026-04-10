import { z } from "zod/v4";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createGoogleModel } from "./models.js";
import type { NexusState } from "./state.js";

/**
 * Structured output schema for the meta-router.
 *
 * The router picks the *orchestrator* model — Gemini 3.1 Pro is reserved for
 * the deep-research sub-agent and must never be selected here. The router
 * chooses between Flash (the default workhorse) and Flash-Lite (ultra-cheap,
 * low-latency tier for trivially simple prompts).
 */
export const routerOutputSchema = z.object({
  model: z
    .enum(["gemini-3.1-flash-lite-preview", "gemini-3-flash-preview"])
    .describe("The Gemini model to use for the orchestrator"),
  reasoning: z
    .string()
    .describe("Brief reasoning for the model selection (1-2 sentences)"),
});

export type RouterOutput = z.infer<typeof routerOutputSchema>;

const ROUTER_SYSTEM_PROMPT = `You are a silent request classifier. Your job is to analyze the user's prompt and decide which Gemini model the orchestrator should run on.

Classification criteria:
- Intent complexity: Trivial one-shot answer vs. multi-step task requiring planning and delegation
- Implied scope: Does this need sub-agents (research, code, creative) at all?
- Domain signals: Research-heavy, code-heavy, creative, or multi-domain

Model selection:
- "gemini-3.1-flash-lite-preview" — Trivial, high-frequency, low-latency tasks that need neither sub-agents nor multi-step planning. Examples: "What is 2+2?", "Rephrase this sentence", "What's the capital of France?", "Summarize this short paragraph".
- "gemini-3-flash-preview" — Everything else. The default. Any prompt that plausibly needs the orchestrator to plan, use tools, or delegate to a sub-agent. Examples: "Research X and write a report", "Build me a website", "Analyze this dataset", "Create a marketing campaign".

When in doubt, choose "gemini-3-flash-preview". Never select a Pro model — deep reasoning is handled by the deep-research sub-agent downstream, not the orchestrator.

Respond ONLY with the structured output. Do not include any other text.`;

/**
 * Meta-router LangGraph node.
 *
 * Uses gemini-3.1-flash-lite-preview (fastest, cheapest) as the classifier.
 * Returns { routerResult } to be written to graph state.
 */
export async function metaRouter(
  state: NexusState,
): Promise<Pick<NexusState, "routerResult">> {
  const model = createGoogleModel("gemini-3.1-flash-lite-preview", {
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
