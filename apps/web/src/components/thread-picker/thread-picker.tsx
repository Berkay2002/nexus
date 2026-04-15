"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { formatDistanceToNow } from "date-fns";
import type { Thread, Message } from "@langchain/langgraph-sdk";
import { HugeiconsIcon } from "@hugeicons/react";
import { Menu01Icon, PlusSignIcon } from "@hugeicons/core-free-icons";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useThreads } from "@/providers/Thread";
import { useStreamContext } from "@/providers/Stream";

interface ThreadPickerContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

// Default to a no-op so pages that render ThreadPickerButton outside
// ThreadPickerProvider (e.g. /demo) don't crash at runtime or during SSG.
const NOOP_THREAD_PICKER: ThreadPickerContextValue = {
  open: false,
  setOpen: () => {},
  toggle: () => {},
};

const ThreadPickerContext = createContext<ThreadPickerContextValue>(
  NOOP_THREAD_PICKER,
);

export function useThreadPicker(): ThreadPickerContextValue {
  return useContext(ThreadPickerContext);
}

function firstHumanText(thread: Thread): string {
  const messages = (thread.values as { messages?: Message[] } | undefined)
    ?.messages;
  if (!messages) return `Thread ${thread.thread_id.slice(0, 8)}`;
  for (const msg of messages) {
    if (msg.type !== "human") continue;
    const content = msg.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      for (const part of content) {
        if (
          typeof part === "object" &&
          part !== null &&
          "type" in part &&
          (part as { type: string }).type === "text"
        ) {
          const text = (part as { text?: string }).text;
          if (text) return text;
        }
      }
    }
  }
  return `Thread ${thread.thread_id.slice(0, 8)}`;
}

function truncate(text: string, max = 80): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}\u2026`;
}

interface StatusBadgeProps {
  status: Thread["status"];
}

function StatusBadge({ status }: StatusBadgeProps) {
  const { label, className } = (() => {
    switch (status) {
      case "busy":
        return {
          label: "Running",
          className:
            "bg-amber-500/15 text-amber-400 ring-1 ring-inset ring-amber-500/30",
        };
      case "interrupted":
        return {
          label: "Awaiting input",
          className:
            "bg-sky-500/15 text-sky-400 ring-1 ring-inset ring-sky-500/30",
        };
      case "error":
        return {
          label: "Error",
          className:
            "bg-rose-500/15 text-rose-400 ring-1 ring-inset ring-rose-500/30",
        };
      case "idle":
      default:
        return {
          label: "Done",
          className:
            "bg-muted/60 text-muted-foreground ring-1 ring-inset ring-border/40",
        };
    }
  })();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        className,
      )}
    >
      {status === "busy" ? (
        <span className="size-1.5 animate-pulse rounded-full bg-amber-400" />
      ) : null}
      {label}
    </span>
  );
}

export function ThreadPickerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  const value = useMemo(() => ({ open, setOpen, toggle }), [open, toggle]);

  return (
    <ThreadPickerContext.Provider value={value}>
      {children}
      <ThreadPickerDialog />
    </ThreadPickerContext.Provider>
  );
}

function ThreadPickerDialog() {
  const { open, setOpen } = useThreadPicker();
  const { threads, refreshThreads } = useThreads();
  const stream = useStreamContext();

  useEffect(() => {
    if (!open) return;
    void refreshThreads();
    const id = setInterval(() => {
      void refreshThreads();
    }, 5000);
    return () => clearInterval(id);
  }, [open, refreshThreads]);

  const handleSelectThread = useCallback(
    (threadId: string | null) => {
      setOpen(false);
      (stream as unknown as {
        switchThread: (id: string | null) => void;
      }).switchThread(threadId);
    },
    [setOpen, stream],
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Threads"
      description="Switch between recent runs"
    >
      <Command>
        <CommandInput placeholder="Search threads..." />
        <CommandList>
          <CommandEmpty>No threads found.</CommandEmpty>
          <CommandGroup>
            <CommandItem
              value="__new-thread__"
              onSelect={() => handleSelectThread(null)}
            >
              <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} />
              <span>New thread</span>
            </CommandItem>
          </CommandGroup>
          {threads.length > 0 ? (
            <>
              <CommandSeparator />
              <CommandGroup heading="Recent">
                {threads.map((thread) => {
                  const label = truncate(firstHumanText(thread));
                  const updated = thread.updated_at
                    ? formatDistanceToNow(new Date(thread.updated_at), {
                        addSuffix: true,
                      })
                    : "";
                  return (
                    <CommandItem
                      key={thread.thread_id}
                      value={`${thread.thread_id} ${label}`}
                      onSelect={() => handleSelectThread(thread.thread_id)}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="min-w-0 flex-1 truncate">{label}</span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {updated}
                        </span>
                        <StatusBadge status={thread.status} />
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </>
          ) : null}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

export function ThreadPickerButton({ className }: { className?: string }) {
  const { setOpen } = useThreadPicker();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setOpen(true)}
      className={cn("gap-2 text-xs", className)}
    >
      <HugeiconsIcon icon={Menu01Icon} strokeWidth={2} className="size-4" />
      <span>Threads</span>
      <kbd className="ml-1 rounded border border-border/40 bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
        ⌘K
      </kbd>
    </Button>
  );
}
