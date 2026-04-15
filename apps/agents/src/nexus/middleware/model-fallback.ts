import { createMiddleware } from "langchain";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { BaseMessage } from "@langchain/core/messages";

/**
 * Detects rate-limit / quota-exhausted errors across Google, Anthropic,
 * OpenAI, and Z.AI. We deliberately fall back ONLY on these — auth errors,
 * schema errors, and network failures should bubble up so bad configuration
 * is visible instead of silently masquerading as a successful run on the
 * next provider.
 */
export function isRateLimitError(err: unknown): boolean {
  if (!err) return false;
  const e = err as {
    status?: number | string;
    code?: number | string;
    statusCode?: number | string;
    response?: { status?: number | string };
    error?: { code?: number | string; status?: number | string };
    message?: string;
  };
  const statusCandidates = [
    e.status,
    e.code,
    e.statusCode,
    e.response?.status,
    e.error?.code,
    e.error?.status,
  ];
  if (statusCandidates.some((s) => s === 429 || s === "429")) return true;
  const msg = (e.message ?? String(err)).toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("rate_limit") ||
    msg.includes("resource_exhausted") ||
    msg.includes("resource exhausted") ||
    msg.includes("quota") ||
    msg.includes("too many requests")
  );
}

/**
 * Normalise message content arrays so they only contain universally-supported
 * block types. Google's `@langchain/google` emits `inlineData` and `thought`
 * blocks; Anthropic and OpenAI don't understand those. When the fallback
 * middleware swaps a model mid-conversation, older messages may contain
 * provider-specific blocks that the new provider rejects with a 400.
 *
 * This function collapses any non-standard blocks into plain text summaries
 * and returns a shallow-cloned message array (original messages are not
 * mutated).
 */
const UNIVERSAL_TYPES = new Set([
  "text",
  "image_url",
  "tool_use",
  "tool_result",
  "input_json",
]);

function sanitizeMessages(messages: BaseMessage[]): BaseMessage[] {
  return messages.map((msg) => {
    const content = msg.content;
    if (!Array.isArray(content)) return msg;

    let needsSanitization = false;
    for (const block of content) {
      if (block && typeof block === "object") {
        if (
          "type" in block &&
          !UNIVERSAL_TYPES.has((block as { type: string }).type)
        ) {
          needsSanitization = true;
          break;
        }
        // Blocks with thoughtSignature but no type (Google reasoning metadata)
        if ("thoughtSignature" in block && !("type" in block)) {
          needsSanitization = true;
          break;
        }
      }
    }
    if (!needsSanitization) return msg;

    const sanitized = content
      .map((block) => {
        if (!block || typeof block !== "object" || !("type" in block))
          return block;
        const typed = block as { type: string; text?: string; thought?: boolean };
        if (UNIVERSAL_TYPES.has(typed.type)) return block;
        // Google "thought" blocks — reasoning output, not user-facing
        if (typed.type === "text" && typed.thought) {
          return { type: "text", text: "[model reasoning omitted]" };
        }
        // Google inlineData (image) — already saved to sandbox, just note it
        if (typed.type === "inlineData") {
          return { type: "text", text: "[generated image saved to sandbox]" };
        }
        // Google functionCall blocks — already represented in msg.tool_calls,
        // so strip them from content to avoid Z.AI/OpenAI 400 errors
        if (typed.type === "functionCall") {
          return null;
        }
        // Blocks that are ONLY a thoughtSignature with no text — reasoning
        // metadata, not content. Drop silently.
        if ("thoughtSignature" in typed && !typed.text && !typed.type) {
          return null;
        }
        // Any other unknown type — drop gracefully
        if (typed.text) {
          return { type: "text", text: typed.text };
        }
        return null;
      })
      .filter(Boolean);

    // If all content blocks were stripped (e.g., AIMessage with only
    // functionCall blocks), keep a minimal text block so the API doesn't
    // reject an empty content array.
    if (sanitized.length === 0) {
      sanitized.push({ type: "text", text: "" });
    }

    // Shallow-clone the message with sanitised content
    const clone = msg.constructor as new (fields: unknown) => BaseMessage;
    try {
      return new clone({
        ...msg,
        content: sanitized,
      });
    } catch {
      // Fallback: just override content on a spread copy
      return Object.assign(Object.create(Object.getPrototypeOf(msg)), {
        ...msg,
        content: sanitized,
      });
    }
  });
}

/**
 * Factory that builds a middleware instance which retries the model call on
 * rate-limit errors with each fallback model in order. Logs every hop so it's
 * clear from the LangGraph server output which provider is currently serving
 * the agent.
 *
 * Non-rate-limit errors (auth, invalid schema, network) are re-thrown without
 * trying fallbacks.
 *
 * Pass the agent name only for logging — it does not affect routing.
 */
export function createModelFallbackMiddleware(
  agentName: string,
  fallbacks: BaseChatModel[],
) {
  return createMiddleware({
    name: `ModelFallback:${agentName}`,
    wrapModelCall: async (request, handler) => {
      try {
        return await handler(request);
      } catch (primaryErr) {
        if (!isRateLimitError(primaryErr) || fallbacks.length === 0) {
          throw primaryErr;
        }
        console.warn(
          `[ModelFallback:${agentName}] primary rate-limited (${primaryErr instanceof Error ? primaryErr.message : String(primaryErr)}); trying ${fallbacks.length} fallback(s)`,
        );
        // Sanitise messages before handing to a different provider — older
        // messages may contain provider-specific content blocks (e.g. Google's
        // inlineData) that the fallback provider rejects.
        const cleanMessages = request.messages
          ? sanitizeMessages(request.messages as BaseMessage[])
          : request.messages;

        for (let i = 0; i < fallbacks.length; i++) {
          try {
            const result = await handler({
              ...request,
              messages: cleanMessages,
              model: fallbacks[i],
            });
            console.warn(
              `[ModelFallback:${agentName}] recovered via fallback #${i}`,
            );
            return result;
          } catch (fallbackErr) {
            const isLast = i === fallbacks.length - 1;
            const shouldContinue =
              isRateLimitError(fallbackErr) && !isLast;
            console.warn(
              `[ModelFallback:${agentName}] fallback #${i} ${shouldContinue ? "rate-limited, trying next" : "failed, giving up"}: ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`,
            );
            if (!shouldContinue) throw fallbackErr;
          }
        }
        throw primaryErr;
      }
    },
  });
}
