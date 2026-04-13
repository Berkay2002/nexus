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
  SearchIcon,
  GlobeIcon,
  ImageIcon,
  ListTodoIcon,
  CodeIcon,
  GitBranchIcon,
  WrenchIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { MarkdownText } from "@/components/thread/markdown-text";

function getContentString(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((c: any) => c?.type === "text")
      .map((c: any) => c?.text ?? "")
      .join("");
  }
  return "";
}

/**
 * Display metadata for tool names appearing inside a subagent's CoT. Mirrors
 * the map in message-feed.tsx but intentionally duplicated so the two renderers
 * can evolve independently (orchestrator surfaces different tools than
 * sub-agents in practice).
 */
const SUB_TOOL_DISPLAY: Record<
  string,
  { label: string; icon: typeof WrenchIcon }
> = {
  tavily_search: { label: "Searching the web", icon: SearchIcon },
  tavily_extract: { label: "Extracting content", icon: GlobeIcon },
  tavily_map: { label: "Mapping URLs", icon: GlobeIcon },
  generate_image: { label: "Generating image", icon: ImageIcon },
  write_todos: { label: "Writing plan", icon: ListTodoIcon },
  task: { label: "Dispatching agent", icon: GitBranchIcon },
  execute_code: { label: "Running code", icon: CodeIcon },
  ls: { label: "Listing files", icon: GlobeIcon },
  read_file: { label: "Reading file", icon: GlobeIcon },
  write_file: { label: "Writing file", icon: GlobeIcon },
  edit_file: { label: "Editing file", icon: GlobeIcon },
  glob: { label: "Searching files", icon: SearchIcon },
  grep: { label: "Searching content", icon: SearchIcon },
};

function getSubToolDisplay(name: string) {
  return (
    SUB_TOOL_DISPLAY[name] ?? {
      label: name.replace(/_/g, " "),
      icon: WrenchIcon,
    }
  );
}

function describeToolArgs(args: any): string | undefined {
  if (!args || typeof args !== "object") return undefined;
  const candidate =
    args.query ??
    args.url ??
    args.urls ??
    args.prompt ??
    args.description ??
    args.path ??
    args.file_path ??
    args.command;
  if (typeof candidate === "string") return candidate;
  if (Array.isArray(candidate) && typeof candidate[0] === "string")
    return candidate.join(", ");
  return undefined;
}

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

function extractText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const v = value as { content?: unknown };
  if (typeof v.content === "string") return v.content;
  if (Array.isArray(v.content)) {
    return v.content
      .filter((c: any) => c?.type === "text")
      .map((c: any) => c.text ?? "")
      .join("");
  }
  return "";
}

type SubStep =
  | {
      kind: "text";
      key: string;
      content: string;
      isFinal: boolean;
    }
  | {
      kind: "tool";
      key: string;
      name: string;
      args: any;
      done: boolean;
    };

/**
 * Flattens a subagent's message sequence into a chain-of-thought step list.
 * Each AI message contributes zero or more steps: one `text` step if it has
 * non-empty prose content, plus one `tool` step per tool call it made. Tool
 * steps are marked `done` when a subsequent ToolMessage with the matching
 * `tool_call_id` has been streamed.
 */
function buildSubagentSteps(messages: any[]): SubStep[] {
  const doneToolCallIds = new Set<string>();
  for (const m of messages) {
    const isTool = m?.type === "tool" || m?._getType?.() === "tool";
    if (isTool && m.tool_call_id) doneToolCallIds.add(m.tool_call_id);
  }

  const steps: SubStep[] = [];
  messages.forEach((m, idx) => {
    const isAI = m?.type === "ai" || m?._getType?.() === "ai";
    if (!isAI) return;
    const text = getContentString(m.content);
    if (text.trim()) {
      steps.push({
        kind: "text",
        key: `${m.id ?? `m${idx}`}-text`,
        content: text,
        isFinal: false,
      });
    }
    const toolCalls: any[] =
      m.tool_calls ?? m.additional_kwargs?.tool_calls ?? [];
    for (const tc of toolCalls) {
      steps.push({
        kind: "tool",
        key: tc.id ?? `${m.id ?? `m${idx}`}-${tc.name}`,
        name: tc.name ?? "tool",
        args: tc.args ?? tc.arguments ?? {},
        done: tc.id ? doneToolCallIds.has(tc.id) : false,
      });
    }
  });

  // Mark the most recent text step as "final" — used to show the streaming
  // cursor only on the currently-streaming prose, not on earlier text chunks.
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].kind === "text") {
      (steps[i] as { isFinal: boolean }).isFinal = true;
      break;
    }
  }

  return steps;
}

