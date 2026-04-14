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
  FolderIcon,
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
  ls: { label: "Listing directory", icon: FolderIcon },
};

function getToolDisplay(toolName: string) {
  return TOOL_DISPLAY[toolName] ?? { label: toolName.replace(/_/g, " "), icon: WrenchIcon };
}

type ToolCallRenderItem =
  | { kind: "single"; index: number; call: any }
  | { kind: "ls-group"; startIndex: number; endIndex: number; calls: any[] };

/**
 * Collapse runs of consecutive `ls` calls into a single render group so the
 * CoT doesn't stack up near-empty rows when the orchestrator orients itself
 * with multiple directory listings in a row.
 */
function groupToolCalls(toolCalls: any[]): ToolCallRenderItem[] {
  const items: ToolCallRenderItem[] = [];
  let i = 0;
  while (i < toolCalls.length) {
    const tc = toolCalls[i];
    if (tc?.name === "ls") {
      const group: any[] = [];
      const startIndex = i;
      while (i < toolCalls.length && toolCalls[i]?.name === "ls") {
        group.push(toolCalls[i]);
        i++;
      }
      items.push({
        kind: "ls-group",
        startIndex,
        endIndex: i - 1,
        calls: group,
      });
    } else {
      items.push({ kind: "single", index: i, call: tc });
      i++;
    }
  }
  return items;
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

type SelectedModelRefsByRole = Partial<
  Record<
    "orchestrator" | "research" | "code" | "creative" | "general-purpose",
    string
  >
>;

/**
 * Renders all AI messages for a single user turn as ONE chain-of-thought.
 *
 * Each AI message contributes:
 * - (optional) a prose block for text content
 * - one step per tool_call (write_todos, task [subagent dispatch], tavily_*, etc.)
 *
 * Consecutive `ls` calls within a message are further collapsed into a single
 * ls-group step via groupToolCalls(). Subagent cards are embedded inside
 * "Dispatching agent" steps via per-message id matching.
 */
function OrchestratorTurn({
  messages,
  subagentsByMessageId,
  isLoading,
  toolResultByCallId,
  selectedModelRefsByRole,
}: {
  messages: any[];
  subagentsByMessageId: Map<string, any[]>;
  isLoading: boolean;
  toolResultByCallId: Map<string, string>;
  selectedModelRefsByRole?: SelectedModelRefsByRole;
}) {
  if (messages.length === 0) return null;

  // Peel off the final synthesis message so collapsing the CoT doesn't hide
  // the orchestrator's answer. A message qualifies as "final synthesis" if it
  // is the last AI message in the turn, carries text content, and has no
  // tool calls of its own.
  const lastMessage = messages[messages.length - 1];
  const lastMessageToolCalls = lastMessage ? getToolCalls(lastMessage) : [];
  const lastMessageText = lastMessage
    ? getContentString(lastMessage.content).trim()
    : "";
  const hasFinalSynthesis =
    messages.length >= 1 &&
    lastMessageToolCalls.length === 0 &&
    lastMessageText.length > 0;
  const thinkingMessages = hasFinalSynthesis
    ? messages.slice(0, -1)
    : messages;
  const finalSynthesisMessage = hasFinalSynthesis ? lastMessage : null;

  const lastThinkingMessageId =
    thinkingMessages[thinkingMessages.length - 1]?.id;

  // Flatten tool-call counts and compute the turn-wide "last tool call" for
  // active status tracking. Only the trailing tool call of the trailing
  // thinking message can be active.
  let totalToolCalls = 0;
  let firstToolName: string | null = null;
  let lastToolCallId: string | undefined;
  for (const msg of thinkingMessages) {
    const calls = getToolCalls(msg);
    if (calls.length > 0) {
      totalToolCalls += calls.length;
      if (firstToolName === null) firstToolName = calls[0]?.name ?? null;
      if (msg.id === lastThinkingMessageId) {
        lastToolCallId = calls[calls.length - 1]?.id;
      }
    }
  }

  // If there are no tool calls anywhere in the turn (pure-text orchestrator
  // response), skip the CoT wrapper entirely — the prose below handles it.
  const hasAnyToolCalls = totalToolCalls > 0;
  const hasAnyThinkingText = thinkingMessages.some((m) =>
    getContentString(m.content).trim(),
  );

  if (!hasAnyToolCalls && !hasAnyThinkingText) {
    if (!finalSynthesisMessage) return null;
    return (
      <div className="text-sm">
        <MarkdownText>{lastMessageText}</MarkdownText>
      </div>
    );
  }

  const hasMultipleActions = totalToolCalls > 1;
  const headerLabel = hasMultipleActions
    ? `Running ${totalToolCalls} tasks`
    : firstToolName
      ? getToolDisplay(firstToolName).label
      : "Working...";

  // Track unmatched subagents across all messages in the turn (fallback rail).
  const matchedToolCallIds = new Set<string>();

  return (
    <div className="flex flex-col gap-4">
      {(hasAnyToolCalls || hasAnyThinkingText) && (
      <ChainOfThought defaultOpen={true}>
      <ChainOfThoughtHeader>{headerLabel}</ChainOfThoughtHeader>
      <ChainOfThoughtContent>
        {thinkingMessages.map((message, mIdx) => {
          const content = getContentString(message.content);
          const toolCalls: any[] = getToolCalls(message);
          const subagents = subagentsByMessageId.get(message.id) ?? [];

          const subagentByToolCallId = new Map<string, any>();
          for (const sub of subagents) {
            if (sub.toolCall?.id) {
              subagentByToolCallId.set(sub.toolCall.id, sub);
            }
          }

          const isTrailingMessage = message.id === lastThinkingMessageId;
          const isActive = isTrailingMessage && isLoading;

          const stepNodes = groupToolCalls(toolCalls).map((item, _itemIdx) => {
            if (item.kind === "ls-group") {
              const isGroupActive =
                isActive &&
                item.calls.some((c: any) => c.id === lastToolCallId);
              const groupLabel =
                item.calls.length === 1
                  ? (() => {
                      const p = item.calls[0].args?.path;
                      return typeof p === "string" && p
                        ? `Listing ${p}`
                        : "Listing directory";
                    })()
                  : `Listing ${item.calls.length} directories`;
              return (
                <ChainOfThoughtStep
                  key={`ls-group-${mIdx}-${item.startIndex}-${item.endIndex}`}
                  icon={FolderIcon}
                  label={groupLabel}
                  status={isGroupActive ? "active" : "complete"}
                >
                  <div className="mt-1 flex flex-col gap-1.5">
                    {item.calls.map((tc: any, j: number) => {
                      const toolOutput = tc.id
                        ? toolResultByCallId.get(tc.id)
                        : undefined;
                      return (
                        <FilesystemToolArtifact
                          key={tc.id ?? `ls-${mIdx}-${item.startIndex}-${j}`}
                          args={tc.args}
                          defaultOpen={
                            item.calls.length === 1 ||
                            (isGroupActive && j === item.calls.length - 1)
                          }
                          output={toolOutput}
                          toolName="ls"
                        />
                      );
                    })}
                  </div>
                </ChainOfThoughtStep>
              );
            }

            const { index: i, call: tc } = item;
            const toolName = tc.name ?? "tool";
            const display = getToolDisplay(toolName);
            const matchedSubagent = subagentByToolCallId.get(tc.id);
            const isCallActive = isActive && tc.id === lastToolCallId;
            const stepKey = tc.id ?? `msg-${mIdx}-tc-${i}`;

            if (matchedSubagent) {
              matchedToolCallIds.add(tc.id);
            }

            // For `task` calls (DeepAgents' subagent dispatch), embed the SubagentCard
            if (toolName === "task" && matchedSubagent) {
              const agentType = tc.args?.subagent_type ?? matchedSubagent.toolCall?.args?.subagent_type ?? "agent";
              return (
                <ChainOfThoughtStep
                  key={stepKey}
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
                      selectedModelRefsByRole={selectedModelRefsByRole}
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
                  key={stepKey}
                  icon={ListTodoIcon}
                  label={toolName === "write_todo" ? "Updating plan" : "Creating plan"}
                  status={isCallActive ? "active" : "complete"}
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
                key={stepKey}
                icon={display.icon}
                label={display.label}
                description={typeof description === "string" ? description : undefined}
                status={isCallActive ? "active" : "complete"}
              >
                {isExecuteTool && toolOutput ? (
                  <ExecuteToolArtifact
                    command={typeof tc.args?.command === "string" ? tc.args.command : undefined}
                    description={typeof description === "string" ? description : undefined}
                    isStreaming={isCallActive}
                    output={toolOutput}
                    title="Orchestrator execution"
                    defaultOpen={isCallActive}
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
          });

          const unmatchedSubagentNodes = subagents
            .filter((sub) => !matchedToolCallIds.has(sub.toolCall?.id))
            .map((sub) => {
              const agentType = sub.toolCall?.args?.subagent_type ?? "agent";
              const subDescription = sub.toolCall?.args?.description;
              return (
                <ChainOfThoughtStep
                  key={`sub-${mIdx}-${sub.id}`}
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
                      selectedModelRefsByRole={selectedModelRefsByRole}
                      defaultOpen={
                        normalizeSubagentStatus(sub.status) === "running" ||
                        normalizeSubagentStatus(sub.status) === "error" ||
                        subagents.length <= 3
                      }
                    />
                  </div>
                </ChainOfThoughtStep>
              );
            });

          return (
            <Fragment key={message.id ?? `msg-${mIdx}`}>
              {content.trim() ? (
                <div className="text-sm pl-6">
                  <MarkdownText>{content}</MarkdownText>
                </div>
              ) : null}
              {stepNodes}
              {unmatchedSubagentNodes}
            </Fragment>
          );
        })}
      </ChainOfThoughtContent>
    </ChainOfThought>
      )}
      {finalSynthesisMessage ? (
        <div className="text-sm">
          <MarkdownText>{lastMessageText}</MarkdownText>
        </div>
      ) : null}
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
  const showRoutingCard =
    routing !== undefined &&
    (routing.isClassifying || routing.result !== null);
  const selectedModelRefsByRole = routing?.result?.selectedModels;

  // Group messages into turns. Each turn starts with a human message (or the
  // conversation head) and accumulates every AI message until the next human
  // message. Tool messages are already filtered out of CoT rendering.
  type Turn = { human: any | null; aiMessages: any[] };
  const turns: Turn[] = [];
  {
    let current: Turn = { human: null, aiMessages: [] };
    for (const msg of filteredMessages) {
      if (msg.type === "human") {
        if (current.human || current.aiMessages.length > 0) turns.push(current);
        current = { human: msg, aiMessages: [] };
      } else if (msg.type !== "tool") {
        current.aiMessages.push(msg);
      }
    }
    if (current.human || current.aiMessages.length > 0) turns.push(current);
  }

  return (
    <div className="flex flex-col gap-5 py-6 px-4 w-full max-w-3xl mx-auto">
      {turns.map((turn, tIdx) => {
        const isLastTurn = tIdx === turns.length - 1;

        // Build per-message subagent map for this turn, with a fallback that
        // attaches the global subagent list to the latest `task` call when
        // per-message matching is empty (observed: initial render before the
        // SDK has populated message IDs on freshly-streamed AI chunks).
        const subagentsByMessageId = new Map<string, any[]>();
        for (let i = 0; i < turn.aiMessages.length; i++) {
          const m = turn.aiMessages[i];
          const direct = getSubagentsByMessage?.(m.id) ?? [];
          if (direct.length > 0) {
            subagentsByMessageId.set(m.id, direct);
            continue;
          }
          const isTrailing =
            isLastTurn && i === turn.aiMessages.length - 1;
          const hasTaskCall = getToolCalls(m).some(
            (tc: any) => tc?.name === "task",
          );
          if (isTrailing && hasTaskCall && allSubagents.length > 0) {
            subagentsByMessageId.set(m.id, allSubagents);
          } else {
            subagentsByMessageId.set(m.id, []);
          }
        }

        return (
          <Fragment key={`turn-${tIdx}`}>
            {turn.human ? (
              <HumanBubble
                content={getContentString(turn.human.content)}
              />
            ) : null}
            {showRoutingCard && isLastTurn ? <RoutingCard {...routing!} /> : null}
            {turn.aiMessages.length > 0 ? (
              <OrchestratorTurn
                messages={turn.aiMessages}
                subagentsByMessageId={subagentsByMessageId}
                isLoading={isLoading && isLastTurn}
                toolResultByCallId={toolResultByCallId}
                selectedModelRefsByRole={selectedModelRefsByRole}
              />
            ) : null}
          </Fragment>
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
