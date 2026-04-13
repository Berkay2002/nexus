import { createMiddleware } from "langchain";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

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
        for (let i = 0; i < fallbacks.length; i++) {
          try {
            const result = await handler({ ...request, model: fallbacks[i] });
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
