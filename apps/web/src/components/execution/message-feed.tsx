// apps/web/src/components/execution/message-feed.tsx
"use client";

import { SubagentCard } from "./subagent-card";
import { SynthesisIndicator } from "./synthesis-indicator";
import { MarkdownText } from "@/components/thread/markdown-text";
import { DO_NOT_RENDER_ID_PREFIX } from "@/lib/ensure-tool-responses";
import {
  ChainOfThought,
  ChainOfThoughtHeader,
  ChainOfThoughtContent,
  ChainOfThoughtStep,
} from "@/components/ai-elements/chain-of-thought";
import {
  GitBranchIcon,
  BrainIcon,
  ListTodoIcon,
  WrenchIcon,
  SearchIcon,
  GlobeIcon,
  ImageIcon,
  CodeIcon,
  SparklesIcon,
} from "lucide-react";
import { getAgentName } from "@/lib/subagent-utils";

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

/** Map tool names to display-friendly labels and icons */
const TOOL_DISPLAY: Record<string, { label: string; icon: typeof WrenchIcon }> = {
  tavily_search: { label: "Searching the web", icon: SearchIcon },
  tavily_extract: { label: "Extracting content", icon: GlobeIcon },
  tavily_map: { label: "Mapping URLs", icon: GlobeIcon },
  generate_image: { label: "Generating image", icon: ImageIcon },
  write_todos: { label: "Creating plan", icon: ListTodoIcon },
  create_subagent: { label: "Dispatching agent", icon: GitBranchIcon },
  execute_code: { label: "Running code", icon: CodeIcon },
};

function getToolDisplay(toolName: string) {
  return TOOL_DISPLAY[toolName] ?? { label: toolName.replace(/_/g, " "), icon: WrenchIcon };
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
 * - tool_calls (actions like create_subagent, write_todos, tavily_search)
 *
 * We parse these into CoT steps. Subagent cards are embedded inside
 * the "Dispatching agent" steps.
 */
function OrchestratorMessage({
  message,
  subagents,
  isLastMessage,
  isLoading,
}: {
  message: any;
  subagents: any[];
  isLastMessage: boolean;
  isLoading: boolean;
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

            // For create_subagent calls, embed the SubagentCard
            if (toolName === "create_subagent" && matchedSubagent) {
              const agentType = tc.args?.subagent_type ?? matchedSubagent.toolCall?.args?.subagent_type ?? "agent";
              return (
                <ChainOfThoughtStep
                  key={tc.id ?? i}
                  icon={display.icon}
                  label={`Dispatching ${getAgentName(agentType)}`}
                  status={
                    matchedSubagent.status === "complete" || matchedSubagent.status === "error"
                      ? "complete"
                      : matchedSubagent.status === "running"
                        ? "active"
                        : "pending"
                  }
                >
                  <div className="mt-1">
                    <SubagentCard
                      subagent={matchedSubagent}
                      defaultOpen={
                        matchedSubagent.status === "running" ||
                        matchedSubagent.status === "error" ||
                        subagents.length <= 3
                      }
                    />
                  </div>
                </ChainOfThoughtStep>
              );
            }

            // For write_todos, show the plan items
            if (toolName === "write_todos" && tc.args?.todos) {
              const todos = tc.args.todos as any[];
              return (
                <ChainOfThoughtStep
                  key={tc.id ?? i}
                  icon={ListTodoIcon}
                  label="Creating plan"
                  status={isActive ? "active" : "complete"}
                >
                  <div className="flex flex-col gap-1 mt-1">
                    {todos.map((todo: any, j: number) => (
                      <div key={j} className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <span className="text-muted-foreground/50">{"○"}</span>
                        {todo.title ?? todo}
                      </div>
                    ))}
                  </div>
                </ChainOfThoughtStep>
              );
            }

            // For other tools (search, extract, etc.)
            const description =
              tc.args?.query ?? tc.args?.url ?? tc.args?.description ?? undefined;

            return (
              <ChainOfThoughtStep
                key={tc.id ?? i}
                icon={display.icon}
                label={display.label}
                description={typeof description === "string" ? description : undefined}
                status={isActive && i === toolCalls.length - 1 ? "active" : "complete"}
              />
            );
          })}

          {/* Render any subagents that didn't match a tool call */}
          {subagents
            .filter((sub) => !matchedToolCallIds.has(sub.toolCall?.id))
            .map((sub) => {
              const agentType = sub.toolCall?.args?.subagent_type ?? "agent";
              return (
                <ChainOfThoughtStep
                  key={sub.id}
                  icon={GitBranchIcon}
                  label={`Dispatching ${getAgentName(agentType)}`}
                  description={sub.toolCall?.args?.description}
                  status={
                    sub.status === "complete" || sub.status === "error"
                      ? "complete"
                      : sub.status === "running"
                        ? "active"
                        : "pending"
                  }
                >
                  <div className="mt-1">
                    <SubagentCard
                      subagent={sub}
                      defaultOpen={
                        sub.status === "running" ||
                        sub.status === "error" ||
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
  getSubagentsByMessage,
  allSubagents,
  isLoading,
}: {
  messages: any[];
  getSubagentsByMessage: ((messageId: string) => any[]) | undefined;
  allSubagents: any[];
  isLoading: boolean;
}) {
  const allSubagentsDone =
    allSubagents.length > 0 &&
    allSubagents.every(
      (s) => s.status === "complete" || s.status === "error",
    );
  const showSynthesis = allSubagentsDone && isLoading;

  const filteredMessages = messages.filter(
    (m) => !m.id?.startsWith(DO_NOT_RENDER_ID_PREFIX),
  );

  return (
    <div className="flex flex-col gap-5 py-6 px-4 max-w-3xl mx-auto">
      {filteredMessages.map((message, index) => {
        const isHuman = message.type === "human";
        const isTool = message.type === "tool";

        if (isHuman) {
          return (
            <HumanBubble
              key={message.id || `msg-${index}`}
              content={getContentString(message.content)}
            />
          );
        }

        // Skip standalone tool result messages — shown inside CoT
        if (isTool) return null;

        // AI message — render as orchestrator CoT
        const subs = getSubagentsByMessage?.(message.id) ?? [];
        return (
          <OrchestratorMessage
            key={message.id || `msg-${index}`}
            message={message}
            subagents={subs}
            isLastMessage={index === filteredMessages.length - 1}
            isLoading={isLoading}
          />
        );
      })}

      {showSynthesis && (
        <SynthesisIndicator subagentCount={allSubagents.length} />
      )}

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