function StreamingContent({ subagent }: { subagent: any }) {
  const status: "pending" | "running" | "complete" | "error" =
    subagent.status ?? "pending";
  const isRunning = status === "running";
  const messages: any[] = subagent.messages ?? [];
  const steps = buildSubagentSteps(messages);

  // Error: show whatever we have, plus the last raw content as an error line.
  if (status === "error") {
    const lastMsg = messages[messages.length - 1];
    const errorText =
      typeof lastMsg?.content === "string"
        ? lastMsg.content
        : "An error occurred";
    return (
      <div className="flex flex-col gap-2">
        {steps.length > 0 && <StepsList steps={steps} isRunning={false} />}
        <p className="text-sm text-destructive">{errorText}</p>
      </div>
    );
  }

  // Pending / no visible activity yet.
  if (steps.length === 0) {
    if (status === "pending") {
      return (
        <p className="text-sm text-muted-foreground italic">Waiting...</p>
      );
    }
    return (
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        <p className="text-sm text-muted-foreground">Working...</p>
      </div>
    );
  }

  // Complete without final prose but with a `result` blob — fall back to it so
  // we still show something useful even if the agent never streamed a summary.
  const hasAnyText = steps.some((s) => s.kind === "text");
  if (status === "complete" && !hasAnyText && subagent.result) {
    const resultText = extractText(subagent.result);
    if (resultText) {
      return (
        <div className="flex flex-col gap-2">
          <StepsList steps={steps} isRunning={false} />
          <div className="text-sm text-foreground/90">
            <MarkdownText>{resultText}</MarkdownText>
          </div>
        </div>
      );
    }
  }

  return <StepsList steps={steps} isRunning={isRunning} />;
}

function StepsList({
  steps,
  isRunning,
}: {
  steps: SubStep[];
  isRunning: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        if (step.kind === "text") {
          return (
            <div key={step.key} className="text-sm text-foreground/90">
              <MarkdownText>{step.content}</MarkdownText>
              {step.isFinal && isRunning && (
                <span className="inline-block w-1.5 h-4 bg-primary/70 animate-pulse ml-0.5 align-text-bottom" />
              )}
            </div>
          );
        }
        const display = getSubToolDisplay(step.name);
        const Icon = display.icon;
        const description = describeToolArgs(step.args);
        const stepActive = isLast && isRunning && !step.done;
        return (
          <div
            key={step.key}
            className="flex items-start gap-2 text-xs leading-tight"
          >
            <Icon
              className={cn(
                "size-3.5 shrink-0 mt-0.5",
                stepActive
                  ? "text-primary animate-pulse"
                  : step.done
                    ? "text-muted-foreground"
                    : "text-muted-foreground/50",
              )}
            />
            <div className="flex flex-col min-w-0 flex-1">
              <span
                className={cn(
                  "font-medium",
                  stepActive ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {display.label}
              </span>
              {description && (
                <span className="text-muted-foreground/70 truncate">
                  {description}
                </span>
              )}
            </div>
          </div>
        );
      })}
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
  const rawDescription = subagent.toolCall?.args?.description;
  const description =
    typeof rawDescription === "string"
      ? rawDescription
      : rawDescription && typeof rawDescription === "object" && typeof rawDescription.content === "string"
        ? rawDescription.content
        : "";
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
