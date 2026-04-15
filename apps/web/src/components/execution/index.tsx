"use client";

import { ExecutionShell } from "./execution-shell";
import { useNexusStream } from "@/hooks/use-nexus-stream";
import {
  extractTodosFromValues,
  extractLatestTodosFromMessages,
} from "@/lib/subagent-utils";
import { collectWorkspaceOutputPaths } from "@/lib/workspace-files";
import { useQueryState } from "nuqs";

export function ExecutionView() {
  const [threadId] = useQueryState("threadId");
  const {
    messages,
    isLoading,
    values,
    subagents,
    getSubagentsByMessage,
    submitPrompt,
    stop,
    error,
    routing,
    queue,
  } = useNexusStream();

  const todosFromValues = extractTodosFromValues(values as any);
  const todosFromMessages = extractLatestTodosFromMessages(messages as any[]);
  const todos =
    todosFromValues.length > 0 ? todosFromValues : todosFromMessages;
  const allSubagents = subagents ? [...subagents.values()] : [];
  const outputPaths = collectWorkspaceOutputPaths(
    messages,
    allSubagents,
    threadId ?? undefined,
  );

  return (
    <ExecutionShell
      messages={messages}
      todos={todos}
      subagents={subagents}
      allSubagents={allSubagents}
      outputPaths={outputPaths}
      getSubagentsByMessage={getSubagentsByMessage}
      isLoading={isLoading}
      routing={routing}
      onSubmit={submitPrompt}
      onStop={stop}
      error={error}
      queue={queue}
    />
  );
}
