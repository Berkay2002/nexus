// apps/web/src/components/execution/message-feed.tsx
"use client";

import { Fragment } from "react";
import { SubagentCard } from "./subagent-card";
import { FilesystemToolArtifact } from "./filesystem-tool-artifact";
import { SynthesisIndicator } from "./synthesis-indicator";
import { GenerateImageArtifact } from "./generate-image-artifact";
import { RoutingCard, type RoutingState } from "./routing-card";
import { MarkdownText } from "@/components/thread/markdown-text";
import { ExecuteToolArtifact } from "./execute-tool-artifact";
import { DO_NOT_RENDER_ID_PREFIX } from "@/lib/ensure-tool-responses";
import {
  ChainOfThought,
  ChainOfThoughtHeader,
  ChainOfThoughtContent,
  ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought";
import {
  GitBranchIcon,
  CheckCircle2,
  Circle,
  ListTodoIcon,
  Loader2,
  WrenchIcon,
  SearchIcon,
  GlobeIcon,
  ImageIcon,
  CodeIcon,
} from "lucide-react";
import {
  getAgentName,
  isSubagentTerminalStatus,
  normalizeTodos,
  normalizeSubagentStatus,
} from "@/lib/subagent-utils";

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

function getToolCalls(message: any): any[] {
  return message.tool_calls ?? message.additional_kwargs?.tool_calls ?? [];
}

function buildToolResultMap(messages: any[]): Map<string, string> {
  const resultByCallId = new Map<string, string>();

  for (const message of messages) {
    const isTool = message?.type === "tool" || message?._getType?.() === "tool";
    if (!isTool || !message?.tool_call_id) continue;

    const content = getContentString(message?.content).trim();
    if (content) {
      resultByCallId.set(message.tool_call_id, content);
    }
  }

  return resultByCallId;
}

/** Map tool names to display-friendly labels and icons */
const TOOL_DISPLAY: Record<string, { label: string; icon: typeof WrenchIcon }> = {
  tavily_search: { label: "Searching the web", icon: SearchIcon },
  tavily_extract: { label: "Extracting content", icon: GlobeIcon },
  tavily_map: { label: "Mapping URLs", icon: GlobeIcon },
  generate_image: { label: "Generating image", icon: ImageIcon },
  write_todos: { label: "Creating plan", icon: ListTodoIcon },
  write_todo: { label: "Updating plan", icon: ListTodoIcon },
  // DeepAgents dispatches sub-agents via the `task` tool (see
  // deepagents/dist/index.cjs:1932 and langgraph-sdk `DEFAULT_SUBAGENT_TOOL_NAMES`).
  task: { label: "Dispatching agent", icon: GitBranchIcon },
  execute: { label: "Running code", icon: CodeIcon },
  execute_code: { label: "Running code", icon: CodeIcon },
  read_file: { label: "Reading file", icon: GlobeIcon },
  write_file: { label: "Writing file", icon: GlobeIcon },
  edit_file: { label: "Editing file", icon: GlobeIcon },
};

function getToolDisplay(toolName: string) {
  return TOOL_DISPLAY[toolName] ?? { label: toolName.replace(/_/g, " "), icon: WrenchIcon };
}

function TodoInlineStatusIcon({ status }: { status: "pending" | "in_progress" | "completed" }) {
  if (status === "completed") {
    return <CheckCircle2 className="size-3.5 shrink-0 text-green-500" />;
  }
  if (status === "in_progress") {
    return <Loader2 className="size-3.5 shrink-0 text-primary animate-spin" />;
  }
  return <Circle className="size-3.5 shrink-0 text-muted-foreground/50" />;
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

/**
 * Renders a coordinator AI message as a chain-of-thought visualization.
 *
 * The orchestrator's AI messages contain:
 * - text content (reasoning / response prose)
 * - tool_calls (actions like task [subagent dispatch], write_todos, tavily_search)
 *
 * We parse these into CoT steps. Subagent cards are embedded inside
 * the "Dispatching agent" steps.
 */
function OrchestratorMessage({
  message,
  subagents,
  isLastMessage,
  isLoading,
  toolResultByCallId,
}: {
  message: any;
  subagents: any[];
  isLastMessage: boolean;
  isLoading: boolean;
  toolResultByCallId: Map<string, string>;
}) {
  const content = getContentString(message.content);
  const toolCalls: any[] =
    message.tool_calls ??
    message.additional_kwargs?.tool_calls ??
    [];

  // If this is a pure text message with no tool calls and no subagents,
  // render as simple prose (like the coordinator's intro or final synthesis)
  if (toolCalls.length === 0 && subagents.length === 0) {
    if (!content.trim()) return null;
    return (
      <div className="text-sm">
        <MarkdownText>{content}</MarkdownText>
      </div>
    );
  }

  // Build CoT steps from the message
  const hasMultipleActions = toolCalls.length > 1 || subagents.length > 1;
  const isActive = isLastMessage && isLoading;

  // Group subagents by their tool call ID for matching
  const subagentByToolCallId = new Map<string, any>();
  for (const sub of subagents) {
    if (sub.toolCall?.id) {
      subagentByToolCallId.set(sub.toolCall.id, sub);
    }
  }

  // Also create a list of unmatched subagents (fallback)
  const matchedToolCallIds = new Set<string>();

  return (
    <div className="flex flex-col gap-3">
      {/* Coordinator reasoning text (if any) */}
      {content.trim() && (
        <div className="text-sm">
          <MarkdownText>{content}</MarkdownText>
        </div>
      )}

      {/* Chain of thought for orchestrator actions */}
      <ChainOfThought defaultOpen={true}>
        <ChainOfThoughtHeader>
          {hasMultipleActions
            ? `Running ${toolCalls.length || subagents.length} tasks${subagents.length > 1 ? " in parallel" : ""}`
            : toolCalls.length === 1
              ? getToolDisplay(toolCalls[0].name).label
              : "Working..."}
        </ChainOfThoughtHeader>
        <ChainOfThoughtContent>
          {toolCalls.map((tc: any, i: number) => {
            const toolName = tc.name ?? "tool";
            const display = getToolDisplay(toolName);
            const matchedSubagent = subagentByToolCallId.get(tc.id);

            if (matchedSubagent) {
              matchedToolCallIds.add(tc.id);
            }

            // For `task` calls (DeepAgents' subagent dispatch), embed the SubagentCard
            if (toolName === "task" && matchedSubagent) {
              const agentType = tc.args?.subagent_type ?? matchedSubagent.toolCall?.args?.subagent_type ?? "agent";
              return (
                <ChainOfThoughtStep
                  key={tc.id ?? i}
                  icon={display.icon}
                  label={`Dispatching ${getAgentName(agentType)}`}
                  status={
                    isSubagentTerminalStatus(matchedSubagent.status)
                      ? "complete"
                      : normalizeSubagentStatus(matchedSubagent.status) === "running"
                        ? "active"
                        : "pending"
                  }
                >
                  <div className="mt-1">
                    <SubagentCard
                      subagent={matchedSubagent}
                      defaultOpen={
                        normalizeSubagentStatus(matchedSubagent.status) === "running" ||
                        normalizeSubagentStatus(matchedSubagent.status) === "error" ||
                        subagents.length <= 3
                      }
                    />
                  </div>
                </ChainOfThoughtStep>
              );
            }

            // For write_todos/write_todo, show plan items with status.
            if (toolName === "write_todos" || toolName === "write_todo") {
              const args = tc.args ?? tc.arguments;
              const payload =
                args && typeof args === "object"
                  ? (args as Record<string, unknown>).todos ??
                    (args as Record<string, unknown>).todoList ??
                    (args as Record<string, unknown>).todo_list ??
                    (args as Record<string, unknown>).items
                  : undefined;
              const todos = normalizeTodos(payload);
              if (todos.length === 0) return null;

              return (
                <ChainOfThoughtStep
                  key={tc.id ?? i}
                  icon={ListTodoIcon}
                  label={toolName === "write_todo" ? "Updating plan" : "Creating plan"}
                  status={isActive ? "active" : "complete"}
                >
                  <div className="flex flex-col gap-1 mt-1">
                    {todos.map((todo, j: number) => {
                      return (
                        <div key={j} className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <TodoInlineStatusIcon status={todo.status} />
                          {todo.content}
                        </div>
                      );
                    })}
                  </div>
                </ChainOfThoughtStep>
              );
            }

            // For other tools (search, extract, etc.)
            const description =
              tc.args?.query ?? tc.args?.url ?? tc.args?.description ?? undefined;
            const isExecuteTool = toolName === "execute" || toolName === "execute_code";
            const isGenerateImageTool = toolName === "generate_image";
            const isWriteOrEditTool = toolName === "write_file" || toolName === "edit_file";
            const isReadFileTool = toolName === "read_file";
            const toolOutput = tc.id ? toolResultByCallId.get(tc.id) : undefined;

            return (
              <ChainOfThoughtStep
                key={tc.id ?? i}
                icon={display.icon}
                label={display.label}
                description={typeof description === "string" ? description : undefined}
                status={isActive && i === toolCalls.length - 1 ? "active" : "complete"}
              >
                {isExecuteTool && toolOutput ? (
                  <ExecuteToolArtifact
                    command={typeof tc.args?.command === "string" ? tc.args.command : undefined}
                    description={typeof description === "string" ? description : undefined}
                    isStreaming={isActive && i === toolCalls.length - 1}
                    output={toolOutput}
                    title="Orchestrator execution"
                    defaultOpen={isActive && i === toolCalls.length - 1}
                  />
                ) : null}
                {isWriteOrEditTool ? (
                  <FilesystemToolArtifact
                    args={tc.args}
                    defaultOpen={false}
                    output={toolOutput}
                    toolName={toolName === "write_file" ? "write_file" : "edit_file"}
                  />
                ) : null}
                {isReadFileTool ? (
                  <FilesystemToolArtifact
                    args={tc.args}
                    defaultOpen={false}
                    output={toolOutput}
                    toolName="read_file"
                  />
                ) : null}
                {isGenerateImageTool && toolOutput ? (
                  <GenerateImageArtifact
                    output={toolOutput}
                    prompt={typeof tc.args?.prompt === "string" ? tc.args.prompt : undefined}
                    title="Generated images"
                    defaultOpen={false}
                  />
                ) : null}
              </ChainOfThoughtStep>
            );
          })}

          {/* Render any subagents that didn't match a tool call */}
          {subagents
            .filter((sub) => !matchedToolCallIds.has(sub.toolCall?.id))
            .map((sub) => {
              const agentType = sub.toolCall?.args?.subagent_type ?? "agent";
              const subDescription = sub.toolCall?.args?.description;
              return (
                <ChainOfThoughtStep
                  key={sub.id}
                  icon={GitBranchIcon}
                  label={`Dispatching ${getAgentName(agentType)}`}
                  description={typeof subDescription === "string" ? subDescription : undefined}
                  status={
                    isSubagentTerminalStatus(sub.status)
                      ? "complete"
                      : normalizeSubagentStatus(sub.status) === "running"
                        ? "active"
                        : "pending"
                  }
                >
                  <div className="mt-1">
                    <SubagentCard
                      subagent={sub}
                      defaultOpen={
                        normalizeSubagentStatus(sub.status) === "running" ||
                        normalizeSubagentStatus(sub.status) === "error" ||
                        subagents.length <= 3
                      }
                    />
                  </div>
                </ChainOfThoughtStep>
              );
            })}
        </ChainOfThoughtContent>
      </ChainOfThought>
    </div>
  );
}

export function MessageFeed({
  messages,
  routing,
  getSubagentsByMessage,
  allSubagents,
  isLoading,
}: {
  messages: any[];
  routing?: RoutingState;
  getSubagentsByMessage: ((messageId: string) => any[]) | undefined;
  allSubagents: any[];
  isLoading: boolean;
}) {
  const allSubagentsDone =
    allSubagents.length > 0 &&
    allSubagents.every((s) => isSubagentTerminalStatus(s.status));
  const showSynthesis = allSubagentsDone && isLoading;

  const filteredMessages = messages.filter(
    (m) => !m.id?.startsWith(DO_NOT_RENDER_ID_PREFIX),
  );
  const toolResultByCallId = buildToolResultMap(filteredMessages);
  const lastHumanIndex = (() => {
    for (let i = filteredMessages.length - 1; i >= 0; i--) {
      if (filteredMessages[i]?.type === "human") return i;
    }
    return -1;
  })();
  const showRoutingCard =
    routing !== undefined &&
    (routing.isClassifying || routing.result !== null);

  return (
    <div className="flex flex-col gap-5 py-6 px-4 w-full max-w-3xl mx-auto">
      {filteredMessages.map((message, index) => {
        const isHuman = message.type === "human";
        const isTool = message.type === "tool";
        const key = message.id || `msg-${index}`;
        const routingSlot =
          showRoutingCard && index === lastHumanIndex ? (
            <RoutingCard {...routing!} />
          ) : null;

        if (isHuman) {
          return (
            <Fragment key={key}>
              <HumanBubble content={getContentString(message.content)} />
              {routingSlot}
            </Fragment>
          );
        }

        // Skip standalone tool result messages — shown inside CoT
        if (isTool) return null;

        // AI message — render as orchestrator CoT.
        // Fallback: if per-message matching is empty but we do have global
        // subagent state, attach those cards to the latest `task` message.
        const subagentsForMessage = getSubagentsByMessage?.(message.id) ?? [];
        const toolCalls = getToolCalls(message);
        const hasTaskCall = toolCalls.some((tc: any) => tc?.name === "task");
        const isLatest = index === filteredMessages.length - 1;
        const shouldUseFallbackSubagents =
          subagentsForMessage.length === 0 &&
          allSubagents.length > 0 &&
          hasTaskCall &&
          isLatest;
        const subs = shouldUseFallbackSubagents
          ? allSubagents
          : subagentsForMessage;

        return (
          <OrchestratorMessage
            key={key}
            message={message}
            subagents={subs}
            isLastMessage={index === filteredMessages.length - 1}
            isLoading={isLoading}
            toolResultByCallId={toolResultByCallId}
          />
        );
      })}

      {showSynthesis && (
        <SynthesisIndicator subagentCount={allSubagents.length} />
      )}

      {isLoading &&
        allSubagents.length === 0 &&
        messages.length > 0 &&
        !routing?.isClassifying && (
          <div className="flex items-center gap-1.5 py-2">
            <div className="w-1.5 h-1.5 rounded-full bg-foreground/50 animate-[pulse_1.5s_ease-in-out_infinite]" />
            <div className="w-1.5 h-1.5 rounded-full bg-foreground/50 animate-[pulse_1.5s_ease-in-out_0.5s_infinite]" />
            <div className="w-1.5 h-1.5 rounded-full bg-foreground/50 animate-[pulse_1.5s_ease-in-out_1s_infinite]" />
          </div>
        )}
    </div>
  );
}
