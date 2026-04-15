"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { PromptBar } from "@/components/execution/prompt-bar";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { SettingsButton } from "@/components/settings/settings-button";
import {
  ThreadPickerButton,
  useThreadPicker,
} from "@/components/thread-picker/thread-picker";
import { useThreads } from "@/providers/Thread";

interface LandingPageProps {
  onSubmit: (message: string | PromptInputMessage) => void;
  isLoading: boolean;
}

function RunningThreadsPill() {
  const { threads } = useThreads();
  const { setOpen } = useThreadPicker();
  const runningCount = threads.filter((t) => t.status === "busy").length;
  if (runningCount === 0) return null;
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-400 transition hover:bg-amber-500/15"
    >
      <span className="size-1.5 animate-pulse rounded-full bg-amber-400" />
      {runningCount === 1
        ? "1 run in progress"
        : `${runningCount} runs in progress`}
      <span className="text-muted-foreground">· open command palette</span>
    </button>
  );
}

export function LandingPage({ onSubmit, isLoading }: LandingPageProps) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4">
      <div className="absolute top-4 left-4 z-10">
        <ThreadPickerButton />
      </div>
      <div className="absolute top-4 right-4 z-10">
        <SettingsButton />
      </div>
      <div className="absolute top-16 left-1/2 z-10 -translate-x-1/2">
        <RunningThreadsPill />
      </div>
      <div className="flex flex-col items-center gap-8 w-full">
        {/* Tagline */}
        <motion.div
          className="flex flex-col items-center gap-2 text-center"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <Image
            src="/logo/logo-text.png"
            alt="NEXUS"
            width={300}
            height={75}
            className="h-12 w-auto object-contain sm:h-16"
            priority
          />
          <p className="text-lg text-muted-foreground max-w-md">
            Everything AI can do, Nexus does for you.
          </p>
        </motion.div>

        {/* Prompt input */}
        <motion.div
          className="w-full max-w-3xl"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
        >
          <PromptBar
            onSubmit={onSubmit}
            isLoading={isLoading}
            placeholder="Ask anything"
            size="lg"
          />
        </motion.div>
      </div>
    </div>
  );
}
