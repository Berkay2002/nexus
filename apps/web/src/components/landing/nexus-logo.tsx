"use client";

import { motion } from "framer-motion";

export function NexusLogo() {
  return (
    <motion.div
      className="flex flex-col items-center gap-4"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {/* Geometric logomark */}
      <div className="relative size-14">
        <svg
          viewBox="0 0 56 56"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="size-14"
        >
          {/* Hexagonal shape with teal gradient */}
          <path
            d="M28 4L50 16V40L28 52L6 40V16L28 4Z"
            className="stroke-primary"
            strokeWidth="2"
            fill="none"
          />
          {/* Inner N letterform */}
          <path
            d="M20 38V18L36 38V18"
            className="stroke-primary"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
        {/* Subtle glow behind logo */}
        <div className="absolute inset-0 blur-2xl opacity-30 bg-primary rounded-full" />
      </div>
    </motion.div>
  );
}
