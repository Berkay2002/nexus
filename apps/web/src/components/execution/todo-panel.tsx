// apps/web/src/components/execution/todo-panel.tsx
"use client";

import { cn } from "@/lib/utils";
import type { NexusTodo } from "@/lib/subagent-utils";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SectionHeaderCollapsible } from "./section-header-collapsible";

function TodoStatusIcon({ status }: { status: NexusTodo["status"] }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="size-4 shrink-0 text-green-500" />;
    case "in_progress":
      return (
        <Loader2 className="size-4 shrink-0 text-primary animate-spin" />
      );
    case "pending":
      return <Circle className="size-4 shrink-0 text-muted-foreground/50" />;
  }
}

function TodoItem({ todo }: { todo: NexusTodo }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <TodoStatusIcon status={todo.status} />
      <span
        className={cn(
          "text-sm leading-tight",
          todo.status === "completed" && "text-muted-foreground line-through",
          todo.status === "in_progress" && "text-foreground",
          todo.status === "pending" && "text-muted-foreground",
        )}
      >
        {todo.content}
      </span>
    </div>
  );
}

export function TodoPanel({ todos }: { todos: NexusTodo[] }) {
  if (todos.length === 0) return null;

  const completed = todos.filter((t) => t.status === "completed").length;

  return (
    <SectionHeaderCollapsible
      title="Plan"
      rightSlot={
        <span className="text-xs text-muted-foreground tabular-nums">
          {completed}/{todos.length}
        </span>
      }
    >
      <ScrollArea className="max-h-[40vh]">
        <div className="flex flex-col gap-0.5">
          {todos.map((todo, i) => (
            <TodoItem key={`${i}-${todo.content}`} todo={todo} />
          ))}
        </div>
      </ScrollArea>
    </SectionHeaderCollapsible>
  );
}
