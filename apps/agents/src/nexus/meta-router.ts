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

function collectErrorText(error: unknown, seen = new Set<unknown>()): string[] {
  if (error == null) return [];
  if (seen.has(error)) return [];

  if (typeof error === "string") {
    return [error];
  }

  if (error instanceof Error) {
    seen.add(error);
    const parts = [error.message, error.toString()];
    const cause = (error as Error & { cause?: unknown }).cause;
    if (cause !== undefined) {
      parts.push(...collectErrorText(cause, seen));
    }
    return parts.filter((part): part is string => Boolean(part));
  }

  if (typeof error === "object") {
    seen.add(error);
    const parts: string[] = [];
    const record = error as Record<string, unknown>;

    if (typeof record.message === "string") {
      parts.push(record.message);
    }
    if (typeof record.error === "string") {
      parts.push(record.error);
    }
    if (typeof record.toString === "function") {
      const rendered = record.toString();
      if (typeof rendered === "string" && rendered !== "[object Object]") {
        parts.push(rendered);
      }
    }

    for (const nestedKey of ["cause", "errors"]) {
      const nested = record[nestedKey];
      if (Array.isArray(nested)) {
        for (const item of nested) {
          parts.push(...collectErrorText(item, seen));
        }
      } else if (nested !== undefined) {
        parts.push(...collectErrorText(nested, seen));
      }
    }

    return parts;
  }

  return [String(error)];
}

function isOutputParsingFailure(error: unknown): boolean {
  const corpus = collectErrorText(error).join("\n");
  return /OUTPUT_PARSING_FAILURE|Failed to parse|not valid JSON/i.test(corpus);
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

/**
 * Pull the model's actual chain-of-thought from the response when available.
 * This is best-effort and provider-specific — there is no portable shape:
 *   - Z.AI / GLM:   `additional_kwargs.reasoning_content` (string)
 *   - OpenAI Chat Completions: `additional_kwargs.reasoning_content` (string)
 *   - OpenAI Responses API: `additional_kwargs.reasoning.summary[].text` (object)
 *   - Anthropic:    `content` array with blocks of `type: "thinking"`,
 *                   `thinking: string`
 *   - Google / OpenAI GPT-5 family: internal reasoning is typically hidden in
 *                   this interface, so extraction often returns undefined
 * Callers must tolerate `undefined` and fall back to the recovery boilerplate.
 */
function extractReasoningContent(message: unknown): string | undefined {
  if (!message || typeof message !== "object") return undefined;

  const additional = (message as { additional_kwargs?: unknown })
    .additional_kwargs;
  if (additional && typeof additional === "object") {
    const record = additional as Record<string, unknown>;
    const candidates = [record.reasoning_content, record.reasoning];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        return candidate;
      }
    }

    const rawReasoning = record.reasoning;
    if (rawReasoning && typeof rawReasoning === "object") {
      const reasoning = rawReasoning as Record<string, unknown>;

      const summary = reasoning.summary;
      if (Array.isArray(summary)) {
        const summaryText = summary
          .map((entry) => {
            if (typeof entry === "string") return entry;
            if (
              entry &&
              typeof entry === "object" &&
              typeof (entry as { text?: unknown }).text === "string"
            ) {
              return (entry as { text: string }).text;
            }
            return "";
          })
          .filter((text) => text.trim().length > 0);
        if (summaryText.length > 0) {
          return summaryText.join("\n\n");
        }
      }

      const content = reasoning.content;
      if (Array.isArray(content)) {
        const contentText = content
          .map((entry) => {
            if (
              entry &&
              typeof entry === "object" &&
              typeof (entry as { text?: unknown }).text === "string"
            ) {
              return (entry as { text: string }).text;
            }
            return "";
          })
          .filter((text) => text.trim().length > 0);
        if (contentText.length > 0) {
          return contentText.join("\n\n");
        }
      }
    }
  }

  const content = (message as { content?: unknown }).content;
  if (Array.isArray(content)) {
    const thinkingParts: string[] = [];
    for (const part of content) {
      if (
        part &&
        typeof part === "object" &&
        (part as { type?: unknown }).type === "thinking"
      ) {
        const text = (part as { thinking?: unknown }).thinking;
        if (typeof text === "string" && text.trim().length > 0) {
          thinkingParts.push(text);
        }
      }
    }
    if (thinkingParts.length > 0) {
      return thinkingParts.join("\n\n");
    }
  }

  return undefined;
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

function recoverRouterOutput(
  rawText: string,
  reasoningContent?: string,
): RouterOutput {
  const parsed = tryParseJsonObject(rawText);
  if (parsed) {
    const normalizedSource =
      parsed.complexity !== undefined
        ? "complexity"
        : parsed.classification !== undefined
          ? "classification"
          : parsed.label !== undefined
            ? "label"
            : "complexity";
    const complexity = coerceComplexity(
      parsed.complexity ?? parsed.classification ?? parsed.label,
    );
    const parsedReasoning = parsed.reasoning;
    const reasoning =
      reasoningContent ??
      (typeof parsedReasoning === "string" && parsedReasoning.trim().length > 0
        ? parsedReasoning
        : `Recovered from non-JSON classifier shape; normalized ${normalizedSource} to ${complexity}.`);
    return { complexity, reasoning };
  }

  const complexity = parseComplexityLabel(rawText);
  return {
    complexity,
    reasoning:
      reasoningContent ??
      (complexity === "trivial"
        ? "Recovered from non-JSON classifier output; interpreted label as trivial."
        : "Recovered from non-JSON classifier output; interpreted label as default."),
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

  // Hide the classifier's chat-model run from streamMode: "messages" so its
  // raw output (especially the recovery path's free-form JSON) doesn't leak
  // into stream.messages and render as an AI message in the chat feed. See
  // pregel/messages.js StreamMessagesHandler.handleChatModelStart — any tag
  // containing "langsmith:nostream" or "nostream" suppresses tracking.
  const HIDDEN_FROM_STREAM = { tags: ["langsmith:nostream"] };

  let result: RouterOutput;
  try {
    result = await invoker.invoke(
      [new SystemMessage(ROUTER_SYSTEM_PROMPT), new HumanMessage(userContent)],
      HIDDEN_FROM_STREAM,
    );
  } catch (error) {
    if (!isOutputParsingFailure(error)) {
      throw error;
    }

    const rawInvoker =
      fallbackModels.length > 0
        ? primary.withFallbacks({ fallbacks: fallbackModels })
        : primary;
    const rawResult = await rawInvoker.invoke(
      [
        new SystemMessage(
          `${ROUTER_SYSTEM_PROMPT}\n\nIf strict JSON schema formatting fails, respond with only one token: trivial or default.`,
        ),
        new HumanMessage(userContent),
      ],
      HIDDEN_FROM_STREAM,
    );

    const rawText = extractText(rawResult.content);
    const reasoningContent = extractReasoningContent(rawResult);
    result = recoverRouterOutput(rawText, reasoningContent);
  }

  return {
    routerResult: {
      complexity: result.complexity,
      reasoning: result.reasoning,
    },
  };
}
