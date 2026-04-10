# Plan 7: Frontend — Execution View

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the 30/70 split execution view that shows real-time agent orchestration — todo list + agent status on the left, coordinator messages + subagent streaming cards on the right.

**Architecture:** When `hasMessages` is true, page.tsx renders `ExecutionView` instead of `LandingPage`. The execution view uses `ResizablePanelGroup` (already installed via shadcn) for the 30/70 split. The left panel has two sections: a todo list driven by `stream.values?.todos` and an agent status list driven by `stream.subagents`. The right panel is a scrollable message feed where each coordinator message can have subagent cards nested beneath it via `stream.getSubagentsByMessage()`. A prompt input at the bottom allows follow-up messages.

**Tech Stack:** React 19.1, Next.js 15.5, `@langchain/react` useStream (subagent streaming), shadcn/ui (ResizablePanelGroup, Badge, Card, Collapsible, ScrollArea, Progress), ai-elements (Plan, Shimmer, Conversation), framer-motion, Tailwind CSS with existing mist/oklch dark theme.

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/components/execution/index.tsx` | ExecutionView — 30/70 layout shell with ResizablePanelGroup |
| `src/components/execution/todo-panel.tsx` | TodoPanel — renders `stream.values?.todos` with status icons |
| `src/components/execution/agent-status-panel.tsx` | AgentStatusPanel — renders `stream.subagents` with status badges + elapsed time |
| `src/components/execution/subagent-card.tsx` | SubagentCard — collapsible card with streaming content, status, model badge, elapsed time |
| `src/components/execution/message-feed.tsx` | MessageFeed — coordinator messages + subagent cards via `getSubagentsByMessage` |
| `src/components/execution/synthesis-indicator.tsx` | SynthesisIndicator — shown when all subagents done but coordinator still processing |
| `src/components/execution/prompt-bar.tsx` | PromptBar — bottom input for follow-up messages during/after execution |
| `src/lib/subagent-utils.ts` | Utility functions — elapsed time, model badge mapping, status helpers |

### Modified Files
| File | Changes |
|------|---------|
| `src/hooks/use-nexus-stream.ts` | Expose `subagents`, `getSubagentsByMessage`, `interrupt` from stream context |
| `src/app/page.tsx` | Replace placeholder with `<ExecutionView />` import |

### Existing Files Used (read-only reference)
| File | What we use from it |
|------|-------------------|
| `src/components/ui/resizable.tsx` | `ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle` |
| `src/components/ui/badge.tsx` | `Badge` for status and model badges |
| `src/components/ui/card.tsx` | `Card`, `CardHeader`, `CardContent` for subagent cards |
| `src/components/ui/collapsible.tsx` | `Collapsible` for expandable subagent cards |
| `src/components/ui/scroll-area.tsx` | `ScrollArea` for left panel scrolling |
| `src/components/ui/progress.tsx` | `Progress` for subagent progress bar |
| `src/components/ai-elements/shimmer.tsx` | `Shimmer` for streaming text effect |
| `src/components/ai-elements/conversation.tsx` | `Conversation`, `ConversationContent` for stick-to-bottom scrolling |
| `src/components/thread/markdown-text.tsx` | `MarkdownText` for rendering markdown in messages |
| `src/providers/Stream.tsx` | `useStreamContext` — the raw stream (useNexusStream wraps this) |

---

## Type Definitions

These types are used across multiple tasks. They are defined once here and implemented in Task 1.

```typescript
// src/lib/subagent-utils.ts

// SubagentStreamInterface comes from @langchain/react useStream return type.
// We re-export the shape here for clarity — the actual type is inferred from stream.subagents.
// Key fields:
//   id: string
//   status: "pending" | "running" | "complete" | "error"
//   messages: BaseMessage[]
//   result: string | undefined
//   toolCall: { id: string; name: string; args: { description: string; subagent_type: string; ... } }
//   startedAt: number | undefined
//   completedAt: number | undefined

