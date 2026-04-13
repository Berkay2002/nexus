"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

type SectionHeaderCollapsibleProps = {
  title: string;
  rightSlot?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
};

export function SectionHeaderCollapsible({
  title,
  rightSlot,
  defaultOpen = true,
  children,
}: SectionHeaderCollapsibleProps) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <div className="flex flex-col gap-2">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between px-1 text-muted-foreground hover:text-foreground"
          >
            <div className="flex items-center gap-1.5">
              <ChevronDown className="size-3.5 shrink-0 transition-transform [[data-state=closed]_&]:-rotate-90" />
              <h3 className="text-xs font-semibold uppercase tracking-wider">
                {title}
              </h3>
            </div>
            {rightSlot}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>{children}</CollapsibleContent>
      </div>
    </Collapsible>
  );
}
