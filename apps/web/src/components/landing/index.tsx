"use client";

import Image from "next/image";
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
        <NexusPrompt onSubmit={onSubmit} isLoading={isLoading} />
      </div>
    </div>
  );
}