// Todo item shape from DeepAgents write_todos tool:
export interface NexusTodo {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed";
}
```

---

## Task 1: Utility Functions and Types

**Files:**
- Create: `apps/web/src/lib/subagent-utils.ts`

This task establishes shared utilities used by all subsequent components.

- [ ] **Step 1: Create subagent-utils.ts with types and helpers**

```typescript
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
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors from `subagent-utils.ts`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/subagent-utils.ts
git commit -m "feat(web): add subagent utility functions and types"
```

---

## Task 2: Extend useNexusStream Hook

**Files:**
- Modify: `apps/web/src/hooks/use-nexus-stream.ts`

Expose subagent-related properties from the stream context so execution view components can access them.

- [ ] **Step 1: Update useNexusStream to expose subagent data**

Replace the entire file:

```typescript
// apps/web/src/hooks/use-nexus-stream.ts
"use client";

import { useStreamContext } from "@/providers/Stream";
import { useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { ensureToolCallsHaveResponses } from "@/lib/ensure-tool-responses";
import type { Message } from "@langchain/langgraph-sdk";

export function useNexusStream() {
  const stream = useStreamContext();

  const submitPrompt = useCallback(
    (text: string) => {
      const newMessage = {
        id: uuidv4(),
        type: "human" as const,
        content: text,
      };

      const toolMessages = ensureToolCallsHaveResponses(
        stream.messages as Message[],
      );
      stream.submit(
        { messages: [...toolMessages, newMessage] },
        {
          streamMode: ["values"],
          streamSubgraphs: true,
          optimisticValues: (prev: Record<string, unknown>) => ({
            ...prev,
            messages: [
              ...((prev.messages as unknown[]) ?? []),
              ...toolMessages,
              newMessage,
            ],
          }),
        },
      );
    },
    [stream],
  );

  const hasMessages = stream.messages.length > 0;

  // Subagent data — these come from @langchain/react useStream with filterSubagentMessages: true
  // stream.subagents is a Map<string, SubagentStreamInterface>
  // stream.getSubagentsByMessage returns SubagentStreamInterface[] for a given message ID
  const subagents = (stream as any).subagents as
    | Map<string, any>
    | undefined;
  const getSubagentsByMessage = (stream as any).getSubagentsByMessage as
    | ((messageId: string) => any[])
    | undefined;

  return {
    messages: stream.messages,
    isLoading: stream.isLoading,
    error: stream.error,
    values: stream.values,
    submit: stream.submit,
    stop: stream.stop,
    interrupt: stream.interrupt,
    submitPrompt,
    hasMessages,
    subagents,
    getSubagentsByMessage,
  };
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/use-nexus-stream.ts
git commit -m "feat(web): expose subagent streaming data from useNexusStream"
```

---

## Task 3: Todo Panel Component

**Files:**
- Create: `apps/web/src/components/execution/todo-panel.tsx`

Renders the plan/todo list from `stream.values?.todos` in the top section of the left panel.

- [ ] **Step 1: Create todo-panel.tsx**

```tsx
// apps/web/src/components/execution/todo-panel.tsx
"use client";

import { cn } from "@/lib/utils";
import type { NexusTodo } from "@/lib/subagent-utils";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

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
        {todo.title}
      </span>
    </div>
  );
}

