// apps/web/src/lib/subagent-utils.ts

export interface NexusTodo {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed";
}

/** Map subagent_type to display-friendly model name */
const MODEL_MAP: Record<string, string> = {
  research: "gemini-3.1-pro",
  code: "gemini-3.1-pro",
  creative: "flash-image",
  "general-purpose": "gemini-3-flash",
};

export function getModelBadge(subagentType: string): string {
  return MODEL_MAP[subagentType] ?? subagentType;
}

/** Map subagent_type to display-friendly agent name */
const AGENT_NAME_MAP: Record<string, string> = {
  research: "Research Agent",
  code: "Code Agent",
  creative: "Creative Agent",
  "general-purpose": "General Agent",
};

export function getAgentName(subagentType: string): string {
  return AGENT_NAME_MAP[subagentType] ?? subagentType;
}

/** Format elapsed time from timestamps */
export function getElapsedTime(
  startedAt: number | undefined,
  completedAt: number | undefined,
): string | null {
  if (!startedAt) return null;
  const end = completedAt ?? Date.now();
  const seconds = Math.round((end - startedAt) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

/** Get status color class for a subagent status */
export function getStatusColor(
  status: "pending" | "running" | "complete" | "error",
): string {
  switch (status) {
    case "pending":
      return "text-muted-foreground";
    case "running":
      return "text-primary";
    case "complete":
      return "text-green-500";
    case "error":
      return "text-destructive";
  }
}
