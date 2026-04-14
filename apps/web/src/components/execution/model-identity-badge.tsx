"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type ProviderLogoKey = "google" | "anthropic" | "openai" | "zai";

const PROVIDER_LABEL: Record<ProviderLogoKey, string> = {
  google: "Google",
  anthropic: "Anthropic",
  openai: "OpenAI",
  zai: "Z.AI",
};

const PROVIDER_LOGO_PATH: Record<ProviderLogoKey, string> = {
  google: "/logo/providers/gemini.svg",
  anthropic: "/logo/providers/claude.svg",
  openai: "/logo/providers/openai.svg",
  zai: "/logo/providers/zai.svg",
};

const THEME_ADAPTIVE_MONO_LOGOS = new Set<ProviderLogoKey>(["openai", "zai"]);
const LOGO_VERSION = "2026-04-14-app";

export interface ModelIdentityBadgeProps {
  provider?: ProviderLogoKey | null;
  modelLabel: string;
  roleLabel: string;
  className?: string;
}

export function ModelIdentityBadge({
  provider,
  modelLabel,
  roleLabel,
  className,
}: ModelIdentityBadgeProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const providerLabel = provider ? PROVIDER_LABEL[provider] : "Model";
  const fallbackInitial = providerLabel.charAt(0).toUpperCase();
  const logoSrc = provider
    ? `${PROVIDER_LOGO_PATH[provider]}?v=${LOGO_VERSION}`
    : null;

  return (
    <span
      className={cn(
        "inline-flex h-5 max-w-full items-center overflow-hidden rounded-full border border-border/70 bg-background/80",
        className,
      )}
    >
      <span className="inline-flex h-full max-w-full items-center gap-1 border-r border-border/60 px-2">
        {logoSrc && !logoFailed ? (
          <img
            src={logoSrc}
            alt={`${providerLabel} logo`}
            className={cn(
              "size-3 shrink-0 object-contain",
              provider && THEME_ADAPTIVE_MONO_LOGOS.has(provider) &&
                "invert-0 dark:invert",
            )}
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <span className="inline-flex size-3 shrink-0 items-center justify-center rounded-sm bg-muted text-[8px] font-bold text-foreground/80">
            {fallbackInitial}
          </span>
        )}
        <span className="max-w-[9rem] truncate text-[10px] font-medium text-foreground/90 sm:max-w-[11rem]">
          {modelLabel}
        </span>
      </span>
      <span className="px-1.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
        {roleLabel}
      </span>
    </span>
  );
}
