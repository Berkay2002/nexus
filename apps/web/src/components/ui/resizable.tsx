"use client"

import * as ResizablePrimitive from "react-resizable-panels"

import { cn } from "@/lib/utils"

type ResizablePanelGroupProps = Omit<
  ResizablePrimitive.GroupProps,
  "orientation"
> & {
  /** Back-compat alias for v3 `direction`. Maps to v4 `orientation`. */
  direction?: "horizontal" | "vertical"
  orientation?: "horizontal" | "vertical"
}

function ResizablePanelGroup({
  className,
  direction,
  orientation,
  ...props
}: ResizablePanelGroupProps) {
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      orientation={orientation ?? direction ?? "horizontal"}
      className={cn(
        "flex h-full w-full aria-[orientation=vertical]:flex-col",
        className
      )}
      {...props}
    />
  )
}

/**
 * In `react-resizable-panels` v4, numeric sizes are treated as pixels, not
 * percentages. v3 consumers passed numbers meaning percent — we preserve that
 * behavior by converting bare numbers to percentage strings.
 */
function toPercent(value: number | string | undefined): string | undefined {
  if (value === undefined) return undefined
  return typeof value === "number" ? `${value}%` : value
}

function ResizablePanel({
  defaultSize,
  minSize,
  maxSize,
  collapsedSize,
  ...props
}: ResizablePrimitive.PanelProps) {
  return (
    <ResizablePrimitive.Panel
      data-slot="resizable-panel"
      defaultSize={toPercent(defaultSize)}
      minSize={toPercent(minSize)}
      maxSize={toPercent(maxSize)}
      collapsedSize={toPercent(collapsedSize)}
      {...props}
    />
  )
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: ResizablePrimitive.SeparatorProps & {
  withHandle?: boolean
}) {
  return (
    <ResizablePrimitive.Separator
      data-slot="resizable-handle"
      className={cn(
        "relative flex w-px items-center justify-center bg-border ring-offset-background after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 [&[aria-orientation=horizontal]>div]:rotate-90",
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className="z-10 flex h-6 w-1 shrink-0 rounded-lg bg-border" />
      )}
    </ResizablePrimitive.Separator>
  )
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup }
