"use client";

import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TodoPanel } from "./todo-panel";
import { AgentStatusPanel } from "./agent-status-panel";
import { MessageFeed } from "./message-feed";
import { PromptBar } from "./prompt-bar";
import { useNexusStream } from "@/hooks/use-nexus-stream";
import type { NexusTodo } from "@/lib/subagent-utils";
import { Conversation, ConversationContent } from "@/components/ai-elements/conversation";

export function ExecutionView() {
  const {
    messages,
    isLoading,
    values,
    subagents,
    getSubagentsByMessage,
    submitPrompt,
    stop,
  } = useNexusStream();

  const todos: NexusTodo[] = (values as any)?.todos ?? [];
  const allSubagents = subagents ? [...subagents.values()] : [];

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0">
        <h1 className="text-lg font-semibold tracking-tight">Nexus</h1>
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Working...
          </div>
        )}
      </div>

      {/* Main content */}
      <ResizablePanelGroup orientation="horizontal" className="flex-1 min-h-0">
        {/* Left panel: Mission Control (30%) */}
        <ResizablePanel
          defaultSize={30}
          minSize={20}
          maxSize={40}
          className="flex flex-col"
        >
          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-6 p-4">
              <TodoPanel todos={todos} />
              <AgentStatusPanel subagents={subagents} />

              {/* Empty state */}
              {todos.length === 0 && allSubagents.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    {isLoading
                      ? "Planning..."
                      : "Waiting for agent activity..."}
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right panel: Execution Feed (70%) */}
        <ResizablePanel defaultSize={70} minSize={50} className="flex flex-col">
          <Conversation className="flex-1">
            <ConversationContent className="gap-5 p-0">
              <MessageFeed
                messages={messages}
                getSubagentsByMessage={getSubagentsByMessage}
                allSubagents={allSubagents}
                isLoading={isLoading}
              />
            </ConversationContent>
          </Conversation>
          <PromptBar
            onSubmit={submitPrompt}
            isLoading={isLoading}
            onStop={stop}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
