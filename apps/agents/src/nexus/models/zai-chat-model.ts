import { AsyncLocalStorage } from "node:async_hooks";
import type { BaseMessage } from "@langchain/core/messages";
import { AIMessage, AIMessageChunk } from "@langchain/core/messages";
import { ChatGenerationChunk } from "@langchain/core/outputs";
import { ChatOpenAI, type ChatOpenAIFields } from "@langchain/openai";

/**
 * Walk LC input messages in order. For every AIMessage (or AIMessageChunk),
 * push its reasoning_content string, or null if missing/invalid. The Nth
 * entry in the returned array corresponds to the Nth assistant-role param
 * in the outbound OpenAI request (LC's converter is order-preserving and
 * we don't use the audio-splitting path on z.ai).
 */
export function buildReasoningMap(messages: BaseMessage[]): (string | null)[] {
  const map: (string | null)[] = [];
  for (const msg of messages) {
    if (!(msg instanceof AIMessage || msg instanceof AIMessageChunk)) continue;
    const raw = msg.additional_kwargs?.reasoning_content;
    if (typeof raw === "string" && raw.length > 0) {
      map.push(raw);
    } else {
      map.push(null);
    }
  }
  return map;
}

interface RequestLike {
  messages?: unknown;
}

/**
 * Mutate `request.messages` in place, setting `reasoning_content` on assistant
 * params in the order they appear. If the assistant count in the request does
 * not match the reasoning map length, log a warning and leave the request
 * untouched — safer than corrupting it.
 */
export function injectReasoningContent(
  request: RequestLike,
  map: (string | null)[],
): void {
  const messages = request.messages;
  if (!Array.isArray(messages)) return;

  const assistantIndices: number[] = [];
  for (let i = 0; i < messages.length; i++) {
    const entry = messages[i];
    if (
      entry &&
      typeof entry === "object" &&
      (entry as { role?: unknown }).role === "assistant"
    ) {
      assistantIndices.push(i);
    }
  }

  if (assistantIndices.length !== map.length) {
    if (map.length > 0) {
      console.warn(
        `[ZaiChatOpenAI] reasoning map/message count mismatch (map=${map.length}, assistants=${assistantIndices.length}); skipping injection`,
      );
    }
    return;
  }

  for (let i = 0; i < assistantIndices.length; i++) {
    const value = map[i];
    if (typeof value !== "string" || value.length === 0) continue;
    const entry = messages[assistantIndices[i]] as Record<string, unknown>;
    entry.reasoning_content = value;
  }
}

/**
 * Per-call scope for the reasoning_content array built from LC messages on
 * the way in. Populated by _generate / _streamResponseChunks, consumed by the
 * patched completionWithRetry on the inner completions/responses instances.
 */
const reasoningCtx = new AsyncLocalStorage<(string | null)[]>();

interface CompletionsLike {
  completionWithRetry: (req: unknown, opts?: unknown) => Promise<unknown>;
  _originalCompletionWithRetry?: (req: unknown, opts?: unknown) => Promise<unknown>;
  _convertCompletionsDeltaToBaseMessageChunk?: (
    delta: unknown,
    rawResponse: unknown,
    defaultRole?: string,
  ) => unknown;
  _originalConvertDelta?: (
    delta: unknown,
    rawResponse: unknown,
    defaultRole?: string,
  ) => unknown;
}

/**
 * ChatOpenAI in @langchain/openai is a facade that delegates _generate and
 * _streamResponseChunks to inner `completions` and `responses` instances.
 * `completionWithRetry` lives on those instances. We patch each instance
 * method so that when the active AsyncLocalStorage has a reasoning map, we
 * inject reasoning_content onto outbound assistant messages before the HTTP
 * call. Tests stub the unpatched path via `_originalCompletionWithRetry`.
 */
function patchCompletionsForReasoning(target: CompletionsLike | undefined): void {
  if (!target || typeof target.completionWithRetry !== "function") return;
  if (target._originalCompletionWithRetry) return;
  const original = target.completionWithRetry.bind(target);
  target._originalCompletionWithRetry = original;
  target.completionWithRetry = async function (
    this: CompletionsLike,
    req: unknown,
    opts?: unknown,
  ) {
    const map = reasoningCtx.getStore();
    if (map) {
      injectReasoningContent(req as RequestLike, map);
    }
    const fn = this._originalCompletionWithRetry ?? original;
    return fn(req, opts);
  };
}

