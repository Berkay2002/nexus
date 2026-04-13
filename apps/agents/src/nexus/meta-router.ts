import { z } from "zod/v4";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { resolveTier, buildTierFallbacks } from "./models/index.js";
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

type ComplexityLabel = RouterOutput["complexity"];

function isOutputParsingFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /OUTPUT_PARSING_FAILURE|Failed to parse|not valid JSON/i.test(
    error.message,
  );
}

function extractText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((part) => {
        if (typeof part === "string") return part;
        if (
          part &&
          typeof part === "object" &&
          "text" in part &&
          typeof (part as { text?: unknown }).text === "string"
        ) {
          return (part as { text: string }).text;
        }
        return "";
      })
      .join("\n");
  }
  return "";
}

function parseComplexityLabel(text: string): ComplexityLabel {
  const normalized = text.trim().toLowerCase();
  if (/\btrivial\b/.test(normalized)) return "trivial";
  return "default";
}

function coerceComplexity(value: unknown): ComplexityLabel {
  if (typeof value === "string" && value.trim().toLowerCase() === "trivial") {
    return "trivial";
  }
  return "default";
}

function tryParseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const candidates = [withoutFence];
  const firstBrace = withoutFence.indexOf("{");
  const lastBrace = withoutFence.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(withoutFence.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // ignore and try the next candidate
    }
  }

  return null;
}

function recoverRouterOutput(rawText: string): RouterOutput {
  const parsed = tryParseJsonObject(rawText);
  if (parsed) {
    const complexity = coerceComplexity(
      parsed.complexity ?? parsed.classification,
    );
    const reasoningRaw = parsed.reasoning;
    const reasoning =
      typeof reasoningRaw === "string" && reasoningRaw.trim().length > 0
        ? reasoningRaw
        : `Recovered from non-JSON classifier shape; normalized ${
            parsed.classification !== undefined && parsed.complexity === undefined
              ? "classification"
              : "complexity"
          } to ${complexity}.`;
    return { complexity, reasoning };
  }

  const complexity = parseComplexityLabel(rawText);
  return {
    complexity,
    reasoning:
      complexity === "trivial"
        ? "Recovered from non-JSON classifier output; interpreted label as trivial."
        : "Recovered from non-JSON classifier output; interpreted label as default.",
  };
}

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
  // Prefer the classifier tier; fall through to default if no classifier is
  // available. The fallback chain follows the tier we actually picked.
  const classifierPrimary = resolveTier("classifier", undefined, {
    temperature: 0,
  });
  const primary =
    classifierPrimary ?? resolveTier("default", undefined, { temperature: 0 });
  if (!primary) {
    throw new Error(
      "No model available for meta-router — set GOOGLE_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY, or ZAI_API_KEY",
    );
  }
  const fallbackModels = classifierPrimary
    ? buildTierFallbacks("classifier", { temperature: 0 })
    : buildTierFallbacks("default", { temperature: 0 });

  const primaryStructured = primary.withStructuredOutput(routerOutputSchema, {
    name: "RouterOutput",
  });
  const fallbackStructured = fallbackModels.map((m) =>
    m.withStructuredOutput(routerOutputSchema, { name: "RouterOutput" }),
  );
  const invoker =
    fallbackStructured.length > 0
      ? primaryStructured.withFallbacks({ fallbacks: fallbackStructured })
      : primaryStructured;

  const lastMessage = state.messages[state.messages.length - 1];
  const userContent =
    typeof lastMessage.content === "string"
      ? lastMessage.content
      : JSON.stringify(lastMessage.content);

  let result: RouterOutput;
  try {
    result = await invoker.invoke([
      new SystemMessage(ROUTER_SYSTEM_PROMPT),
      new HumanMessage(userContent),
    ]);
  } catch (error) {
    if (!isOutputParsingFailure(error)) {
      throw error;
    }

    const rawInvoker =
      fallbackModels.length > 0
        ? primary.withFallbacks({ fallbacks: fallbackModels })
        : primary;
    const rawResult = await rawInvoker.invoke([
      new SystemMessage(
        `${ROUTER_SYSTEM_PROMPT}\n\nIf strict JSON schema formatting fails, respond with only one token: trivial or default.`,
      ),
      new HumanMessage(userContent),
    ]);

    const rawText = extractText(rawResult.content);
    result = recoverRouterOutput(rawText);
  }

  return {
    routerResult: {
      complexity: result.complexity,
      reasoning: result.reasoning,
    },
  };
}
