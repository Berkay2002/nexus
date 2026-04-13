"use client";

import { ExecutionShell } from "./execution-shell";
import { useNexusStream } from "@/hooks/use-nexus-stream";
import type { NexusTodo } from "@/lib/subagent-utils";
import { collectWorkspaceOutputPaths } from "@/lib/workspace-files";

export function ExecutionView() {
  const {
    messages,
    isLoading,
    values,
    subagents,
    getSubagentsByMessage,
    submitPrompt,
    stop,
    error,
  } = useNexusStream();

  const todos: NexusTodo[] = (values as any)?.todos ?? [];
  const allSubagents = subagents ? [...subagents.values()] : [];
  const outputPaths = collectWorkspaceOutputPaths(messages, allSubagents);

  return (
    <ExecutionShell
      messages={messages}
      todos={todos}
      subagents={subagents}
      allSubagents={allSubagents}
      outputPaths={outputPaths}
      getSubagentsByMessage={getSubagentsByMessage}
      isLoading={isLoading}
      onSubmit={submitPrompt}
      onStop={stop}
      error={error}
    />
  );
}
