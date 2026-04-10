// apps/web/src/app/api/models/route.ts
//
// IMPORTANT: This catalog is DUPLICATED by design from
// `apps/agents/src/nexus/models/registry.ts`. The three-process architecture
// (see .claude/rules/architecture.md) forbids sharing code between
// `apps/web/` and `apps/agents/` — they communicate only via the LangGraph
// protocol. Any changes to the agent-side registry MUST be mirrored here.
//
// The frontend catalog is expressed in terms of ROLES (orchestrator,
// research, code, creative, general-purpose) rather than TIERS, because
// roles are what the user selects in the settings UI. The role<->tier
// mapping is:
//   orchestrator      <- default
//   research          <- deep-research
//   code              <- code
//   creative          <- image
//   general-purpose   <- default
//
// The classifier tier is intentionally NOT exposed as a user-facing role.

import { NextResponse } from "next/server";

export type ProviderId = "google" | "anthropic" | "openai";
export type Role =
  | "orchestrator"
  | "research"
  | "code"
  | "creative"
  | "general-purpose";

export interface ModelOption {
  provider: ProviderId;
  id: string;
  label: string;
  fullId: string;
  roles: Role[];
}

export interface ModelsApiResponse {
  providers: Record<ProviderId, boolean>;
  models: ModelOption[];
  tierDefaults: Record<Role, string | null>;
}

interface CatalogEntry {
  provider: ProviderId;
  id: string;
  label: string;
  roles: Role[];
}

const CATALOG: CatalogEntry[] = [
  // Google
  {
    provider: "google",
    id: "gemini-3-flash-preview",
    label: "Gemini 3 Flash",
    roles: ["orchestrator", "code", "general-purpose"],
  },
  {
    provider: "google",
    id: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro",
    roles: ["research"],
  },
  {
    provider: "google",
    id: "gemini-3.1-flash-image-preview",
    label: "Gemini 3.1 Flash Image",
    roles: ["creative"],
  },
  // Anthropic
  {
    provider: "anthropic",
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    roles: ["orchestrator", "general-purpose"],
  },
  {
    provider: "anthropic",
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    roles: ["orchestrator", "code", "research", "general-purpose"],
  },
  {
    provider: "anthropic",
    id: "claude-opus-4-6",
    label: "Claude Opus 4.6",
    roles: ["code", "research"],
  },
  // OpenAI
  {
    provider: "openai",
    id: "gpt-5.4-nano",
    label: "GPT-5.4 nano",
    roles: ["orchestrator", "general-purpose"],
  },
  {
    provider: "openai",
    id: "gpt-5.4-mini",
    label: "GPT-5.4 mini",
    roles: ["orchestrator", "code", "general-purpose"],
  },
  {
    provider: "openai",
    id: "gpt-5.4",
    label: "GPT-5.4",
    roles: ["orchestrator", "code", "research", "general-purpose"],
  },
];

function hasEnv(name: string): boolean {
  const value = process.env[name];
  return typeof value === "string" && value.length > 0;
}

function isGoogleAvailable(): boolean {
  return (
    hasEnv("GOOGLE_CLOUD_PROJECT") ||
    hasEnv("GOOGLE_API_KEY") ||
    hasEnv("GEMINI_API_KEY")
  );
}

function isAnthropicAvailable(): boolean {
  return hasEnv("ANTHROPIC_API_KEY");
}

function isOpenAIAvailable(): boolean {
  return hasEnv("OPENAI_API_KEY");
}

function toFullId(provider: ProviderId, id: string): string {
  return `${provider}:${id}`;
}

// Per-role default priority lists. Each entry is a (provider, id) pair; the
// first entry whose provider is available becomes the default for that role.
const DEFAULT_PRIORITIES: Record<
  Role,
  Array<{ provider: ProviderId; id: string }>
> = {
  orchestrator: [
    { provider: "google", id: "gemini-3-flash-preview" },
    { provider: "anthropic", id: "claude-haiku-4-5" },
    { provider: "openai", id: "gpt-5.4-mini" },
  ],
  research: [
    { provider: "google", id: "gemini-3.1-pro-preview" },
    { provider: "anthropic", id: "claude-opus-4-6" },
    { provider: "openai", id: "gpt-5.4" },
  ],
  code: [
    { provider: "anthropic", id: "claude-sonnet-4-6" },
    { provider: "google", id: "gemini-3-flash-preview" },
    { provider: "openai", id: "gpt-5.4" },
  ],
  creative: [{ provider: "google", id: "gemini-3.1-flash-image-preview" }],
  "general-purpose": [
    { provider: "google", id: "gemini-3-flash-preview" },
    { provider: "anthropic", id: "claude-haiku-4-5" },
    { provider: "openai", id: "gpt-5.4-mini" },
  ],
};

const ALL_ROLES: Role[] = [
  "orchestrator",
  "research",
  "code",
  "creative",
  "general-purpose",
];

export async function GET(): Promise<NextResponse<ModelsApiResponse>> {
  const providers: Record<ProviderId, boolean> = {
    google: isGoogleAvailable(),
    anthropic: isAnthropicAvailable(),
    openai: isOpenAIAvailable(),
  };

  const availableModels: ModelOption[] = CATALOG.filter(
    (entry) => providers[entry.provider],
  ).map((entry) => ({
    provider: entry.provider,
    id: entry.id,
    label: entry.label,
    fullId: toFullId(entry.provider, entry.id),
    roles: entry.roles,
  }));

  const availableFullIds = new Set(availableModels.map((m) => m.fullId));

  const tierDefaults: Record<Role, string | null> = {
    orchestrator: null,
    research: null,
    code: null,
    creative: null,
    "general-purpose": null,
  };

  for (const role of ALL_ROLES) {
    for (const candidate of DEFAULT_PRIORITIES[role]) {
      const fullId = toFullId(candidate.provider, candidate.id);
      if (availableFullIds.has(fullId)) {
        tierDefaults[role] = fullId;
        break;
      }
    }
  }

  return NextResponse.json({
    providers,
    models: availableModels,
    tierDefaults,
  });
}
