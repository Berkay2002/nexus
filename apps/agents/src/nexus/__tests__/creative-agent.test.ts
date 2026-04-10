import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  CREATIVE_AGENT_NAME,
  CREATIVE_AGENT_DESCRIPTION,
  CREATIVE_SYSTEM_PROMPT,
} from "../agents/creative/prompt.js";
import { createCreativeAgent } from "../agents/creative/agent.js";

describe("Creative Agent prompt", () => {
  it("should export CREATIVE_AGENT_NAME as 'creative'", () => {
    expect(CREATIVE_AGENT_NAME).toBe("creative");
  });

  it("should export a non-empty CREATIVE_AGENT_DESCRIPTION", () => {
    expect(CREATIVE_AGENT_DESCRIPTION.length).toBeGreaterThan(20);
  });

  it("should export a non-empty CREATIVE_SYSTEM_PROMPT", () => {
    expect(CREATIVE_SYSTEM_PROMPT.length).toBeGreaterThan(100);
  });

  it("should include workspace path in system prompt", () => {
    expect(CREATIVE_SYSTEM_PROMPT).toContain("/home/gem/workspace/creative/");
  });

  it("should instruct concise summaries in system prompt", () => {
    expect(CREATIVE_SYSTEM_PROMPT).toContain("500");
  });
});

describe("Creative Agent factory", () => {
  const envKeys = [
    "GOOGLE_CLOUD_PROJECT",
    "GOOGLE_API_KEY",
    "GEMINI_API_KEY",
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
  ];
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of envKeys) saved[key] = process.env[key];
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("should return null when no image-capable provider is available", () => {
    for (const key of envKeys) delete process.env[key];
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.OPENAI_API_KEY = "test-key";
    expect(createCreativeAgent()).toBeNull();
  });

  it("should return a SubAgent when google is available", () => {
    for (const key of envKeys) delete process.env[key];
    process.env.GOOGLE_API_KEY = "test-key";
    const agent = createCreativeAgent();
    expect(agent).not.toBeNull();
    expect(agent!.name).toBe("creative");
    expect(agent!.tools).toHaveLength(1);
    expect(agent!.tools![0].name).toBe("generate_image");
    expect(agent!.model).toBeDefined();
  });
});
