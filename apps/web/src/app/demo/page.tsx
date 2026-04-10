"use client";

import { useState } from "react";
import { ExecutionShell } from "@/components/execution/execution-shell";
import type { NexusTodo } from "@/lib/subagent-utils";
import { Button } from "@/components/ui/button";
import { RotateCcw, Play, FastForward } from "lucide-react";

// ─── Mock Data ───────────────────────────────────────────────────────

const MOCK_TODOS: NexusTodo[] = [
  { id: "1", title: "Analyze user request and determine required agents", status: "completed" },
  { id: "2", title: "Research current AI education landscape and K-12 adoption rates", status: "completed" },
  { id: "3", title: "Generate comparison table of top AI tutoring platforms", status: "in_progress" },
  { id: "4", title: "Create visualization of adoption trends (2020-2025)", status: "pending" },
  { id: "5", title: "Write executive summary with key findings and recommendations", status: "pending" },
  { id: "6", title: "Compile final deliverable with all sections", status: "pending" },
];

const COMPLETED_TODOS: NexusTodo[] = [
  { id: "1", title: "Analyze user request and determine required agents", status: "completed" },
  { id: "2", title: "Research current AI education landscape", status: "completed" },
  { id: "3", title: "Generate comparison table of AI platforms", status: "completed" },
  { id: "4", title: "Create adoption trends visualization", status: "completed" },
  { id: "5", title: "Write executive summary", status: "completed" },
  { id: "6", title: "Compile final deliverable", status: "completed" },
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
      name: "create_subagent",
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
      { id: "call_sa-1", name: "create_subagent", args: { subagent_type: "research", description: "Research current AI education landscape and K-12 adoption rates across the US" } },
      { id: "call_sa-2", name: "create_subagent", args: { subagent_type: "code", description: "Generate comparison table of top AI tutoring platforms with features, pricing, and adoption metrics" } },
      { id: "call_sa-3", name: "create_subagent", args: { subagent_type: "creative", description: "Create data visualization of AI adoption trends in education (2020-2025)" } },
    ],
  },
];

const SYNTHESIS_MESSAGE = {
  id: "msg-5",
  type: "ai",
  content: "## Executive Summary: AI in K-12 Education (2025)\n\nAI-powered educational tools have reached **67% adoption** across US K-12 schools, up from just 12% in 2020.\n\n### Key Findings\n- **Khanmigo** leads with 15M+ students using GPT-4-powered Socratic tutoring\n- Personalized AI learning paths show **23% improvement** in test scores\n- Teacher AI assistants reduce grading workload by **40%**\n- Early intervention AI identifies at-risk students **3x faster**\n\n### Recommendations\n1. Prioritize platforms with strong COPPA/FERPA compliance\n2. Invest in teacher training programs alongside tool adoption\n3. Address the digital divide with subsidized access programs\n\nAll research materials, comparison tables, and visualizations have been saved to the workspace.",
};

// ─── Demo States ─────────────────────────────────────────────────────

type DemoState = "running" | "synthesizing" | "complete";

// ─── Demo Page ───────────────────────────────────────────────────────

export default function DemoPage() {
  const [state, setState] = useState<DemoState>("running");

  const todos = state === "complete" ? COMPLETED_TODOS : MOCK_TODOS;
  const subagentList = state === "running" ? INITIAL_SUBAGENTS : COMPLETED_SUBAGENTS;
  const subagentMap = new Map(subagentList.map((s) => [s.id, s]));
  const allSubagents = [...subagentMap.values()];
  const isLoading = state === "running" || state === "synthesizing";

  const messages = state === "complete"
    ? [...MOCK_MESSAGES_RUNNING, SYNTHESIS_MESSAGE]
    : MOCK_MESSAGES_RUNNING;

  // Mock getSubagentsByMessage: msg-4 dispatched all subagents
  const getSubagentsByMessage = (messageId: string) => {
    if (messageId === "msg-4") return subagentList;
    return [];
  };

  const demoToolbar = (
    <div className="flex items-center justify-between px-4 py-2 bg-primary/10 border-b border-primary/20 shrink-0">
      <span className="text-xs font-medium text-primary">
        DEMO MODE — Mock data, no backend required
      </span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant={state === "running" ? "default" : "outline"} onClick={() => setState("running")} className="h-7 text-xs">
          <Play className="size-3 mr-1" />Running
        </Button>
        <Button size="sm" variant={state === "synthesizing" ? "default" : "outline"} onClick={() => setState("synthesizing")} className="h-7 text-xs">
          <FastForward className="size-3 mr-1" />Synthesizing
        </Button>
        <Button size="sm" variant={state === "complete" ? "default" : "outline"} onClick={() => setState("complete")} className="h-7 text-xs">
          Complete
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setState("running")} className="h-7 text-xs">
          <RotateCcw className="size-3" />
        </Button>
      </div>
    </div>
  );

  return (
    <ExecutionShell
      messages={messages}
      todos={todos}
      subagents={subagentMap}
      allSubagents={allSubagents}
      getSubagentsByMessage={getSubagentsByMessage}
      isLoading={isLoading}
      onSubmit={(text) => alert(`Would submit: ${text}`)}
      onStop={() => setState("complete")}
      topSlot={demoToolbar}
    />
  );
}
