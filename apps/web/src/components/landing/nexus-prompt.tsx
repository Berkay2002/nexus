"use client";

import { useState, FormEvent, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowUp01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface NexusPromptProps {
  onSubmit: (text: string) => void;
  isLoading: boolean;
}

export function NexusPrompt({ onSubmit, isLoading }: NexusPromptProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSubmit(input.trim());
    setInput("");
  };

  return (
    <motion.div
      className="w-full max-w-2xl"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
    >
      <form onSubmit={handleSubmit}>
        <div className="rounded-2xl border bg-card/50 shadow-sm ring-1 ring-ring/10 focus-within:ring-ring/30 transition-shadow duration-300">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.metaKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                const form = (e.target as HTMLElement).closest("form");
                form?.requestSubmit();
              }
            }}
            placeholder="What would you like Nexus to do?"
            rows={1}
            className="w-full resize-none bg-transparent px-5 pt-4 pb-2 text-base text-foreground placeholder:text-muted-foreground/50 focus:outline-none field-sizing-content min-h-[44px] max-h-[200px]"
          />
          <div className="flex items-center justify-end px-3 pb-3">
            <Button
              type="submit"
              size="sm"
              disabled={isLoading || !input.trim()}
              className="rounded-xl px-3 h-9 gap-1.5 transition-all"
            >
              {isLoading ? (
                <Spinner className="size-4" />
              ) : (
                <HugeiconsIcon icon={ArrowUp01Icon} className="size-4" />
              )}
              {isLoading ? "Working..." : "Send"}
            </Button>
          </div>
        </div>
      </form>
    </motion.div>
  );
}
