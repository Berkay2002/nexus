"use client";

import { Button } from "@/components/ui/button";
import { Loader2, ArrowUp } from "lucide-react";
import { useState, type FormEvent } from "react";

export function PromptBar({
  onSubmit,
  isLoading,
  onStop,
}: {
  onSubmit: (text: string) => void;
  isLoading: boolean;
  onStop: () => void;
}) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSubmit(input.trim());
    setInput("");
  };

  return (
    <div className="border-t bg-background/95 backdrop-blur-sm p-3">
      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 max-w-3xl mx-auto"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              const form = (e.target as HTMLElement).closest("form");
              form?.requestSubmit();
            }
          }}
          placeholder="Follow up..."
          rows={1}
          className="flex-1 resize-none rounded-xl border bg-muted/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring field-sizing-content max-h-[120px]"
        />
        {isLoading ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={onStop}
          >
            <Loader2 className="size-4 animate-spin" />
            Stop
          </Button>
        ) : (
          <Button
            type="submit"
            size="sm"
            disabled={!input.trim()}
            className="shrink-0"
          >
            <ArrowUp className="size-4" />
          </Button>
        )}
      </form>
    </div>
  );
}
