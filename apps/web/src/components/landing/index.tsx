"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { PromptBar } from "@/components/execution/prompt-bar";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { SettingsButton } from "@/components/settings/settings-button";

interface LandingPageProps {
  onSubmit: (message: string | PromptInputMessage) => void;
  isLoading: boolean;
}

export function LandingPage({ onSubmit, isLoading }: LandingPageProps) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4">
      <div className="absolute top-4 right-4 z-10">
        <SettingsButton />
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