export function TodoPanel({ todos }: { todos: NexusTodo[] }) {
  if (todos.length === 0) return null;

  const completed = todos.filter((t) => t.status === "completed").length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Plan
        </h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          {completed}/{todos.length}
        </span>
      </div>
      <ScrollArea className="max-h-[40vh]">
        <div className="flex flex-col gap-0.5">
          {todos.map((todo) => (
            <TodoItem key={todo.id} todo={todo} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | grep "todo-panel" | head -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/execution/todo-panel.tsx
git commit -m "feat(web): add TodoPanel component for plan progress tracking"
```

---

## Task 4: Agent Status Panel Component

**Files:**
- Create: `apps/web/src/components/execution/agent-status-panel.tsx`

Renders the list of active sub-agents from `stream.subagents` in the bottom section of the left panel. Shows agent name, status badge, and elapsed time.

- [ ] **Step 1: Create agent-status-panel.tsx**

```tsx
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
```

- [ ] **Step 2: Verify compilation**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | grep "agent-status" | head -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/execution/agent-status-panel.tsx
git commit -m "feat(web): add AgentStatusPanel for real-time agent tracking"
```

---

## Task 5: Subagent Card Component

**Files:**
- Create: `apps/web/src/components/execution/subagent-card.tsx`

The core component of the execution view. A collapsible card that shows a subagent's status, task description, streaming content, model badge, and elapsed time. Auto-collapses when complete if there are 3+ agents.

- [ ] **Step 1: Create subagent-card.tsx**

```tsx
// apps/web/src/components/execution/subagent-card.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  getAgentName,
  getElapsedTime,
  getModelBadge,
  getStatusColor,
} from "@/lib/subagent-utils";
import {
  ChevronDown,
  Circle,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { MarkdownText } from "@/components/thread/markdown-text";

function CardStatusIcon({
  status,
}: {
  status: "pending" | "running" | "complete" | "error";
}) {
  switch (status) {
    case "pending":
      return <Circle className="size-4 text-muted-foreground/50" />;
    case "running":
      return <Loader2 className="size-4 text-primary animate-spin" />;
    case "complete":
      return <CheckCircle2 className="size-4 text-green-500" />;
    case "error":
      return <XCircle className="size-4 text-destructive" />;
  }
}

function CardElapsedTimer({
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

function StreamingContent({ subagent }: { subagent: any }) {
  // When complete, show result. Otherwise show last AI message content.
  if (subagent.status === "complete" && subagent.result) {
    return (
      <div className="text-sm text-foreground/90">
        <MarkdownText>{subagent.result}</MarkdownText>
      </div>
    );
  }

  if (subagent.status === "error") {
    const lastMsg = subagent.messages?.[subagent.messages.length - 1];
    const errorText =
      typeof lastMsg?.content === "string"
        ? lastMsg.content
        : "An error occurred";
    return (
      <p className="text-sm text-destructive">{errorText}</p>
    );
  }

  // Streaming: show last AI message
  const aiMessages = (subagent.messages ?? []).filter(
    (m: any) => m.type === "ai" || m._getType?.() === "ai",
  );
  const lastAI = aiMessages[aiMessages.length - 1];
  if (!lastAI) {
    if (subagent.status === "pending") {
      return (
        <p className="text-sm text-muted-foreground italic">Waiting...</p>
      );
    }
    return (
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        <p className="text-sm text-muted-foreground">Working...</p>
      </div>
    );
  }

  const content =
    typeof lastAI.content === "string"
      ? lastAI.content
      : Array.isArray(lastAI.content)
        ? lastAI.content
            .filter((c: any) => c.type === "text")
            .map((c: any) => c.text)
            .join("")
        : "";

  if (!content) return null;

  return (
    <div className="text-sm text-foreground/80">
      <MarkdownText>{content}</MarkdownText>
      {subagent.status === "running" && (
        <span className="inline-block w-1.5 h-4 bg-primary/70 animate-pulse ml-0.5 align-text-bottom" />
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function SubagentCard({
  subagent,
  defaultOpen = true,
}: {
  subagent: any;
  defaultOpen?: boolean;
}) {
  const agentType = subagent.toolCall?.args?.subagent_type ?? "unknown";
  const description = subagent.toolCall?.args?.description ?? "";
  const status = subagent.status ?? "pending";

  return (
    <Collapsible defaultOpen={defaultOpen}>
      <div
        className={cn(
          "rounded-lg border bg-card/50 overflow-hidden transition-colors",
          status === "running" && "border-primary/30",
          status === "error" && "border-destructive/30",
        )}
      >
        <CollapsibleTrigger className="flex w-full items-center gap-2.5 px-3 py-2.5 hover:bg-accent/50 transition-colors cursor-pointer">
          <CardStatusIcon status={status} />
          <div className="flex flex-col items-start flex-1 min-w-0">
            <div className="flex items-center gap-2 w-full">
              <span className="text-sm font-medium truncate">
                {getAgentName(agentType)}
              </span>
              <Badge
                variant="outline"
                className="text-[0.6rem] h-4 px-1.5 font-mono shrink-0"
              >
                {getModelBadge(agentType)}
              </Badge>
            </div>
            {description && (
              <span className="text-xs text-muted-foreground truncate w-full text-left">
                {description}
              </span>
            )}
          </div>
          <CardElapsedTimer
            startedAt={subagent.startedAt}
            completedAt={subagent.completedAt}
          />
          <ChevronDown className="size-4 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180 shrink-0" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-1 border-t border-border/50">
            <div className="max-h-[300px] overflow-y-auto">
              <StreamingContent subagent={subagent} />
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | grep "subagent-card" | head -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/execution/subagent-card.tsx
git commit -m "feat(web): add SubagentCard with streaming content and status indicators"
```

---

## Task 6: Synthesis Indicator + Prompt Bar

**Files:**
- Create: `apps/web/src/components/execution/synthesis-indicator.tsx`
- Create: `apps/web/src/components/execution/prompt-bar.tsx`

The synthesis indicator shows when all subagents are done but the coordinator is still assembling the final response. The prompt bar allows follow-up messages.

- [ ] **Step 1: Create synthesis-indicator.tsx**

```tsx
// apps/web/src/components/execution/synthesis-indicator.tsx
"use client";

import { Loader2 } from "lucide-react";

export function SynthesisIndicator({
  subagentCount,
}: {
  subagentCount: number;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
      <Loader2 className="size-4 text-primary animate-spin" />
      <span className="text-sm text-foreground/80">
        Synthesizing results from {subagentCount} agent
        {subagentCount !== 1 ? "s" : ""}...
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Create prompt-bar.tsx**

```tsx
// apps/web/src/components/execution/prompt-bar.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Loader2, ArrowUp } from "lucide-react";
import { useState, type FormEvent } from "react";

export function PromptBar({
  onSubmit,
  isLoading,
  onStop,
}: {
  onSubmit: (text: string) => void;
  isLoading: boolean;
  onStop: () => void;
}) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSubmit(input.trim());
    setInput("");
  };

  return (
    <div className="border-t bg-background/95 backdrop-blur-sm p-3">
      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 max-w-3xl mx-auto"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              const form = (e.target as HTMLElement).closest("form");
              form?.requestSubmit();
            }
          }}
          placeholder="Follow up..."
          rows={1}
          className="flex-1 resize-none rounded-xl border bg-muted/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring field-sizing-content max-h-[120px]"
        />
        {isLoading ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={onStop}
          >
            <Loader2 className="size-4 animate-spin" />
            Stop
          </Button>
        ) : (
          <Button
            type="submit"
            size="sm"
            disabled={!input.trim()}
            className="shrink-0"
          >
            <ArrowUp className="size-4" />
          </Button>
        )}
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Verify compilation**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | grep -E "synthesis|prompt-bar" | head -5`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/execution/synthesis-indicator.tsx apps/web/src/components/execution/prompt-bar.tsx
git commit -m "feat(web): add SynthesisIndicator and PromptBar components"
```

