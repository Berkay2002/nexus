"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { ExecutionShell } from "@/components/execution/execution-shell";
import type { RoutingState } from "@/components/execution/routing-card";
import type { NexusTodo } from "@/lib/subagent-utils";
import { Button } from "@/components/ui/button";
import { Compass, RotateCcw, Play, FastForward } from "lucide-react";
import type { Thread } from "@langchain/langgraph-sdk";
import {
  ThreadContext,
  type ThreadContextType,
} from "@/providers/Thread";
import StreamContext, {
  type StreamContextType,
} from "@/providers/Stream";
import { ThreadPickerProvider } from "@/components/thread-picker/thread-picker";

// ─── Mock Data ───────────────────────────────────────────────────────

const MOCK_TODOS: NexusTodo[] = [
  { content: "Analyze user request and determine required agents", status: "completed" },
  { content: "Research current AI education landscape and K-12 adoption rates", status: "completed" },
  { content: "Generate comparison table of top AI tutoring platforms", status: "in_progress" },
  { content: "Create visualization of adoption trends (2020-2025)", status: "pending" },
  { content: "Write executive summary with key findings and recommendations", status: "pending" },
  { content: "Compile final deliverable with all sections", status: "pending" },
];

const COMPLETED_TODOS: NexusTodo[] = [
  { content: "Analyze user request and determine required agents", status: "completed" },
  { content: "Research current AI education landscape", status: "completed" },
  { content: "Generate comparison table of AI platforms", status: "completed" },
  { content: "Create adoption trends visualization", status: "completed" },
  { content: "Write executive summary", status: "completed" },
  { content: "Compile final deliverable", status: "completed" },
];

const MOCK_OUTPUT_PATHS = [
  "/home/gem/workspace/creative/task_sa3/adoption-chart.png",
  "/home/gem/workspace/shared/executive-summary.md",
];

function createMockSubagent(
  id: string,
  type: string,
  description: string,
  status: "pending" | "running" | "complete" | "error",
  startedAt?: number,
  completedAt?: number,
  result?: string,
  messages?: any[],
) {
  return {
    id,
    status,
    result,
    messages: messages ?? [],
    toolCall: {
      id: `call_${id}`,
      name: "task",
      args: { subagent_type: type, description },
    },
    startedAt,
    completedAt,
  };
}

const now = Date.now();

const INITIAL_SUBAGENTS = [
  createMockSubagent(
    "sa-1",
    "research",
    "Research current AI education landscape and K-12 adoption rates across the US",
    "complete",
    now - 45000,
    now - 12000,
    "## AI in K-12 Education: Key Findings\n\n**Adoption Rate:** 67% of US K-12 schools have integrated AI-powered educational tools.\n\n**Top Platforms:**\n- **Khan Academy (Khanmigo)** — 15M+ students\n- **Duolingo Max** — AI conversation partner\n- **Century Tech** — Adaptive learning pathways\n\n**Key Trends:**\n1. Personalized learning paths: 23% improvement in test scores\n2. Teacher AI assistants: 40% reduction in grading time\n3. Early intervention: identifying at-risk students 3x faster",
    [
      {
        type: "ai",
        content: "Let me search for the latest data on AI adoption in K-12 education.",
        tool_calls: [{ id: "tc-search-1", name: "tavily_search", args: { query: "AI education K-12 adoption rates 2025" } }],
      },
      {
        type: "tool",
        name: "tavily_search",
        content: "Found 12 results for AI education K-12 adoption...",
      },
      {
        type: "ai",
        content: "Now let me extract detailed data from the top sources.",
        tool_calls: [{ id: "tc-extract-1", name: "tavily_extract", args: { url: "https://edtechreport.org/ai-k12-2025" } }],
      },
      {
        type: "tool",
        name: "tavily_extract",
        content: "Extracted: 67% adoption rate, top platforms include Khan Academy...",
      },
      {
        type: "ai",
        content: "Compiling the findings into a structured report.",
      },
    ],
  ),
  createMockSubagent(
    "sa-2",
    "code",
    "Generate comparison table of top AI tutoring platforms with features, pricing, and adoption metrics",
    "running",
    now - 20000,
    undefined,
    undefined,
    [
      {
        type: "ai",
        content: "I'll build a comprehensive comparison table. Let me search for pricing and feature data.",
        tool_calls: [{ id: "tc-search-2", name: "tavily_search", args: { query: "AI tutoring platform pricing comparison 2025" } }],
      },
      {
        type: "tool",
        name: "tavily_search",
        content: "Found pricing data for Khanmigo ($44/yr), Duolingo Max ($30/mo)...",
      },
      {
        type: "ai",
        content: "Building the comparison matrix with verified data points...\n\n| Platform | Students | AI Model | Price/Student |\n|----------|----------|----------|---------------|\n| Khanmigo | 15M+ | GPT-4 | $44/yr |\n| Duolingo Max | 8M+ | GPT-4 | $30/mo |",
      },
    ],
  ),
  createMockSubagent(
    "sa-3",
    "creative",
    "Create data visualization of AI adoption trends in education (2020-2025)",
    "pending",
  ),
];

