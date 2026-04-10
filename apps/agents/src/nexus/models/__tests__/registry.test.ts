import { describe, it, expect, afterEach, vi } from "vitest";
import { ChatGoogle } from "@langchain/google/node";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import {
  resolveTier,
  listAvailableModels,
  isTierAvailable,
  getTierDefault,
  MODEL_CATALOG,
} from "../registry.js";

function clearProviderEnv() {
  vi.stubEnv("GOOGLE_CLOUD_PROJECT", "");
  vi.stubEnv("GOOGLE_API_KEY", "");
  vi.stubEnv("GEMINI_API_KEY", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.stubEnv("OPENAI_API_KEY", "");
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

describe("models/registry", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("all providers available → default tier returns ChatGoogle (priority)", () => {
    clearProviderEnv();
    enableGoogle();
    enableAnthropic();
    enableOpenAI();
    const model = resolveTier("default");
    expect(model).toBeInstanceOf(ChatGoogle);
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
