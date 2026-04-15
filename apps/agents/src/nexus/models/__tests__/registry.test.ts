import { describe, it, expect, afterEach, vi } from "vitest";
import { ChatGoogle } from "@langchain/google/node";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import { __resetCredentialCacheForTesting } from "../credentials.js";
import {
  resolveTier,
  listAvailableModels,
  isTierAvailable,
  getTierDefault,
  MODEL_CATALOG,
  TIER_PRIORITY,
} from "../registry.js";

// Force the credential loaders to return null so host-machine Claude Code
// OAuth / Codex credentials don't leak into env-driven tier tests. Individual
// tests below opt-in to credentials via enableClaudeOAuth / enableCodex.
let _claudeOAuthCred: ReturnType<typeof Object> | null = null;
let _codexCred: ReturnType<typeof Object> | null = null;
vi.mock("../credentials.js", async () => {
  const actual = await vi.importActual<typeof import("../credentials.js")>(
    "../credentials.js",
  );
  return {
    ...actual,
    loadClaudeOAuthCredential: () => _claudeOAuthCred,
    loadCodexCliCredential: () => _codexCred,
  };
});

function clearProviderEnv() {
  vi.stubEnv("GOOGLE_CLOUD_PROJECT", "");
  vi.stubEnv("GOOGLE_API_KEY", "");
  vi.stubEnv("GEMINI_API_KEY", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("ZAI_API_KEY", "");
  vi.stubEnv("ZAI_BASE_URL", "");
  _claudeOAuthCred = null;
  _codexCred = null;
  __resetCredentialCacheForTesting();
}

function enableGoogle() {
  vi.stubEnv("GOOGLE_API_KEY", "test-google-key");
}

function enableAnthropic() {
  vi.stubEnv("ANTHROPIC_API_KEY", "test-anthropic-key");
}

function enableOpenAI() {
  vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
}

function enableZai() {
  vi.stubEnv("ZAI_API_KEY", "test-zai-key");
}

describe("models/registry", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("all providers available → default tier returns ChatAnthropic (priority)", () => {
    clearProviderEnv();
    enableGoogle();
    enableAnthropic();
    enableOpenAI();
    const model = resolveTier("default");
    expect(model).toBeInstanceOf(ChatAnthropic);
  });

  it("only zai available → default tier returns a ChatOpenAI (z.ai reuses ChatOpenAI)", () => {
    clearProviderEnv();
    enableZai();
    const model = resolveTier("default");
    expect(model).toBeInstanceOf(ChatOpenAI);
    expect(isTierAvailable("deep-research")).toBe(true);
    expect(isTierAvailable("image")).toBe(false);
  });

  it("deep-research tier falls through to zai when no other providers are set", () => {
    clearProviderEnv();
    enableZai();
    const descriptor = getTierDefault("deep-research");
    expect(descriptor?.provider).toBe("zai");
    expect(descriptor?.id).toBe("glm-5.1");
  });

  it("only anthropic available → default returns ChatAnthropic, image returns null", () => {
    clearProviderEnv();
    enableAnthropic();
    expect(resolveTier("default")).toBeInstanceOf(ChatAnthropic);
    expect(resolveTier("image")).toBeNull();
    expect(isTierAvailable("image")).toBe(false);
  });

  it("only openai available → code tier returns ChatOpenAI", () => {
    clearProviderEnv();
    enableOpenAI();
    expect(resolveTier("code")).toBeInstanceOf(ChatOpenAI);
    expect(isTierAvailable("code")).toBe(true);
  });

  it("no providers available → every resolveTier returns null and listAvailableModels is empty", () => {
    clearProviderEnv();
    expect(resolveTier("classifier")).toBeNull();
    expect(resolveTier("default")).toBeNull();
    expect(resolveTier("code")).toBeNull();
    expect(resolveTier("deep-research")).toBeNull();
    expect(resolveTier("image")).toBeNull();
    expect(listAvailableModels()).toEqual([]);
  });

  it("explicit provider:id override wins over tier priority", () => {
    clearProviderEnv();
    enableGoogle();
    enableAnthropic();
    enableOpenAI();
    const model = resolveTier("default", "anthropic:claude-sonnet-4-6");
    expect(model).toBeInstanceOf(ChatAnthropic);
  });

  it("bare-id override resolves via catalog lookup", () => {
    clearProviderEnv();
    enableGoogle();
    enableAnthropic();
    const model = resolveTier("default", "claude-sonnet-4-6");
    expect(model).toBeInstanceOf(ChatAnthropic);
  });

  it("override for unavailable provider falls back to priority", () => {
    clearProviderEnv();
    enableGoogle();
    const model = resolveTier("default", "anthropic:claude-sonnet-4-6");
    expect(model).toBeInstanceOf(ChatGoogle);
  });

  it("code tier prioritizes anthropic over google when both available", () => {
    clearProviderEnv();
    enableGoogle();
    enableAnthropic();
    const model = resolveTier("code");
    expect(model).toBeInstanceOf(ChatAnthropic);
  });

  it("classifier tier with only openai returns ChatOpenAI", () => {
    clearProviderEnv();
    enableOpenAI();
    expect(resolveTier("classifier")).toBeInstanceOf(ChatOpenAI);
  });

  it("listAvailableModels filters to only anthropic when only anthropic env is set", () => {
    clearProviderEnv();
    enableAnthropic();
    const available = listAvailableModels();
    const anthropicCount = MODEL_CATALOG.filter(
      (m) => m.provider === "anthropic",
    ).length;
    expect(available).toHaveLength(anthropicCount);
    expect(available.every((m) => m.provider === "anthropic")).toBe(true);
    expect(anthropicCount).toBe(3);
  });

  it("getTierDefault with google only returns a google descriptor for default tier", () => {
    clearProviderEnv();
    enableGoogle();
    const descriptor = getTierDefault("default");
    expect(descriptor).not.toBeNull();
    expect(descriptor?.provider).toBe("google");
    expect(descriptor?.tiers).toContain("default");
  });
});

describe("registry — Claude OAuth + Codex wiring", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    _claudeOAuthCred = null;
    _codexCred = null;
    __resetCredentialCacheForTesting();
  });

  it("includes claude-oauth before anthropic in every tier that has anthropic", () => {
    for (const tier of ["classifier", "default", "code", "deep-research"] as const) {
      const priority = TIER_PRIORITY[tier];
      const oauthIdx = priority.indexOf("claude-oauth");
      const anthropicIdx = priority.indexOf("anthropic");
      if (anthropicIdx === -1) continue;
      expect(oauthIdx).toBeGreaterThanOrEqual(0);
      expect(oauthIdx).toBeLessThan(anthropicIdx);
    }
  });

  it("appends codex to the code tier priority", () => {
    expect(TIER_PRIORITY.code).toContain("codex");
  });

  it("resolves code tier to anthropic when Claude OAuth is absent", () => {
    clearProviderEnv();
    enableAnthropic();
    // _claudeOAuthCred and _codexCred already nulled by clearProviderEnv.
    const descriptor = getTierDefault("code");
    expect(descriptor?.provider).toBe("anthropic");
  });
});
