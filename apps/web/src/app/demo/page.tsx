"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TodoPanel } from "@/components/execution/todo-panel";
import { AgentStatusPanel } from "@/components/execution/agent-status-panel";
import { SubagentCard } from "@/components/execution/subagent-card";
import { SynthesisIndicator } from "@/components/execution/synthesis-indicator";
import { PromptBar } from "@/components/execution/prompt-bar";
import type { NexusTodo } from "@/lib/subagent-utils";
import { Conversation, ConversationContent } from "@/components/ai-elements/conversation";
import { useMediaQuery } from "@/hooks/useMediaQuery";
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
    "## AI in K-12 Education: Key Findings\n\n**Adoption Rate:** As of 2025, approximately 67% of US K-12 schools have integrated some form of AI-powered educational tools.\n\n**Top Platforms:**\n- **Khan Academy (Khanmigo)** — 15M+ students, powered by GPT-4\n- **Duolingo Max** — AI conversation partner for language learning\n- **Century Tech** — Adaptive learning pathways\n- **Cognii** — AI-powered virtual tutoring for STEM\n\n**Key Trends:**\n1. Personalized learning paths showing 23% improvement in test scores\n2. Teacher AI assistants reducing grading time by 40%\n3. Early intervention systems identifying at-risk students 3x faster\n\n**Challenges:**\n- Privacy concerns (COPPA/FERPA compliance)\n- Digital divide in rural districts\n- Teacher training gaps",
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
        content: "Building a structured comparison of the top 8 AI tutoring platforms. I'm pulling together feature matrices, pricing tiers, and verified adoption numbers from recent reports...\n\n| Platform | Students | AI Model | Price/Student | Key Feature |\n|----------|----------|----------|--------------|-------------|\n| Khanmigo | 15M+ | GPT-4 | $44/yr | Socratic tutoring |\n| Duolingo Max | 8M+ | GPT-4 | $30/mo | Conversation practice |",
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
    "sa-1",
    "research",
    "Research current AI education landscape and K-12 adoption rates across the US",
    "complete",
    now - 45000,
    now - 12000,
    "## AI in K-12 Education: Key Findings\n\n**Adoption Rate:** As of 2025, approximately 67% of US K-12 schools have integrated some form of AI-powered educational tools.\n\n**Top Platforms:**\n- **Khan Academy (Khanmigo)** — 15M+ students, powered by GPT-4\n- **Duolingo Max** — AI conversation partner for language learning\n- **Century Tech** — Adaptive learning pathways\n\n**Key Trends:**\n1. Personalized learning paths showing 23% improvement in test scores\n2. Teacher AI assistants reducing grading time by 40%\n3. Early intervention systems identifying at-risk students 3x faster",
  ),
  createMockSubagent(
    "sa-2",
    "code",
    "Generate comparison table of top AI tutoring platforms",
    "complete",
    now - 20000,
    now - 3000,
    "## Platform Comparison\n\n| Platform | Students | AI Model | Price | Key Feature |\n|----------|----------|----------|-------|-------------|\n| Khanmigo | 15M+ | GPT-4 | $44/yr | Socratic tutoring |\n| Duolingo Max | 8M+ | GPT-4 | $30/mo | Conversation partner |\n| Century Tech | 2M+ | Proprietary | $12/yr | Adaptive pathways |\n| Cognii | 500K+ | NLP | Custom | STEM virtual tutor |",
  ),
  createMockSubagent(
    "sa-3",
    "creative",
    "Create data visualization of AI adoption trends in education (2020-2025)",
    "complete",
    now - 10000,
    now - 1000,
    "Generated adoption trend chart saved to `/home/gem/workspace/creative/task_sa3/adoption-chart.png`\n\nThe visualization shows exponential growth from 12% adoption in 2020 to 67% in 2025, with an inflection point in 2023 following the release of GPT-4.",
  ),
  createMockSubagent(
    "sa-4",
    "general-purpose",
    "Compile final executive summary",
    "error",
    now - 5000,
    now - 2000,
    undefined,
    [{ type: "ai", content: "Error: Token limit exceeded while generating summary. The combined research output exceeds the context window." }],
  ),
];

const COMPLETED_TODOS: NexusTodo[] = [
  { id: "1", title: "Analyze user request and determine required agents", status: "completed" },
  { id: "2", title: "Research current AI education landscape", status: "completed" },
  { id: "3", title: "Generate comparison table of AI platforms", status: "completed" },
  { id: "4", title: "Create adoption trends visualization", status: "completed" },
  { id: "5", title: "Write executive summary", status: "completed" },
  { id: "6", title: "Compile final deliverable", status: "completed" },
];

