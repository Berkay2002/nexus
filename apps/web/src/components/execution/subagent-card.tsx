"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  getAgentName,
  getElapsedTime,
  normalizeSubagentStatus,
  type SubagentStatus,
  useSubagentModelIdentities,
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
import { ExecuteToolArtifact } from "./execute-tool-artifact";
import { FilesystemToolArtifact } from "./filesystem-tool-artifact";
import { GenerateImageArtifact } from "./generate-image-artifact";
import { ModelIdentityBadge } from "./model-identity-badge";

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
  execute: { label: "Running code", icon: CodeIcon },
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
  status: SubagentStatus;
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

function getLatestAiSummary(messages: any[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    const isAI = message?.type === "ai" || message?._getType?.() === "ai";
    if (!isAI) continue;
    const text = getContentString(message?.content).trim();
    if (text) return text;
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
      output?: string;
    };

function parseJsonString(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Ignore parse errors — many tool results are plain text.
  }
  return null;
}

function toObjectRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function extractFilePathFromToolMessage(message: any): string | undefined {
  const contentRecord =
    toObjectRecord(message?.content) ?? parseJsonString(message?.content);
  const additionalRecord =
    toObjectRecord(message?.additional_kwargs) ??
    parseJsonString(message?.additional_kwargs);
  const responseMetaRecord =
    toObjectRecord(message?.response_metadata) ??
    parseJsonString(message?.response_metadata);

  const candidate =
    (contentRecord?.file_path as unknown) ??
    (contentRecord?.path as unknown) ??
    (additionalRecord?.file_path as unknown) ??
    (additionalRecord?.path as unknown) ??
    (responseMetaRecord?.file_path as unknown) ??
    (responseMetaRecord?.path as unknown);

  return typeof candidate === "string" && candidate.trim()
    ? candidate
    : undefined;
}

function collectCreatedFiles(messages: any[]): string[] {
  const files = new Set<string>();

  // 1) Planned output paths from write_file tool-call arguments.
  for (const m of messages) {
    const isAI = m?.type === "ai" || m?._getType?.() === "ai";
    if (!isAI) continue;

    const toolCalls: any[] =
      m.tool_calls ?? m.additional_kwargs?.tool_calls ?? [];
    for (const tc of toolCalls) {
      if (tc?.name !== "write_file") continue;
      const args = tc?.args ?? tc?.arguments;

      if (typeof args === "string") {
        const parsed = parseJsonString(args);
        const path =
          (parsed?.file_path as string | undefined) ??
          (parsed?.path as string | undefined);
        if (typeof path === "string" && path.trim()) files.add(path);
        continue;
      }

      if (args && typeof args === "object") {
        const path =
          (args as Record<string, unknown>).file_path ??
          (args as Record<string, unknown>).path;
        if (typeof path === "string" && path.trim()) files.add(path);
      }
    }
  }

  // 2) Actual result payloads from tool messages (if emitted by runtime).
  for (const m of messages) {
    const isTool = m?.type === "tool" || m?._getType?.() === "tool";
    if (!isTool) continue;

    const toolName = m?.name;
    if (toolName && toolName !== "write_file") continue;

    const path = extractFilePathFromToolMessage(m);
    if (path) files.add(path);
  }

  return [...files];
}

/**
 * Flattens a subagent's message sequence into a chain-of-thought step list.
 * Each AI message contributes zero or more steps: one `text` step if it has
 * non-empty prose content, plus one `tool` step per tool call it made. Tool
 * steps are marked `done` when a subsequent ToolMessage with the matching
 * `tool_call_id` has been streamed.
 */
