import {
  isProviderAvailable,
  isTierAvailable,
  getTierDefault,
} from "./models/index.js";
import type { Tier, ProviderId } from "./models/index.js";
import {
  loadClaudeOAuthCredential,
  loadCodexCliCredential,
} from "./models/credentials.js";

export type GoogleAuthMode = "vertex-adc" | "api-key" | "none";

export class NexusConfigError extends Error {
  constructor(public readonly missing: string[]) {
    super(
      `Nexus is not configured. Missing: ${missing.join(", ")}. See .env.example.`,
    );
    this.name = "NexusConfigError";
  }
}

/**
 * Alias GEMINI_API_KEY → GOOGLE_API_KEY if only the former is set.
 * `@langchain/google` reads GOOGLE_API_KEY; this lets users who copy
 * Vertex AI Express Mode docs (which use GEMINI_API_KEY) work unchanged.
 */
export function aliasApiKey(): void {
  if (!process.env.GOOGLE_API_KEY && process.env.GEMINI_API_KEY) {
    process.env.GOOGLE_API_KEY = process.env.GEMINI_API_KEY;
  }
}

/**
 * Detect which Google auth path is active.
 *
 * An explicit `GOOGLE_API_KEY` always wins: ChatGoogle auto-selects AI Studio
 * whenever an API key is present, so project/ADC env vars alongside it have
 * no effect. Otherwise, ADC (credentials file or `GOOGLE_CLOUD_PROJECT`)
 * selects Vertex AI.
 */
export function detectGoogleAuthMode(): GoogleAuthMode {
  if (process.env.GOOGLE_API_KEY) return "api-key";
  if (
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.GOOGLE_CLOUD_CREDENTIALS ||
    process.env.GOOGLE_CLOUD_PROJECT
  ) {
    return "vertex-adc";
  }
  return "none";
}

export function checkMissing(): string[] {
  const missing: string[] = [];

  // At least one model provider must be available for the default tier.
  if (!isTierAvailable("default")) {
    missing.push(
      "Google credentials or another model provider required: set GEMINI_API_KEY / GOOGLE_API_KEY / GOOGLE_CLOUD_PROJECT for Google, ANTHROPIC_API_KEY for Anthropic, OPENAI_API_KEY for OpenAI, or ZAI_API_KEY for Z.AI (GLM)",
    );
  }

  if (!process.env.TAVILY_API_KEY) missing.push("TAVILY_API_KEY");

  return missing;
}

const PROVIDERS: ProviderId[] = [
  "google",
  "anthropic",
  "claude-oauth",
  "openai",
  "zai",
  "codex",
];

const PROVIDER_KEY_HINT: Record<ProviderId, string> = {
  google: "GEMINI_API_KEY / GOOGLE_API_KEY / GOOGLE_CLOUD_PROJECT",
  anthropic: "ANTHROPIC_API_KEY not set",
  openai: "OPENAI_API_KEY not set",
  zai: "ZAI_API_KEY not set",
  "claude-oauth": "no Claude OAuth credential (run 'claude setup-token')",
  codex: "no Codex CLI credential (run 'codex login')",
};

const TIERS: Tier[] = ["classifier", "default", "code", "deep-research", "image"];

const SUBAGENTS: Array<{ name: string; tier: Tier | null }> = [
  { name: "research", tier: "deep-research" },
  { name: "code", tier: "code" },
  { name: "creative", tier: "image" },
];

export function logPreflight(): void {
  // Alias must run before any availability checks.
  aliasApiKey();

  const googleMode = detectGoogleAuthMode();

  console.log("[Nexus] Preflight");

  // --- Providers ---
  console.log("[Nexus] Providers:");
  for (const provider of PROVIDERS) {
    const available = isProviderAvailable(provider);
    const mark = available ? "[OK]" : "[--]";
    let hint = "";
    if (provider === "google" && available) {
      hint = ` (${googleMode})`;
    } else if (provider === "claude-oauth" && available) {
      const cred = loadClaudeOAuthCredential();
      hint = cred ? ` (source: ${cred.source}, caching: off)` : "";
    } else if (provider === "codex" && available) {
      const cred = loadCodexCliCredential();
      const masked = cred?.accountId
        ? `${cred.accountId.slice(0, 8)}${cred.accountId.length > 8 ? "..." : ""}`
        : "unknown";
      hint = ` (account: ${masked})`;
    } else if (!available) {
      hint = ` (${PROVIDER_KEY_HINT[provider]})`;
    }
    const label = provider.padEnd(14);
    console.log(`  ${label}${mark}${hint}`);
  }

  // --- Tier resolution ---
  console.log("[Nexus] Tier resolution:");
  for (const tier of TIERS) {
    const descriptor = getTierDefault(tier);
    const resolution = descriptor
      ? `${descriptor.provider}:${descriptor.id}`
      : "unavailable";
    const label = tier.padEnd(14);
    console.log(`  ${label}→ ${resolution}`);
  }

  // --- Sub-agents ---
  console.log("[Nexus] Sub-agents:");
  for (const { name, tier } of SUBAGENTS) {
    const enabled = tier !== null && isTierAvailable(tier);
    const status = enabled ? "enabled" : "disabled (no provider for tier)";
    const label = name.padEnd(16);
    console.log(`  ${label}→ ${status}`);
  }
  console.log(`  ${"general-purpose".padEnd(16)}→ always enabled`);

  // --- Search ---
  const tavilyOk = Boolean(process.env.TAVILY_API_KEY);
  console.log(
    `[Nexus] Search: TAVILY_API_KEY ${tavilyOk ? "[OK]" : "[--] (TAVILY_API_KEY not set)"}`,
  );

  // --- Fail-fast if no default tier ---
  if (!isTierAvailable("default")) {
    // graph.ts imports this module at load time and calls logPreflight() unconditionally.
    // Vitest suites that import graph.ts would otherwise crash when no provider is configured,
    // even for tests that never exercise a live provider call. Skip the throw in test envs.
    if (process.env.VITEST || process.env.NODE_ENV === "test") {
      console.warn(
        "[Nexus] Running in test environment — skipping fatal provider check.",
      );
      return;
    }

    throw new Error(
      "[Nexus] FATAL: No model provider available for the default tier. " +
        "Set at least one of GEMINI_API_KEY, GOOGLE_API_KEY, GOOGLE_CLOUD_PROJECT, " +
        "ANTHROPIC_API_KEY, OPENAI_API_KEY, or ZAI_API_KEY.",
    );
  }
}