// ─── Mock Messages ───────────────────────────────────────────────────

const MOCK_MESSAGES = [
  {
    id: "msg-1",
    type: "human",
    content: "Research AI in K-12 education — adoption rates, top platforms, trends. Create a comparison table and a visualization of adoption growth. Write an executive summary.",
  },
  {
    id: "msg-2",
    type: "ai",
    content: "I'll break this into focused tasks and delegate to specialized agents. Let me set up the research pipeline.",
  },
  {
    id: "msg-3",
    type: "ai",
    content: "",  // AI message that triggered subagents — content may be empty
  },
];

const SYNTHESIS_MESSAGE = {
  id: "msg-4",
  type: "ai",
  content: "## Executive Summary: AI in K-12 Education (2025)\n\nAI-powered educational tools have reached **67% adoption** across US K-12 schools, up from just 12% in 2020. This represents a fundamental shift in how education is delivered.\n\n### Key Findings\n- **Khanmigo** leads with 15M+ students using GPT-4-powered Socratic tutoring\n- Personalized AI learning paths show **23% improvement** in standardized test scores\n- Teacher AI assistants reduce grading workload by **40%**, freeing time for instruction\n- Early intervention AI identifies at-risk students **3x faster** than traditional methods\n\n### Recommendations\n1. Prioritize platforms with strong COPPA/FERPA compliance\n2. Invest in teacher training programs alongside tool adoption\n3. Address the digital divide with subsidized access programs\n\nAll research materials, comparison tables, and visualizations have been saved to the workspace.",
};

// ─── Demo States ─────────────────────────────────────────────────────

type DemoState = "running" | "synthesizing" | "complete";

// ─── Demo Page Component ─────────────────────────────────────────────

