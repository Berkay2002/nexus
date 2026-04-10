"use client";

import { ExecutionShell } from "./execution-shell";
import { useNexusStream } from "@/hooks/use-nexus-stream";
import type { NexusTodo } from "@/lib/subagent-utils";

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
    <ExecutionShell
      messages={messages}
      todos={todos}
      subagents={subagents}
      allSubagents={allSubagents}
      getSubagentsByMessage={getSubagentsByMessage}
      isLoading={isLoading}
      onSubmit={submitPrompt}
      onStop={stop}
    />
  );
}