const COMPLETED_SUBAGENTS = [
  createMockSubagent(
    "sa-1", "research",
    "Research current AI education landscape and K-12 adoption rates across the US",
    "complete", now - 45000, now - 12000,
    "## AI in K-12 Education: Key Findings\n\n**Adoption Rate:** 67% of US K-12 schools have integrated AI-powered educational tools.\n\n**Top Platforms:**\n- **Khan Academy (Khanmigo)** — 15M+ students\n- **Duolingo Max** — AI conversation partner\n- **Century Tech** — Adaptive learning pathways",
    [
      { type: "ai", content: "Searching for data...", tool_calls: [{ id: "tc-1", name: "tavily_search", args: { query: "AI education K-12 adoption rates 2025" } }] },
      { type: "tool", name: "tavily_search", content: "Found 12 results..." },
      { type: "ai", content: "Compiling findings." },
    ],
  ),
  createMockSubagent(
    "sa-2", "code",
    "Generate comparison table of top AI tutoring platforms",
    "complete", now - 20000, now - 3000,
    "## Platform Comparison\n\n| Platform | Students | Price | Key Feature |\n|----------|----------|-------|-------------|\n| Khanmigo | 15M+ | $44/yr | Socratic tutoring |\n| Duolingo Max | 8M+ | $30/mo | Conversation partner |\n| Century Tech | 2M+ | $12/yr | Adaptive pathways |",
    [
      { type: "ai", content: "Searching pricing...", tool_calls: [{ id: "tc-2", name: "tavily_search", args: { query: "AI tutoring pricing 2025" } }] },
      { type: "tool", name: "tavily_search", content: "Found pricing data..." },
      { type: "ai", content: "Building table." },
    ],
  ),
  createMockSubagent(
    "sa-3", "creative",
    "Create data visualization of AI adoption trends in education (2020-2025)",
    "complete", now - 10000, now - 1000,
    "Generated adoption trend chart saved to `/home/gem/workspace/creative/task_sa3/adoption-chart.png`\n\nThe visualization shows exponential growth from 12% in 2020 to 67% in 2025.",
    [
      { type: "ai", content: "Generating chart...", tool_calls: [{ id: "tc-3", name: "generate_image", args: { description: "AI adoption trend chart 2020-2025" } }] },
      { type: "tool", name: "generate_image", content: "Image generated successfully." },
    ],
  ),
  createMockSubagent(
    "sa-4", "general-purpose",
    "Compile final executive summary",
    "error", now - 5000, now - 2000, undefined,
    [{ type: "ai", content: "Error: Token limit exceeded while generating summary." }],
  ),
];

// ─── Mock Messages ───────────────────────────────────────────────────
// The key: AI messages have tool_calls so the CoT visualizes orchestrator actions.

const MOCK_MESSAGES_RUNNING = [
  {
    id: "msg-1",
    type: "human",
    content: "Research AI in K-12 education — adoption rates, top platforms, trends. Create a comparison table and a visualization of adoption growth. Write an executive summary.",
  },
  {
    id: "msg-2",
    type: "ai",
    content: "I'll deeply research the AI education landscape and compile a comprehensive deliverable. Let me load the relevant skills and begin.",
    // No tool_calls — pure reasoning text
  },
  {
    id: "msg-3",
    type: "ai",
    content: "",
    // This message has tool_calls that create the plan
    tool_calls: [
      {
        id: "call_plan",
        name: "write_todos",
        args: {
          todos: [
            { title: "Research AI education landscape and K-12 adoption rates" },
            { title: "Generate comparison table of AI tutoring platforms" },
            { title: "Create adoption trends visualization (2020-2025)" },
            { title: "Write executive summary with recommendations" },
            { title: "Compile final deliverable" },
          ],
        },
      },
    ],
  },
  {
    id: "msg-4",
    type: "ai",
    content: "",
    // This message dispatches the subagents — tool_calls match the subagent IDs
    tool_calls: [
      { id: "call_sa-1", name: "task", args: { subagent_type: "research", description: "Research current AI education landscape and K-12 adoption rates across the US" } },
      { id: "call_sa-2", name: "task", args: { subagent_type: "code", description: "Generate comparison table of top AI tutoring platforms with features, pricing, and adoption metrics" } },
      { id: "call_sa-3", name: "task", args: { subagent_type: "creative", description: "Create data visualization of AI adoption trends in education (2020-2025)" } },
    ],
  },
];

