"use client";

import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  getAgentName,
  getElapsedTime,
  getModelBadge,
  getStatusColor,
  useSubagentModelLabels,
} from "@/lib/subagent-utils";
import {
  ChevronDown,
  Circle,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { MarkdownText } from "@/components/thread/markdown-text";

function CardStatusIcon({
  status,
}: {
  status: "pending" | "running" | "complete" | "error";
}) {
  switch (status) {
    case "pending":
      return <Circle className="size-4 text-muted-foreground/50" />;
    case "running":
      return <Loader2 className="size-4 text-primary animate-spin" />;
    case "complete":
      return <CheckCircle2 className="size-4 text-green-500" />;
    case "error":
      return <XCircle className="size-4 text-destructive" />;
  }
}

function CardElapsedTimer({
  startedAt,
  completedAt,
}: {
  startedAt: number | undefined;
  completedAt: number | undefined;
}) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!startedAt || completedAt) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [startedAt, completedAt]);

  const elapsed = getElapsedTime(startedAt, completedAt);
  if (!elapsed) return null;

  return (
    <span className="text-xs text-muted-foreground tabular-nums">
      {elapsed}
    </span>
  );
}

function StreamingContent({ subagent }: { subagent: any }) {
  // When complete, show result. Otherwise show last AI message content.
  if (subagent.status === "complete" && subagent.result) {
    return (
      <div className="text-sm text-foreground/90">
        <MarkdownText>{subagent.result}</MarkdownText>
      </div>
    );
  }

  if (subagent.status === "error") {
    const lastMsg = subagent.messages?.[subagent.messages.length - 1];
    const errorText =
      typeof lastMsg?.content === "string"
        ? lastMsg.content
        : "An error occurred";
    return <p className="text-sm text-destructive">{errorText}</p>;
  }

  // Streaming: show last AI message
  const aiMessages = (subagent.messages ?? []).filter(
    (m: any) => m.type === "ai" || m._getType?.() === "ai",
  );
  const lastAI = aiMessages[aiMessages.length - 1];
  if (!lastAI) {
    if (subagent.status === "pending") {
      return <p className="text-sm text-muted-foreground italic">Waiting...</p>;
    }
    return (
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        <p className="text-sm text-muted-foreground">Working...</p>
      </div>
    );
  }

  const content =
    typeof lastAI.content === "string"
      ? lastAI.content
      : Array.isArray(lastAI.content)
        ? lastAI.content
            .filter((c: any) => c.type === "text")
            .map((c: any) => c.text)
            .join("")
        : "";

  if (!content) return null;

  return (
    <div className="text-sm text-foreground/80">
      <MarkdownText>{content}</MarkdownText>
      {subagent.status === "running" && (
        <span className="inline-block w-1.5 h-4 bg-primary/70 animate-pulse ml-0.5 align-text-bottom" />
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function SubagentCard({
  subagent,
  defaultOpen = true,
}: {
  subagent: any;
  defaultOpen?: boolean;
}) {
  const agentType = subagent.toolCall?.args?.subagent_type ?? "unknown";
  const description = subagent.toolCall?.args?.description ?? "";
  const status = subagent.status ?? "pending";
  const labelBySubagent = useSubagentModelLabels();

  return (
    <Collapsible defaultOpen={defaultOpen}>
      <div
        className={cn(
          "rounded-lg border bg-card/50 overflow-hidden transition-colors",
          status === "running" && "border-primary/30",
          status === "error" && "border-destructive/30",
        )}
      >
        <CollapsibleTrigger className="flex w-full items-center gap-2.5 px-3 py-2.5 hover:bg-accent/50 transition-colors cursor-pointer">
          <CardStatusIcon status={status} />
          <div className="flex flex-col items-start flex-1 min-w-0">
            <div className="flex items-center gap-2 w-full">
              <span className="text-sm font-medium truncate">
                {getAgentName(agentType)}
              </span>
              <Badge
                variant="outline"
                className="text-[0.6rem] h-4 px-1.5 font-mono shrink-0"
              >
                {getModelBadge(agentType, labelBySubagent)}
              </Badge>
            </div>
            {description && (
              <span className="text-xs text-muted-foreground truncate w-full text-left">
                {description}
              </span>
            )}
          </div>
          <CardElapsedTimer
            startedAt={subagent.startedAt}
            completedAt={subagent.completedAt}
          />
          <ChevronDown className="size-4 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180 shrink-0" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-1 border-t border-border/50">
            <div className="max-h-[300px] overflow-y-auto">
              <StreamingContent subagent={subagent} />
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
