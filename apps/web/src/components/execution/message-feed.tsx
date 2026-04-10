// apps/web/src/components/execution/message-feed.tsx
"use client";

import { cn } from "@/lib/utils";
import { SubagentCard } from "./subagent-card";
import { SynthesisIndicator } from "./synthesis-indicator";
import { MarkdownText } from "@/components/thread/markdown-text";
import { DO_NOT_RENDER_ID_PREFIX } from "@/lib/ensure-tool-responses";

function getContentString(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text ?? "")
      .join("");
  }
  return "";
}

function HumanBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="px-4 py-2 rounded-2xl bg-muted max-w-[80%]">
        <p className="text-sm whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}

function CoordinatorMessage({ content }: { content: string }) {
  if (!content.trim()) return null;
  return (
    <div className="text-sm">
      <MarkdownText>{content}</MarkdownText>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MessageWithSubagents({
  message,
  subagents,
}: {
  message: any;
  subagents: any[];
}) {
  const content = getContentString(message.content);
  const isHuman = message.type === "human";
  const isTool = message.type === "tool";

  if (isHuman) {
    return <HumanBubble content={content} />;
  }

  // Skip standalone tool messages — they're shown inside subagent cards
  if (isTool) return null;

  return (
    <div className="flex flex-col gap-3">
      <CoordinatorMessage content={content} />
      {subagents.length > 0 && (
        <div className="flex flex-col gap-2.5 ml-1 pl-3 border-l-2 border-primary/20">
          {subagents.map((sub) => (
            <SubagentCard
              key={sub.id}
              subagent={sub}
              defaultOpen={
                sub.status === "running" ||
                sub.status === "error" ||
                subagents.length <= 3
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function MessageFeed({
  messages,
  getSubagentsByMessage,
  allSubagents,
  isLoading,
}: {
  messages: any[];
  getSubagentsByMessage: ((messageId: string) => any[]) | undefined;
  allSubagents: any[];
  isLoading: boolean;
}) {
  // Determine if we should show synthesis indicator:
  // All subagents are done (complete or error) but stream is still loading
  const allSubagentsDone =
    allSubagents.length > 0 &&
    allSubagents.every(
      (s) => s.status === "complete" || s.status === "error",
    );
  const showSynthesis = allSubagentsDone && isLoading;

  return (
    <div className="flex flex-col gap-5 py-6 px-4 max-w-3xl mx-auto">
      {messages
        .filter((m) => !m.id?.startsWith(DO_NOT_RENDER_ID_PREFIX))
        .map((message, index) => {
          const subs = getSubagentsByMessage?.(message.id) ?? [];
          return (
            <MessageWithSubagents
              key={message.id || `msg-${index}`}
              message={message}
              subagents={subs}
            />
          );
        })}

      {showSynthesis && (
        <SynthesisIndicator subagentCount={allSubagents.length} />
      )}

      {/* Loading dots when waiting for first token and no subagents yet */}
      {isLoading && allSubagents.length === 0 && messages.length > 0 && (
        <div className="flex items-center gap-1.5 py-2">
          <div className="w-1.5 h-1.5 rounded-full bg-foreground/50 animate-[pulse_1.5s_ease-in-out_infinite]" />
          <div className="w-1.5 h-1.5 rounded-full bg-foreground/50 animate-[pulse_1.5s_ease-in-out_0.5s_infinite]" />
          <div className="w-1.5 h-1.5 rounded-full bg-foreground/50 animate-[pulse_1.5s_ease-in-out_1s_infinite]" />
        </div>
      )}
    </div>
  );
}