const SYNTHESIS_MESSAGE = {
  id: "msg-5",
  type: "ai",
  content: "## Executive Summary: AI in K-12 Education (2025)\n\nAI-powered educational tools have reached **67% adoption** across US K-12 schools, up from just 12% in 2020.\n\n### Key Findings\n- **Khanmigo** leads with 15M+ students using GPT-4-powered Socratic tutoring\n- Personalized AI learning paths show **23% improvement** in test scores\n- Teacher AI assistants reduce grading workload by **40%**\n- Early intervention AI identifies at-risk students **3x faster**\n\n### Recommendations\n1. Prioritize platforms with strong COPPA/FERPA compliance\n2. Invest in teacher training programs alongside tool adoption\n3. Address the digital divide with subsidized access programs\n\nAll research materials, comparison tables, and visualizations have been saved to the workspace.",
};

// ─── Mock Router Result ──────────────────────────────────────────────

// Mocked to look like real GLM `additional_kwargs.reasoning_content` —
// numbered analysis steps, bullets, bold callouts. Lets us verify the
// routing card body renders multi-line markdown cleanly.
const MOCK_ROUTER_RESULT = {
  complexity: "default" as const,
  reasoning: `1. **Analyze the user's prompt:** "Research AI in K-12 education — adoption rates, top platforms, trends. Create a comparison table and a visualization of adoption growth. Write an executive summary."

2. **Evaluate Intent Complexity:**
   - The prompt asks to "Research…" (implies web search / tool usage).
   - It asks to "Create a comparison table" (structured data extraction).
   - It asks to "Create a visualization of adoption growth" (image generation).
   - It asks to "Write an executive summary" (long-form synthesis).
   - These are distinct steps that benefit from delegation: research → code → creative → write.

3. **Evaluate Implied Scope:**
   - Needs web access (research sub-agent).
   - Needs code/tabular work (code sub-agent).
   - Needs visualization (creative sub-agent).
   - This clearly fits the "needs sub-agents and multi-step planning" category.

4. **Compare against Labels:**
   - **trivial**: One-shot, no planning, no delegation. *Definitely not.*
   - **default**: Needs orchestrator, planning, tools, or delegation. *Yes.*

**Conclusion:** The label is \`default\`.`,
};

// Alternate body to demo the recovery-message variant — swap into the
// reasoning string above to see how it renders when the classifier emits
// non-JSON and we fall through the recovery path.
// const MOCK_ROUTER_RESULT_RECOVERED = {
//   complexity: "default" as const,
//   reasoning:
//     "Recovered from non-JSON classifier output; interpreted label as default.",
// };

// ─── Mock Threads (for thread picker demo) ───────────────────────────

function makeMockThread(
  threadId: string,
  firstHuman: string,
  status: Thread["status"],
  updatedAtMs: number,
): Thread {
  const iso = new Date(updatedAtMs).toISOString();
  return {
    thread_id: threadId,
    created_at: iso,
    updated_at: iso,
    state_updated_at: iso,
    metadata: { graph_id: "nexus" },
    status,
    values: {
      messages: [{ type: "human", content: firstHuman }],
    },
    interrupts: {},
  } as unknown as Thread;
}

const MOCK_THREADS: Thread[] = [
  makeMockThread(
    "th-1",
    "Research AI in K-12 education — adoption rates, top platforms, trends",
    "busy",
    now - 60_000,
  ),
  makeMockThread(
    "th-2",
    "Generate a 30-day content calendar for a DevRel team launching an open-source agent framework",
    "idle",
    now - 1000 * 60 * 45,
  ),
  makeMockThread(
    "th-3",
    "Investigate why the fusion energy Q-factor plateau hasn't broken past 1.5 yet",
    "idle",
    now - 1000 * 60 * 60 * 5,
  ),
  makeMockThread(
    "th-4",
    "Draft and refine the quarterly OKR review memo with stakeholder feedback",
    "interrupted",
    now - 1000 * 60 * 60 * 8,
  ),
  makeMockThread(
    "th-5",
    "Scrape competitor pricing pages and build a comparison matrix",
    "error",
    now - 1000 * 60 * 60 * 24,
  ),
];