---

## Task 7: Message Feed Component

**Files:**
- Create: `apps/web/src/components/execution/message-feed.tsx`

Renders coordinator messages in the right panel. Each AI message that spawned subagents gets subagent cards nested beneath it. Human messages render as bubbles (reusing the existing pattern).

- [ ] **Step 1: Create message-feed.tsx**

```tsx
// apps/web/src/components/execution/message-feed.tsx
"use client";

import { cn } from "@/lib/utils";
import { SubagentCard } from "./subagent-card";
import { SynthesisIndicator } from "./synthesis-indicator";
import { MarkdownText } from "@/components/thread/markdown-text";
import { DO_NOT_RENDER_ID_PREFIX } from "@/lib/ensure-tool-responses";

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

function HumanBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="px-4 py-2 rounded-2xl bg-muted max-w-[80%]">
        <p className="text-sm whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}

function CoordinatorMessage({ content }: { content: string }) {
  if (!content.trim()) return null;
  return (
    <div className="text-sm">
      <MarkdownText>{content}</MarkdownText>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MessageWithSubagents({
  message,
  subagents,
}: {
  message: any;
  subagents: any[];
}) {
  const content = getContentString(message.content);
  const isHuman = message.type === "human";
  const isTool = message.type === "tool";

  if (isHuman) {
    return <HumanBubble content={content} />;
  }

  // Skip standalone tool messages — they're shown inside subagent cards
  if (isTool) return null;

  return (
    <div className="flex flex-col gap-3">
      <CoordinatorMessage content={content} />
      {subagents.length > 0 && (
        <div className="flex flex-col gap-2.5 ml-1 pl-3 border-l-2 border-primary/20">
          {subagents.map((sub, i) => (
            <SubagentCard
              key={sub.id}
              subagent={sub}
              defaultOpen={
                sub.status === "running" ||
                sub.status === "error" ||
                subagents.length <= 3
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function MessageFeed({
  messages,
  getSubagentsByMessage,
  allSubagents,
  isLoading,
}: {
  messages: any[];
  getSubagentsByMessage: ((messageId: string) => any[]) | undefined;
  allSubagents: any[];
  isLoading: boolean;
}) {
  // Determine if we should show synthesis indicator:
  // All subagents are done (complete or error) but stream is still loading
  const allSubagentsDone =
    allSubagents.length > 0 &&
    allSubagents.every(
      (s) => s.status === "complete" || s.status === "error",
    );
  const showSynthesis = allSubagentsDone && isLoading;

  return (
    <div className="flex flex-col gap-5 py-6 px-4 max-w-3xl mx-auto">
      {messages
        .filter((m) => !m.id?.startsWith(DO_NOT_RENDER_ID_PREFIX))
        .map((message, index) => {
          const subs = getSubagentsByMessage?.(message.id) ?? [];
          return (
            <MessageWithSubagents
              key={message.id || `msg-${index}`}
              message={message}
              subagents={subs}
            />
          );
        })}

      {showSynthesis && (
        <SynthesisIndicator subagentCount={allSubagents.length} />
      )}

      {/* Loading dots when waiting for first token and no subagents yet */}
      {isLoading && allSubagents.length === 0 && messages.length > 0 && (
        <div className="flex items-center gap-1.5 py-2">
          <div className="w-1.5 h-1.5 rounded-full bg-foreground/50 animate-[pulse_1.5s_ease-in-out_infinite]" />
          <div className="w-1.5 h-1.5 rounded-full bg-foreground/50 animate-[pulse_1.5s_ease-in-out_0.5s_infinite]" />
          <div className="w-1.5 h-1.5 rounded-full bg-foreground/50 animate-[pulse_1.5s_ease-in-out_1s_infinite]" />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd apps/web && npx tsc --noEmit --pretty 2>&1 | grep "message-feed" | head -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/execution/message-feed.tsx
git commit -m "feat(web): add MessageFeed with coordinator messages and subagent cards"
```

