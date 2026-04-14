"use client";

import { useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { BrainIcon, ChevronDownIcon } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { cn } from "@/lib/utils";
import { useRoutingModelIdentity } from "@/lib/subagent-utils";
import { ModelIdentityBadge } from "./model-identity-badge";

export type RoutingComplexity = "trivial" | "default";

export type RoutingResult = {
  complexity: RoutingComplexity;
  reasoning: string;
  selectedModel?: string;
  selectedModels?: Partial<
    Record<
      "orchestrator" | "research" | "code" | "creative" | "general-purpose",
      string
    >
  >;
};

export type RoutingState = {
  result: RoutingResult | null;
  isClassifying: boolean;
  /**
   * Set true once the orchestrator has started producing output for this turn
   * (i.e., the routing phase is "done" from the user's perspective). The card
   * auto-collapses once on the false → true transition so the orchestrator's
   * chain-of-thought reclaims viewport space, but stays user-toggleable.
   */
  hasOrchestratorStarted?: boolean;
  /** Optional override for static contexts (e.g. demo mocks). */
  duration?: number;
};

const TIER_LABEL: Record<RoutingComplexity, string> = {
  trivial: "Fast",
  default: "Strong",
};

// Short, deterministic one-liner shown next to the tier badge when the
// routing card is collapsed. Derived purely from the complexity label so the
// verdict is legible at a glance without expanding the model's free-form
// reasoning trace.
const TIER_TAGLINE: Record<RoutingComplexity, string> = {
  trivial: "One-shot answer, no delegation",
  default: "Multi-step task — orchestrator will plan and delegate",
};

const TIER_DESCRIPTION: Record<RoutingComplexity, string> = {
  trivial: "Routed to the classifier tier — one-shot answer, no delegation.",
  default: "Routed to the default tier — orchestrator will plan and delegate.",
};

export function RoutingCard({
  result,
  isClassifying,
  hasOrchestratorStarted,
  duration,
}: RoutingState) {
  // Default open so the reasoning is visible the moment classification finishes.
  // Once the orchestrator starts producing output we auto-collapse exactly once
  // (guarded by a ref) so the card surrenders viewport space — but the user can
  // re-open it and it will stay open.
  const [isOpen, setIsOpen] = useState(true);
  const didAutoCollapseRef = useRef(false);
  useEffect(() => {
    if (
      hasOrchestratorStarted &&
      result &&
      !didAutoCollapseRef.current
    ) {
      didAutoCollapseRef.current = true;
      setIsOpen(false);
    }
  }, [hasOrchestratorStarted, result]);

  if (!isClassifying && !result) return null;

  const isStreaming = isClassifying && !result;
  const tierLabel = result ? TIER_LABEL[result.complexity] : null;
  const tierTagline = result ? TIER_TAGLINE[result.complexity] : null;
  const tierDescription = result ? TIER_DESCRIPTION[result.complexity] : null;
  const routingIdentity = useRoutingModelIdentity(
    result?.complexity,
    result?.selectedModel,
  );

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="not-prose w-full"
    >
      <CollapsibleTrigger className="group flex w-full items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <BrainIcon className="size-4 shrink-0" />
        <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
          {isStreaming ? (
            <Shimmer duration={1.5}>Routing your request…</Shimmer>
          ) : (
            <>
              <span className="shrink-0">
                {duration !== undefined && duration > 0
                  ? `Routed in ${duration}s`
                  : "Routed"}
              </span>
              {tierLabel ? (
                <ModelIdentityBadge
                  provider={routingIdentity?.provider}
                  modelLabel={routingIdentity?.modelLabel ?? "Auto model"}
                  roleLabel={routingIdentity?.roleLabel ?? tierLabel}
                  className="shrink-0"
                />
              ) : null}
              {tierTagline ? (
                <span className="hidden truncate text-xs text-muted-foreground/80 sm:inline">
                  · {tierTagline}
                </span>
              ) : null}
            </>
          )}
        </span>
        <ChevronDownIcon
          className={cn(
            "size-4 shrink-0 transition-transform",
            isOpen ? "rotate-180" : "rotate-0",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent
        className={cn(
          "mt-2 outline-none",
          "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2",
          "data-[state=open]:slide-in-from-top-2",
          "data-[state=closed]:animate-out data-[state=open]:animate-in",
        )}
      >
        <div className="border-l-2 border-border pl-3">
          {result ? (
            <div className="space-y-2">
              {tierDescription && (
                <p className="text-xs italic text-muted-foreground">
                  {tierDescription}
                </p>
              )}
              <div
                className={cn(
                  "max-h-[24rem] overflow-y-auto pr-3 text-sm text-muted-foreground",
                  "[&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2",
                  "[&_strong]:font-semibold [&_strong]:text-foreground",
                  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs",
                  "[&_li]:ml-4 [&_ul]:list-disc [&_ol]:list-decimal",
                )}
              >
                <Streamdown>{result.reasoning}</Streamdown>
              </div>
            </div>
          ) : (
            <div className="py-1 text-xs italic text-muted-foreground">
              <Shimmer duration={1.5}>Analyzing intent and complexity…</Shimmer>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
