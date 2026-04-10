// apps/web/src/components/execution/agent-status-panel.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getAgentName,
  getElapsedTime,
  getStatusColor,
} from "@/lib/subagent-utils";
import { cn } from "@/lib/utils";
import { Circle, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

function AgentStatusIcon({
  status,
}: {
  status: "pending" | "running" | "complete" | "error";
}) {
  switch (status) {
    case "pending":
      return <Circle className="size-3.5 text-muted-foreground/50" />;
    case "running":
      return <Loader2 className="size-3.5 text-primary animate-spin" />;
    case "complete":
      return <CheckCircle2 className="size-3.5 text-green-500" />;
    case "error":
      return <XCircle className="size-3.5 text-destructive" />;
  }
}

function ElapsedTimer({
  startedAt,
  completedAt,
}: {
  startedAt: number | undefined;
  completedAt: number | undefined;
}) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!startedAt || completedAt) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [startedAt, completedAt]);

  const elapsed = getElapsedTime(startedAt, completedAt);
  if (!elapsed) return null;

  return (
    <span className="text-xs text-muted-foreground tabular-nums">
      {elapsed}
    </span>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AgentStatusItem({ subagent }: { subagent: any }) {
  const agentType = subagent.toolCall?.args?.subagent_type ?? "unknown";
  const status = subagent.status ?? "pending";

  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <AgentStatusIcon status={status} />
      <span
        className={cn(
          "text-sm flex-1 truncate",
          getStatusColor(status),
        )}
      >
        {getAgentName(agentType)}
      </span>
      <ElapsedTimer
        startedAt={subagent.startedAt}
        completedAt={subagent.completedAt}
      />
    </div>
  );
}

export function AgentStatusPanel({
  subagents,
}: {
  subagents: Map<string, any> | undefined;
}) {
  const agents = subagents ? [...subagents.values()] : [];

  if (agents.length === 0) return null;

  const running = agents.filter((a) => a.status === "running").length;
  const completed = agents.filter((a) => a.status === "complete").length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Agents
        </h3>
        <Badge variant="secondary" className="text-[0.6rem] h-4 px-1.5">
          {running > 0
            ? `${running} running`
            : `${completed}/${agents.length} done`}
        </Badge>
      </div>
      <ScrollArea className="max-h-[30vh]">
        <div className="flex flex-col gap-0.5">
          {agents.map((agent) => (
            <AgentStatusItem key={agent.id} subagent={agent} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