function DemoMessageFeed({
  messages,
  subagentsByMessage,
  allSubagents,
  isLoading,
  showSynthesis,
}: {
  messages: any[];
  subagentsByMessage: Record<string, any[]>;
  allSubagents: any[];
  isLoading: boolean;
  showSynthesis: boolean;
}) {
  return (
    <div className="flex flex-col gap-5 py-6 px-4 max-w-3xl mx-auto">
      {messages.map((message) => {
        const subs = subagentsByMessage[message.id] ?? [];
        const content =
          typeof message.content === "string" ? message.content : "";

        if (message.type === "human") {
          return (
            <div key={message.id} className="flex justify-end">
              <div className="px-4 py-2 rounded-2xl bg-muted max-w-[80%]">
                <p className="text-sm whitespace-pre-wrap">{content}</p>
              </div>
            </div>
          );
        }

        return (
          <div key={message.id} className="flex flex-col gap-3">
            {content && (
              <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                <DemoMarkdown text={content} />
              </div>
            )}
            {subs.length > 0 && (
              <div className="flex flex-col gap-2.5 ml-1 pl-3 border-l-2 border-primary/20">
                {subs.map((sub) => (
                  <SubagentCard
                    key={sub.id}
                    subagent={sub}
                    defaultOpen={
                      sub.status === "running" ||
                      sub.status === "error" ||
                      subs.length <= 3
                    }
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {showSynthesis && (
        <SynthesisIndicator subagentCount={allSubagents.length} />
      )}

      {isLoading && allSubagents.length === 0 && (
        <div className="flex items-center gap-1.5 py-2">
          <div className="w-1.5 h-1.5 rounded-full bg-foreground/50 animate-[pulse_1.5s_ease-in-out_infinite]" />
          <div className="w-1.5 h-1.5 rounded-full bg-foreground/50 animate-[pulse_1.5s_ease-in-out_0.5s_infinite]" />
          <div className="w-1.5 h-1.5 rounded-full bg-foreground/50 animate-[pulse_1.5s_ease-in-out_1s_infinite]" />
        </div>
      )}
    </div>
  );
}

/** Simple markdown-ish renderer for the demo (avoids needing MarkdownText's deps) */
function DemoMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => {
        if (line.startsWith("## ")) {
          return (
            <h2 key={i} className="text-base font-semibold mt-3 mb-1">
              {renderInline(line.slice(3))}
            </h2>
          );
        }
        if (line.startsWith("### ")) {
          return (
            <h3 key={i} className="text-sm font-semibold mt-2 mb-1">
              {renderInline(line.slice(4))}
            </h3>
          );
        }
        if (line.startsWith("- ")) {
          return (
            <li key={i} className="ml-4 text-sm list-disc">
              {renderInline(line.slice(2))}
            </li>
          );
        }
        if (/^\d+\.\s/.test(line)) {
          return (
            <li key={i} className="ml-4 text-sm list-decimal">
              {renderInline(line.replace(/^\d+\.\s/, ""))}
            </li>
          );
        }
        if (line.startsWith("|")) {
          // Table row
          const cells = line
            .split("|")
            .filter(Boolean)
            .map((c) => c.trim());
          if (cells.every((c) => /^[-:]+$/.test(c))) return null; // separator
          return (
            <div key={i} className="flex gap-4 text-xs py-0.5 font-mono">
              {cells.map((cell, j) => (
                <span key={j} className="flex-1 truncate">
                  {renderInline(cell)}
                </span>
              ))}
            </div>
          );
        }
        if (line.trim() === "") return <br key={i} />;
        return (
          <p key={i} className="text-sm">
            {renderInline(line)}
          </p>
        );
      })}
    </>
  );
}

function renderInline(text: string) {
  // Bold
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

export default function DemoPage() {
  const [state, setState] = useState<DemoState>("running");
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");

  const todos = state === "complete" ? COMPLETED_TODOS : MOCK_TODOS;
  const subagentList =
    state === "running" ? INITIAL_SUBAGENTS : COMPLETED_SUBAGENTS;
  const subagentMap = new Map(subagentList.map((s) => [s.id, s]));
  const allSubagents = [...subagentMap.values()];
  const completedCount = allSubagents.filter(
    (s) => s.status === "complete",
  ).length;
  const isLoading = state === "running" || state === "synthesizing";

  const messages =
    state === "complete"
      ? [...MOCK_MESSAGES, SYNTHESIS_MESSAGE]
      : MOCK_MESSAGES;

  const subagentsByMessage: Record<string, any[]> = {
    "msg-3": subagentList,
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Demo controls bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-primary/10 border-b border-primary/20 shrink-0">
        <span className="text-xs font-medium text-primary">
          DEMO MODE — Mock data, no backend required
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={state === "running" ? "default" : "outline"}
            onClick={() => setState("running")}
            className="h-7 text-xs"
          >
            <Play className="size-3 mr-1" />
            Running
          </Button>
          <Button
            size="sm"
            variant={state === "synthesizing" ? "default" : "outline"}
            onClick={() => setState("synthesizing")}
            className="h-7 text-xs"
          >
            <FastForward className="size-3 mr-1" />
            Synthesizing
          </Button>
          <Button
            size="sm"
            variant={state === "complete" ? "default" : "outline"}
            onClick={() => setState("complete")}
            className="h-7 text-xs"
          >
            Complete
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setState("running")}
            className="h-7 text-xs"
          >
            <RotateCcw className="size-3" />
          </Button>
        </div>
      </div>

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

      {/* Progress bar */}
      {allSubagents.length > 0 && (
        <div className="px-4 py-2 border-b shrink-0">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Progress</span>
            <span className="tabular-nums">
              {completedCount}/{allSubagents.length}
            </span>
          </div>
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
              style={{
                width: `${Math.round((completedCount / allSubagents.length) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Main content */}
      <ResizablePanelGroup orientation="horizontal" className="flex-1 min-h-0">
        <ResizablePanel
          defaultSize={30}
          minSize={20}
          maxSize={40}
          className="flex flex-col max-lg:hidden"
        >
          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-6 p-4">
              <TodoPanel todos={todos} />
              <AgentStatusPanel subagents={subagentMap} />
            </div>
          </ScrollArea>
        </ResizablePanel>
        <ResizableHandle withHandle className="max-lg:hidden" />

        <ResizablePanel
          defaultSize={70}
          minSize={50}
          className="flex flex-col"
        >
          <Conversation className="flex-1">
            <ConversationContent className="gap-5 p-0">
              <DemoMessageFeed
                messages={messages}
                subagentsByMessage={subagentsByMessage}
                allSubagents={allSubagents}
                isLoading={isLoading}
                showSynthesis={state === "synthesizing"}
              />
            </ConversationContent>
          </Conversation>
          <PromptBar
            onSubmit={(text) => alert(`Would submit: ${text}`)}
            isLoading={isLoading}
            onStop={() => setState("complete")}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
