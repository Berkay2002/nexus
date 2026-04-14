"use client";

import { useState } from "react";
import { Streamdown } from "streamdown";
import { BrainIcon, ChevronDownIcon } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { cn } from "@/lib/utils";

export type RoutingComplexity = "trivial" | "default";

export type RoutingResult = {
  complexity: RoutingComplexity;
  reasoning: string;
};

export type RoutingState = {
  result: RoutingResult | null;
  isClassifying: boolean;
  /** Optional override for static contexts (e.g. demo mocks). */
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
  // Default open so the reasoning is visible the moment classification finishes.
  // Stays user-toggleable; we never auto-close.
  const [isOpen, setIsOpen] = useState(true);

  if (!isClassifying && !result) return null;

  const isStreaming = isClassifying && !result;
  const tierLabel = result ? TIER_LABEL[result.complexity] : null;
  const tierDescription = result ? TIER_DESCRIPTION[result.complexity] : null;

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="not-prose w-full"
    >
      <CollapsibleTrigger className="group flex w-full items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <BrainIcon className="size-4 shrink-0" />
        <span className="flex flex-1 items-center gap-2 text-left">
          {isStreaming ? (
            <Shimmer duration={1.5}>Routing your request…</Shimmer>
          ) : (
            <>
              <span>
                {duration !== undefined && duration > 0
                  ? `Routed in ${duration}s`
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
              <ScrollArea className="max-h-[24rem]">
                <div
                  className={cn(
                    "pr-3 text-sm text-muted-foreground",
                    "[&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2",
                    "[&_strong]:font-semibold [&_strong]:text-foreground",
                    "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs",
                    "[&_li]:ml-4 [&_ul]:list-disc [&_ol]:list-decimal",
                  )}
                >
                  <Streamdown>{result.reasoning}</Streamdown>
                </div>
              </ScrollArea>
            </div>
          ) : (
            <p className="py-1 text-xs italic text-muted-foreground">
              <Shimmer duration={1.5}>Analyzing intent and complexity…</Shimmer>
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
