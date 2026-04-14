"use client";

import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Badge } from "@/components/ui/badge";

export type RoutingComplexity = "trivial" | "default";

export type RoutingResult = {
  complexity: RoutingComplexity;
  reasoning: string;
};

export type RoutingState = {
  result: RoutingResult | null;
  isClassifying: boolean;
  /** Optional override so demo/static contexts can show a duration without
   *  actually streaming. Real usage derives this from the Reasoning timer. */
  duration?: number;
};

const TIER_LABEL: Record<RoutingComplexity, string> = {
  trivial: "Fast",
  default: "Strong",
};

const TIER_DESCRIPTION: Record<RoutingComplexity, string> = {
  trivial: "Routed to the classifier tier — one-shot answer, no delegation.",
  default: "Routed to the default tier — orchestrator will plan and delegate.",
};

export function RoutingCard({ result, isClassifying, duration }: RoutingState) {
  if (!isClassifying && !result) return null;

  const isStreaming = isClassifying && !result;
  const tierLabel = result ? TIER_LABEL[result.complexity] : null;
  const tierDescription = result ? TIER_DESCRIPTION[result.complexity] : null;

  const getThinkingMessage = (streaming: boolean, computedDuration?: number) => {
    if (streaming) {
      return <Shimmer duration={1.5}>Routing your request…</Shimmer>;
    }
    const shown = computedDuration ?? duration;
    return (
      <span className="inline-flex items-center gap-2">
        <span>
          {shown !== undefined && shown > 0
            ? `Routed in ${shown}s`
            : "Routed"}
        </span>
        {tierLabel ? (
          <Badge
            variant="secondary"
            className="h-4 px-1.5 text-[10px] font-medium uppercase tracking-wide"
          >
            {tierLabel}
          </Badge>
        ) : null}
      </span>
    );
  };

  const body = result
    ? `**${tierDescription}**\n\n${result.reasoning}`
    : "";

  return (
    <Reasoning
      className="mb-0"
      isStreaming={isStreaming}
      defaultOpen={isStreaming}
      duration={duration}
    >
      <ReasoningTrigger getThinkingMessage={getThinkingMessage} />
      {body ? <ReasoningContent>{body}</ReasoningContent> : null}
    </Reasoning>
  );
}