function buildSubagentSteps(messages: any[]): SubStep[] {
  const doneToolCallIds = new Set<string>();
  const toolResultByCallId = new Map<string, string>();

  for (const m of messages) {
    const isTool = m?.type === "tool" || m?._getType?.() === "tool";
    if (!isTool || !m.tool_call_id) continue;

    doneToolCallIds.add(m.tool_call_id);
    const contentText = getContentString(m.content) || extractText(m.content);
    const normalized = contentText.trim();
    if (normalized) {
      toolResultByCallId.set(m.tool_call_id, normalized);
    }
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
        output: tc.id ? toolResultByCallId.get(tc.id) : undefined,
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
  const status = normalizeSubagentStatus(subagent.status);
  const isRunning = status === "running";
  const messages: any[] = subagent.messages ?? [];
  const steps = buildSubagentSteps(messages);
  const createdFiles = collectCreatedFiles(messages);
  const resultSummary = extractText(subagent.result).trim();
  const latestSummary = getLatestAiSummary(messages);
  const completionSummary = resultSummary || latestSummary;

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
        {createdFiles.length > 0 && <CreatedFilesList files={createdFiles} />}
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

    if (status === "complete") {
      return (
        <div className="flex flex-col gap-2">
          {createdFiles.length > 0 && <CreatedFilesList files={createdFiles} />}
          {completionSummary ? (
            <div className="text-sm text-foreground/90">
              <MarkdownText>{completionSummary}</MarkdownText>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Completed.</p>
          )}
        </div>
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
  if (status === "complete" && !hasAnyText && completionSummary) {
      return (
        <div className="flex flex-col gap-2">
          <StepsList steps={steps} isRunning={false} />
          {createdFiles.length > 0 && <CreatedFilesList files={createdFiles} />}
          <div className="text-sm text-foreground/90">
            <MarkdownText>{completionSummary}</MarkdownText>
          </div>
        </div>
      );
  }

  return (
    <div className="flex flex-col gap-2">
      <StepsList steps={steps} isRunning={isRunning} />
      {createdFiles.length > 0 && <CreatedFilesList files={createdFiles} />}
    </div>
  );
}

function CreatedFilesList({ files }: { files: string[] }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/20 px-2.5 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
        Created files
      </p>
      <div className="flex flex-col gap-1">
        {files.map((filePath) => (
          <p
            key={filePath}
            className="text-xs text-muted-foreground font-mono break-all"
          >
            {filePath}
          </p>
        ))}
      </div>
    </div>
  );
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
        const isExecuteTool = step.name === "execute" || step.name === "execute_code";
        const isGenerateImageTool = step.name === "generate_image";
        const isWriteOrEditTool = step.name === "write_file" || step.name === "edit_file";
        const isReadFileTool = step.name === "read_file";
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
              {isExecuteTool && step.output && (
                <ExecuteToolArtifact
                  command={typeof step.args?.command === "string" ? step.args.command : undefined}
                  description={description}
                  isStreaming={stepActive}
                  output={step.output}
                  title="Subagent execution"
                  defaultOpen={stepActive}
                />
              )}
              {isWriteOrEditTool && (
                <FilesystemToolArtifact
                  args={step.args}
                  defaultOpen={false}
                  output={step.output}
                  toolName={step.name === "write_file" ? "write_file" : "edit_file"}
                />
              )}
              {isReadFileTool && (
                <FilesystemToolArtifact
                  args={step.args}
                  defaultOpen={false}
                  output={step.output}
                  toolName="read_file"
                />
              )}
              {isGenerateImageTool && step.output && (
                <GenerateImageArtifact
                  output={step.output}
                  prompt={typeof step.args?.prompt === "string" ? step.args.prompt : undefined}
                  title="Subagent image output"
                  defaultOpen={false}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SubagentCard({
  subagent,
  defaultOpen = true,
  selectedModelRefsByRole,
}: {
  subagent: any;
  defaultOpen?: boolean;
  selectedModelRefsByRole?: Partial<
    Record<
      "orchestrator" | "research" | "code" | "creative" | "general-purpose",
      string
    >
  >;
}) {
  const agentType = subagent.toolCall?.args?.subagent_type ?? "unknown";
  const rawDescription = subagent.toolCall?.args?.description;
  const description =
    typeof rawDescription === "string"
      ? rawDescription
      : rawDescription && typeof rawDescription === "object" && typeof rawDescription.content === "string"
        ? rawDescription.content
        : "";
  const status = normalizeSubagentStatus(subagent.status);
  const identitiesBySubagent = useSubagentModelIdentities(
    selectedModelRefsByRole,
  );
  const modelIdentity = identitiesBySubagent[agentType];
  const fallbackRoleLabel = agentType
    .replace(/-/g, " ")
    .replace(/\b\w/g, (m: string) => m.toUpperCase());

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
              <ModelIdentityBadge
                provider={modelIdentity?.provider}
                modelLabel={modelIdentity?.modelLabel ?? "Auto model"}
                roleLabel={modelIdentity?.roleLabel ?? fallbackRoleLabel}
                className="shrink-0"
              />
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
