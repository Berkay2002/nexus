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

export class ZaiChatOpenAI extends ChatOpenAI {
  constructor(fields?: ChatOpenAIFields) {
    super(fields);
  }
}
