"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export function NexusLogo() {
  return (
    <motion.div
      className="flex flex-col items-center gap-4"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <div className="relative size-16">
        <Image
          src="/logo/logo-icon.png"
          alt="Nexus"
          width={64}
          height={64}
          className="size-16 object-contain"
          priority
        />
        {/* Subtle glow behind logo */}
        <div className="absolute inset-0 blur-2xl opacity-30 bg-primary rounded-full" />
      </div>
    </motion.div>
  );
}
