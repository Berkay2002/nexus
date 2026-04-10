"use client";

import { useStreamContext } from "@/providers/Stream";
import { useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { ensureToolCallsHaveResponses } from "@/lib/ensure-tool-responses";
import type { Message } from "@langchain/langgraph-sdk";

export function useNexusStream() {
  const stream = useStreamContext();

  const submitPrompt = useCallback(
    (text: string) => {
      const newMessage = {
        id: uuidv4(),
        type: "human" as const,
        content: text,
      };

      const toolMessages = ensureToolCallsHaveResponses(
        stream.messages as Message[],
      );
      stream.submit(
        { messages: [...toolMessages, newMessage] },
        {
          streamMode: ["values"],
          streamSubgraphs: true,
          optimisticValues: (prev: Record<string, unknown>) => ({
            ...prev,
            messages: [
              ...((prev.messages as unknown[]) ?? []),
              ...toolMessages,
              newMessage,
            ],
          }),
        },
      );
    },
    [stream],
  );

  const hasMessages = stream.messages.length > 0;

  return {
    ...stream,
    submitPrompt,
    hasMessages,
  };
}
