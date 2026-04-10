"use client";

import { motion } from "framer-motion";
import { NexusLogo } from "./nexus-logo";
import { NexusPrompt } from "./nexus-prompt";

interface LandingPageProps {
  onSubmit: (text: string) => void;
  isLoading: boolean;
}

export function LandingPage({ onSubmit, isLoading }: LandingPageProps) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4">
      <div className="flex flex-col items-center gap-8 w-full">
        <NexusLogo />

        {/* Tagline */}
        <motion.div
          className="flex flex-col items-center gap-2 text-center"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
        >
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Nexus works.
          </h1>
          <p className="text-lg text-muted-foreground max-w-md">
            Everything AI can do, Nexus does for you.
          </p>
        </motion.div>

        {/* Prompt input */}
        <NexusPrompt onSubmit={onSubmit} isLoading={isLoading} />
      </div>
    </div>
  );
}
