import type { BaseMessage } from "@langchain/core/messages";
import { AIMessage, AIMessageChunk } from "@langchain/core/messages";
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

export class ZaiChatOpenAI extends ChatOpenAI {
  constructor(fields?: ChatOpenAIFields) {
    super(fields);
  }
}