/**
 * Patch the completions facade's streaming delta → BaseMessageChunk converter
 * so that deltas missing a `role` field default to `"assistant"` instead of
 * falling through @langchain/openai's generic `ChatMessageChunk` branch.
 *
 * WHY: glm-5.1 (and other GLM reasoning models) sometimes emit an initial
 * streaming delta that carries `reasoning_content` but no `role`. The
 * upstream converter at `@langchain/openai/.../converters/completions.js`
 * walks `role === "user" / "assistant" / ...` and falls through to
 * `new ChatMessageChunk({ role, ... })` when the role is undefined AND the
 * caller hasn't threaded a `defaultRole` in yet (the caller only updates
 * `defaultRole` *after* converting each delta). That first ChatMessageChunk
 * then poisons the whole stream because `BaseMessageChunk.concat()`
 * preserves the class of the first chunk, so the aggregated final message
 * comes out as a ChatMessageChunk — which fails the agent framework's
 * `AIMessage.isInstance(...)` gate with:
 *
 *   Invalid response from "wrapModelCall": expected AIMessage or Command,
 *   got object
 *
 * SAFETY: Z.AI's OpenAI-compatible endpoint only ever streams assistant
 * responses, so coercing the default role to "assistant" when upstream
 * omits it is loss-free.
 */
function patchCompletionsForAssistantRoleDefault(
  target: CompletionsLike | undefined,
): void {
  if (
    !target ||
    typeof target._convertCompletionsDeltaToBaseMessageChunk !== "function"
  ) {
    return;
  }
  if (target._originalConvertDelta) return;
  const original = target._convertCompletionsDeltaToBaseMessageChunk.bind(
    target,
  );
  target._originalConvertDelta = original;
  target._convertCompletionsDeltaToBaseMessageChunk = function (
    this: CompletionsLike,
    delta: unknown,
    rawResponse: unknown,
    defaultRole?: string,
  ) {
    const fn = this._originalConvertDelta ?? original;
    return fn(delta, rawResponse, defaultRole ?? "assistant");
  };
}

export class ZaiChatOpenAI extends ChatOpenAI {
  constructor(fields?: ChatOpenAIFields) {
    super(fields);
    const facade = this as unknown as {
      completions?: CompletionsLike;
      responses?: CompletionsLike;
    };
    patchCompletionsForReasoning(facade.completions);
    patchCompletionsForReasoning(facade.responses);
    patchCompletionsForAssistantRoleDefault(facade.completions);
    patchCompletionsForAssistantRoleDefault(facade.responses);
    if (
      typeof facade.completions?.completionWithRetry !== "function" &&
      typeof facade.responses?.completionWithRetry !== "function"
    ) {
      throw new Error(
        "[ZaiChatOpenAI] @langchain/openai no longer exposes completionWithRetry on either inner facade — reasoning injection cannot be installed. Check for a @langchain/openai upgrade.",
      );
    }
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: Parameters<ChatOpenAI["_generate"]>[2],
  ): ReturnType<ChatOpenAI["_generate"]> {
    const map = buildReasoningMap(messages);
    return reasoningCtx.run(map, () =>
      super._generate(messages, options, runManager),
    );
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: Parameters<ChatOpenAI["_streamResponseChunks"]>[2],
  ): AsyncGenerator<ChatGenerationChunk> {
    const map = buildReasoningMap(messages);
    // Buffer inside reasoningCtx.run so the underlying completionWithRetry
    // call (made during super's iteration) sees the store. yield* outside a
    // run() can lose the ALS context on chunk iteration. Task 4 revisits this
    // if streaming latency becomes a concern.
    const buffered: unknown[] = [];
    await reasoningCtx.run(map, async () => {
      for await (const chunk of super._streamResponseChunks(
        messages,
        options,
        runManager,
      )) {
        buffered.push(chunk);
      }
    });
    for (const chunk of buffered) {
      yield chunk as unknown as ChatGenerationChunk;
    }
  }
}
