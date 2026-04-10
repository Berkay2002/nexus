import { z } from "zod/v4";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { resolveTier } from "./models/index.js";
import type { NexusState } from "./state.js";

/**
 * Structured output schema for the meta-router.
 *
 * The router emits an abstract complexity label, not a provider-specific model
 * name. The orchestrator node translates the label into a concrete model via
 * the tier-based model registry.
 */
export const routerOutputSchema = z.object({
  complexity: z
    .enum(["trivial", "default"])
    .describe("Complexity of the request"),
  reasoning: z
    .string()
    .describe("Brief reasoning for the classification (1-2 sentences)"),
});

export type RouterOutput = z.infer<typeof routerOutputSchema>;

const ROUTER_SYSTEM_PROMPT = `You are a silent request classifier. Your job is to analyze the user's prompt and decide how complex it is so the system can pick an appropriately sized model for the orchestrator.

Classification criteria:
- Intent complexity: trivial one-shot answer vs. multi-step task requiring planning and delegation
- Implied scope: does this need sub-agents (research, code, creative) at all?
- Domain signals: research-heavy, code-heavy, creative, or multi-domain

Labels:
- "trivial" — high-frequency one-shot tasks that need neither sub-agent delegation nor multi-step planning. Examples: "What is 2+2?", "Rephrase this sentence", "What's the capital of France?", "Summarize this short paragraph".
- "default" — everything else. Any prompt that plausibly needs the orchestrator to plan, use tools, or delegate to a sub-agent. Examples: "Research X and write a report", "Build me a website", "Analyze this dataset", "Create a marketing campaign".

When in doubt, choose "default".

Respond ONLY with the structured output. Do not include any other text.`;

/**
 * Meta-router LangGraph node.
 *
 * Uses the classifier-tier model (cheapest/fastest) as the classifier, falling
 * back to the default tier if no classifier-specific model is available.
 * Returns { routerResult } to be written to graph state.
 */
export async function metaRouter(
  state: NexusState,
): Promise<Pick<NexusState, "routerResult">> {
  const model =
    resolveTier("classifier", undefined, { temperature: 0 }) ??
    resolveTier("default", undefined, { temperature: 0 });
  if (!model) {
    throw new Error(
      "No model available for meta-router — set GOOGLE_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY",
    );
  }

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
      complexity: result.complexity,
      reasoning: result.reasoning,
    },
  };
}
