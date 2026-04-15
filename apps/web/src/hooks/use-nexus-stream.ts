// apps/web/src/hooks/use-nexus-stream.ts
"use client";

import { useStreamContext } from "@/providers/Stream";
import { useCallback, useEffect, useState } from "react";
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

  // Sticky routing result, scoped to the current turn. We can't read this
  // straight off `stream.values` because once the orchestrator subgraph starts
  // emitting `values` events (we use streamSubgraphs: true for subagent
  // streaming), the merged stream values no longer carry the parent's
  // `routerResult` key — the card would blink out the moment orchestration
  // begins. Pin it locally instead and clear on the next submit.
  const [stickyRouterResult, setStickyRouterResult] =
    useState<RoutingResult | null>(null);

  useEffect(() => {
    const fromStream = (
      stream.values as Record<string, unknown> | undefined
    )?.routerResult as RoutingResult | null | undefined;
    if (fromStream) {
      setStickyRouterResult(fromStream);
    }
  }, [stream.values]);

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
      // Reset the sticky routing result so the next turn starts fresh —
      // the card returns to its shimmer state until metaRouter writes again.
      setStickyRouterResult(null);
      stream.submit(
        { messages: [...toolMessages, newMessage] },
        {
          // `messages` mode is required for subagent stream metadata used by
          // filterSubagentMessages/getSubagentsByMessage.
          streamMode: ["messages", "values"],
          streamSubgraphs: true,
          onDisconnect: "continue",
          streamResumable: true,
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
            routerResult: null,
          }),
        } as any,
      );
    },
    [stream],
  );

  const hasMessages = stream.messages.length > 0;

  // Subagent data — first-class on UseDeepAgentStream. The context in
  // Stream.tsx is typed as UseDeepAgentStream<StateType>, so the runtime
  // shape (guaranteed by filterSubagentMessages: true) is fully typed here.
  const subagents = stream.subagents;
  const getSubagentsByMessage = stream.getSubagentsByMessage;

  // Meta-router visualization. The graph writes routerResult to state at the
  // end of the metaRouter node — there's no streaming during classification,
  // just a null → result transition. The sticky local copy survives subgraph
  // value updates that would otherwise clobber the parent's routerResult.
  //   - Just after submit, before metaRouter completes:
  //       sticky == null && lastMessage is human → isClassifying
  //   - After metaRouter writes: sticky is set → card resolves to
  //     "Routed in Ns · {tier}" and stays visible for the rest of the turn
  const lastMessageType =
    stream.messages[stream.messages.length - 1]?.type ?? null;
  const isClassifying =
    stream.isLoading && stickyRouterResult == null && lastMessageType === "human";
  // Orchestrator considered "started" once any non-human message exists after
  // the latest human message — that's the signal for the routing card to
  // surrender the viewport and auto-collapse.
  const lastHumanIndex = (() => {
    for (let i = stream.messages.length - 1; i >= 0; i--) {
      if (stream.messages[i]?.type === "human") return i;
    }
    return -1;
  })();
  const hasOrchestratorStarted =
    lastHumanIndex >= 0 && lastHumanIndex < stream.messages.length - 1;
  const routing: RoutingState | undefined =
    stickyRouterResult || isClassifying
      ? {
          result: stickyRouterResult,
          isClassifying,
          hasOrchestratorStarted,
        }
      : undefined;

  // Server-side submission queue (multitaskStrategy: "enqueue"). First-class
  // on the UseStream return type — QueueInterface is already typed.
  const queue = stream.queue;

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
    queue,
  };
}
