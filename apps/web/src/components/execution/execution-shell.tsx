"use client";

import type { ReactNode } from "react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { TodoPanel } from "./todo-panel";
import { AgentStatusPanel } from "./agent-status-panel";
import { MessageFeed } from "./message-feed";
import { PromptBar } from "./prompt-bar";
import { WorkspaceOutputsPanel } from "./workspace-outputs-panel";
import type { RoutingState } from "./routing-card";
import type { NexusTodo } from "@/lib/subagent-utils";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import {
  Conversation,
  ConversationContent,
} from "@/components/ai-elements/conversation";
import { SettingsButton } from "@/components/settings/settings-button";
import { ThreadPickerButton } from "@/components/thread-picker/thread-picker";

type ExecutionShellProps = {
  messages: any[];
  todos: NexusTodo[];
  subagents: Map<string, any> | undefined;
  allSubagents: any[];
  outputPaths: string[];
  getSubagentsByMessage: ((messageId: string) => any[]) | undefined;
  isLoading: boolean;
  routing?: RoutingState;
  onSubmit: (message: string | PromptInputMessage) => void;
  onStop: () => void;
  topSlot?: ReactNode;
  error?: unknown;
};

export function ExecutionShell({
  messages,
  todos,
  subagents,
  allSubagents,
  outputPaths,
  getSubagentsByMessage,
  isLoading,
  routing,
  onSubmit,
  onStop,
  topSlot,
  error,
}: ExecutionShellProps) {
  const errorMessage = error
    ? String((error as any)?.message ?? error)
    : null;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {topSlot}

      {errorMessage && (
        <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 shrink-0">
          <p className="text-sm text-destructive">
            <span className="font-semibold">Error:</span> {errorMessage}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0">
        <div className="flex items-center gap-3">
          <ThreadPickerButton />
          <h1 className="text-lg font-semibold tracking-tight">Nexus</h1>
        </div>
        <div className="flex items-center gap-3">
          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Working...
            </div>
          )}
          <SettingsButton />
        </div>
      </div>

      <ResizablePanelGroup orientation="horizontal" className="flex-1 min-h-0">
        <ResizablePanel
          defaultSize={30}
          minSize={20}
          maxSize={40}
          className="flex flex-col min-w-0 max-lg:hidden"
        >
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="flex flex-col gap-6 p-4">
              <TodoPanel todos={todos} />
              <AgentStatusPanel subagents={subagents} />
              <WorkspaceOutputsPanel paths={outputPaths} />

              {todos.length === 0 && allSubagents.length === 0 && outputPaths.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    {!isLoading
                      ? "Waiting for agent activity..."
                      : routing?.isClassifying
                        ? "Routing your request..."
                        : "Planning..."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle className="max-lg:hidden" />

        <ResizablePanel
          defaultSize={70}
          minSize={50}
          className="flex flex-col min-w-0"
        >
          <Conversation className="flex-1">
            <ConversationContent className="gap-5 p-0">
              <MessageFeed
                messages={messages}
                routing={routing}
                getSubagentsByMessage={getSubagentsByMessage}
                allSubagents={allSubagents}
                isLoading={isLoading}
              />
            </ConversationContent>
          </Conversation>
          <PromptBar
            onSubmit={onSubmit}
            isLoading={isLoading}
            onStop={onStop}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
