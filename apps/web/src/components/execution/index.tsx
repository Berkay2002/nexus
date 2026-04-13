"use client";

import { ExecutionShell } from "./execution-shell";
import { useNexusStream } from "@/hooks/use-nexus-stream";
import {
  extractLatestTodosFromMessages,
  normalizeTodos,
} from "@/lib/subagent-utils";
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

  const todosFromValues = normalizeTodos((values as any)?.todos);
  const todosFromMessages = extractLatestTodosFromMessages(messages as any[]);
  const todos =
    todosFromMessages.length > 0 ? todosFromMessages : todosFromValues;
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
