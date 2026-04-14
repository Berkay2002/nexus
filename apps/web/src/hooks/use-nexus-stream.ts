// apps/web/src/hooks/use-nexus-stream.ts
"use client";

import { useStreamContext } from "@/providers/Stream";
import { useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { ensureToolCallsHaveResponses } from "@/lib/ensure-tool-responses";
import type { Message } from "@langchain/langgraph-sdk";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import type {
  RoutingResult,
  RoutingState,
} from "@/components/execution/routing-card";
import { getModelsByRole } from "@/stores/model-settings";

type HumanContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

function buildHumanContent(
  message: PromptInputMessage,
): string | HumanContentPart[] {
  const imageFiles = message.files.filter(
    (f) => f.url && f.mediaType?.startsWith("image/"),
  );
  const nonImageFiles = message.files.filter(
    (f) => !f.mediaType?.startsWith("image/"),
  );

  const nonImageNote =
    nonImageFiles.length > 0
      ? [
          "Attached files:",
          ...nonImageFiles.map((file) => {
            const fileName = file.filename || "Unnamed file";
            const mediaType = file.mediaType ? ` (${file.mediaType})` : "";
            return `- ${fileName}${mediaType}`;
          }),
        ].join("\n")
      : "";

  const textWithFileContext = [message.text.trim(), nonImageNote]
    .filter(Boolean)
    .join("\n\n");

  if (imageFiles.length === 0) return textWithFileContext;

  const parts: HumanContentPart[] = [];
  if (textWithFileContext) {
    parts.push({ type: "text", text: textWithFileContext });
  }
  for (const file of imageFiles) {
    parts.push({ type: "image_url", image_url: { url: file.url! } });
  }
  return parts;
}

export function useNexusStream() {
  const stream = useStreamContext();

  const submitPrompt = useCallback(
    (input: string | PromptInputMessage) => {
      const message: PromptInputMessage =
        typeof input === "string" ? { text: input, files: [] } : input;

      const newMessage = {
        id: uuidv4(),
        type: "human" as const,
        content: buildHumanContent(message),
      };

      const toolMessages = ensureToolCallsHaveResponses(
        stream.messages as Message[],
      );
      const modelsByRole = getModelsByRole();
      stream.submit(
        { messages: [...toolMessages, newMessage] },
        {
          // `messages` mode is required for subagent stream metadata used by
          // filterSubagentMessages/getSubagentsByMessage.
          streamMode: ["messages", "values"],
          streamSubgraphs: true,
          config: {
            configurable: {
              models: modelsByRole,
            },
          },
          optimisticValues: (prev: Record<string, unknown>) => ({
            ...prev,
            messages: [
              ...((prev.messages as unknown[]) ?? []),
              ...toolMessages,
              newMessage,
            ],
            // Clear the previous turn's routerResult so the routing card
            // returns to its shimmer state until metaRouter writes a fresh
            // result for this turn.
            routerResult: null,
          }),
        } as any,
      );
    },
    [stream],
  );

  const hasMessages = stream.messages.length > 0;

  // Subagent data — these come from @langchain/react useStream with filterSubagentMessages: true
  // stream.subagents is a Map<string, SubagentStreamInterface>
  // stream.getSubagentsByMessage returns SubagentStreamInterface[] for a given message ID
  const subagents = (stream as any).subagents as
    | Map<string, any>
    | undefined;
  const getSubagentsByMessage = (stream as any).getSubagentsByMessage as
    | ((messageId: string) => any[])
    | undefined;

  // Meta-router visualization. The graph writes routerResult to state at the
  // end of the metaRouter node — there's no streaming during classification,
  // just a null → result transition. We cleared routerResult in
  // optimisticValues on submit, so:
  //   - Just after submit, before metaRouter completes:
  //       routerResult == null && lastMessage is human → isClassifying
  //   - After metaRouter writes: routerResult is set → card resolves to
  //     "Routed in Ns · {tier}" and auto-collapses 1s later
  const routerResult =
    ((stream.values as Record<string, unknown> | undefined)?.routerResult as
      | RoutingResult
      | null
      | undefined) ?? null;
  const lastMessageType =
    stream.messages[stream.messages.length - 1]?.type ?? null;
  const isClassifying =
    stream.isLoading && routerResult == null && lastMessageType === "human";
  const routing: RoutingState | undefined =
    routerResult || isClassifying
      ? { result: routerResult, isClassifying }
      : undefined;

  return {
    messages: stream.messages,
    isLoading: stream.isLoading,
    error: stream.error,
    values: stream.values,
    submit: stream.submit,
    stop: stream.stop,
    interrupt: stream.interrupt,
    submitPrompt,
    hasMessages,
    subagents,
    getSubagentsByMessage,
    routing,
  };
}