// ─── Demo States ─────────────────────────────────────────────────────

type DemoState = "routing" | "running" | "synthesizing" | "complete";

// ─── Demo Page ───────────────────────────────────────────────────────

export default function DemoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-muted-foreground">Loading demo...</div>
        </div>
      }
    >
      <DemoPageInner />
    </Suspense>
  );
}

function DemoPageInner() {
  const [state, setState] = useState<DemoState>("routing");

  const isRouting = state === "routing";
  const todos = isRouting
    ? []
    : state === "complete"
      ? COMPLETED_TODOS
      : MOCK_TODOS;
  const subagentList = isRouting
    ? []
    : state === "running"
      ? INITIAL_SUBAGENTS
      : COMPLETED_SUBAGENTS;
  const subagentMap = new Map(subagentList.map((s) => [s.id, s]));
  const allSubagents = [...subagentMap.values()];
  const isLoading =
    isRouting || state === "running" || state === "synthesizing";
  const outputPaths = state === "complete" ? MOCK_OUTPUT_PATHS : [];

  const messages = isRouting
    ? [MOCK_MESSAGES_RUNNING[0]] // human bubble only
    : state === "complete"
      ? [...MOCK_MESSAGES_RUNNING, SYNTHESIS_MESSAGE]
      : MOCK_MESSAGES_RUNNING;

  const routing: RoutingState = isRouting
    ? { result: null, isClassifying: true }
    : { result: MOCK_ROUTER_RESULT, isClassifying: false, duration: 1 };

  // Mock getSubagentsByMessage: msg-4 dispatched all subagents
  const getSubagentsByMessage = (messageId: string) => {
    if (messageId === "msg-4") return subagentList;
    return [];
  };

  const demoToolbar = (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 shrink-0">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-primary">
          DEMO MODE — Mock data, no backend required
        </span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant={state === "routing" ? "default" : "outline"} onClick={() => setState("routing")} className="h-7 text-xs">
            <Compass className="size-3 mr-1" />Routing
          </Button>
          <Button size="sm" variant={state === "running" ? "default" : "outline"} onClick={() => setState("running")} className="h-7 text-xs">
            <Play className="size-3 mr-1" />Running
          </Button>
          <Button size="sm" variant={state === "synthesizing" ? "default" : "outline"} onClick={() => setState("synthesizing")} className="h-7 text-xs">
            <FastForward className="size-3 mr-1" />Synthesizing
          </Button>
          <Button size="sm" variant={state === "complete" ? "default" : "outline"} onClick={() => setState("complete")} className="h-7 text-xs">
            Complete
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setState("routing")} className="h-7 text-xs">
            <RotateCcw className="size-3" />
          </Button>
        </div>
      </div>
    </div>
  );

  const [mockThreads, setMockThreads] = useState<Thread[]>(MOCK_THREADS);

  const mockThreadValue = useMemo<ThreadContextType>(
    () => ({
      threads: mockThreads,
      setThreads: setMockThreads,
      threadsLoading: false,
      setThreadsLoading: () => {},
      getThreads: async () => mockThreads,
      refreshThreads: async () => {},
    }),
    [mockThreads],
  );

  const handleSwitchThread = useCallback((id: string | null) => {
    if (id == null) {
      alert("Demo: would start a new thread");
      return;
    }
    alert(`Demo: would switch to thread ${id}`);
  }, []);

  const mockStreamValue = useMemo(
    () =>
      ({
        switchThread: handleSwitchThread,
      }) as unknown as StreamContextType,
    [handleSwitchThread],
  );

  return (
    <ThreadContext.Provider value={mockThreadValue}>
      <StreamContext.Provider value={mockStreamValue}>
        <ThreadPickerProvider>
          <ExecutionShell
            messages={messages}
            todos={todos}
            subagents={subagentMap}
            allSubagents={allSubagents}
            outputPaths={outputPaths}
            getSubagentsByMessage={getSubagentsByMessage}
            isLoading={isLoading}
            routing={routing}
            onSubmit={(message) => {
              const text = typeof message === "string" ? message : message.text;
              alert(`Would submit: ${text}`);
            }}
            onStop={() => setState("complete")}
            topSlot={demoToolbar}
          />
        </ThreadPickerProvider>
      </StreamContext.Provider>
    </ThreadContext.Provider>
  );
}