---

## Task 8: Execution View Layout Shell

**Files:**
- Create: `apps/web/src/components/execution/index.tsx`
- Modify: `apps/web/src/app/page.tsx`

The main execution view component. Uses `ResizablePanelGroup` for the 30/70 split. Left panel has TodoPanel + AgentStatusPanel. Right panel has MessageFeed + PromptBar. Also wires it into page.tsx.

- [ ] **Step 1: Create execution/index.tsx**

```tsx
// apps/web/src/components/execution/index.tsx
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
      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
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
```

- [ ] **Step 2: Update page.tsx to use ExecutionView**

Replace the entire file `apps/web/src/app/page.tsx`:

```tsx
// apps/web/src/app/page.tsx
"use client";

import React from "react";
import { StreamProvider } from "@/providers/Stream";
import { ThreadProvider } from "@/providers/Thread";
import { Toaster } from "@/components/ui/sonner";
import { LandingPage } from "@/components/landing";
import { ExecutionView } from "@/components/execution";
import { useNexusStream } from "@/hooks/use-nexus-stream";

function NexusApp() {
  const { submitPrompt, isLoading, hasMessages } = useNexusStream();

  if (hasMessages) {
    return <ExecutionView />;
  }

  return <LandingPage onSubmit={submitPrompt} isLoading={isLoading} />;
}

export default function Page(): React.ReactNode {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <Toaster theme="dark" />
      <ThreadProvider>
        <StreamProvider>
          <NexusApp />
        </StreamProvider>
      </ThreadProvider>
    </React.Suspense>
  );
}
```

