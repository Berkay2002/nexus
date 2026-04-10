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