- [ ] **Step 3: Verify the full build compiles**

Run: `cd apps/web && npx next build 2>&1 | tail -30`
Expected: Build succeeds (or only pre-existing errors from apps/agents)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/execution/index.tsx apps/web/src/app/page.tsx
git commit -m "feat(web): wire ExecutionView with 30/70 split layout into page routing"
```

---

## Task 9: Visual Polish Pass

**Files:**
- Modify: `apps/web/src/components/execution/index.tsx`
- Modify: `apps/web/src/components/execution/subagent-card.tsx`
- Modify: `apps/web/src/components/execution/message-feed.tsx`

Final polish: ensure the execution view looks cohesive in dark mode, add subtle border transitions on subagent cards, add a progress bar at the top of the left panel when agents are running, and verify mobile responsiveness (collapse to single panel on small screens).

- [ ] **Step 1: Add SubagentProgress bar to the left panel**

In `apps/web/src/components/execution/index.tsx`, add a progress bar below the header showing overall subagent completion:

After the `<h1>` header section, add:

```tsx
// Inside the header div, after the "Working..." indicator
{allSubagents.length > 0 && (
  <div className="px-4 pb-2 border-b shrink-0">
    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
      <span>Progress</span>
      <span className="tabular-nums">
        {allSubagents.filter((s) => s.status === "complete").length}/{allSubagents.length}
      </span>
    </div>
    <div className="h-1 rounded-full bg-muted overflow-hidden">
      <div
        className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
        style={{
          width: `${allSubagents.length > 0
            ? Math.round(
                (allSubagents.filter((s) => s.status === "complete").length /
                  allSubagents.length) *
                  100,
              )
            : 0}%`,
        }}
      />
    </div>
  </div>
)}
```

- [ ] **Step 2: Add mobile fallback — hide left panel on small screens**

In `apps/web/src/components/execution/index.tsx`, wrap the `ResizablePanelGroup` with responsive logic:

```tsx
// At the top of ExecutionView, add:
import { useMediaQuery } from "@/hooks/useMediaQuery";

// Inside the component:
const isLargeScreen = useMediaQuery("(min-width: 1024px)");
```

Then conditionally render the left panel:

```tsx
{isLargeScreen && (
  <>
    <ResizablePanel defaultSize={30} minSize={20} maxSize={40} className="flex flex-col">
      {/* ... left panel content ... */}
    </ResizablePanel>
    <ResizableHandle withHandle />
  </>
)}
<ResizablePanel defaultSize={isLargeScreen ? 70 : 100} minSize={50} className="flex flex-col">
  {/* ... right panel content ... */}
</ResizablePanel>
```

- [ ] **Step 3: Verify the full build**

Run: `cd apps/web && npx next build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/execution/
git commit -m "feat(web): add progress bar and mobile responsive layout to execution view"
```

---

## Verification Checklist

After all tasks are complete, verify the full end-to-end flow:

- [ ] `cd apps/web && npx next build` succeeds
- [ ] Landing page still renders correctly at `/` with no messages
- [ ] When a prompt is submitted, the view transitions to the execution layout
- [ ] Left panel shows todo items as they appear in `stream.values?.todos`
- [ ] Left panel shows agent status list from `stream.subagents`
- [ ] Right panel shows coordinator messages from `stream.messages`
- [ ] Subagent cards appear beneath the coordinator message that triggered them
- [ ] Subagent cards show status icon, agent name, model badge, description, elapsed time
- [ ] Streaming content appears inside subagent cards in real-time
- [ ] Synthesis indicator shows when all agents done but coordinator still working
- [ ] Follow-up prompt bar at the bottom works
- [ ] On small screens, the left panel hides and right panel takes full width

**Note:** Full end-to-end verification requires the LangGraph agent server running at `:2024` (run `npm run dev` from repo root). The frontend build can be verified independently.
