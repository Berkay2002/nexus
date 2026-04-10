// apps/agents/src/nexus/__tests__/code-agent.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  CODE_AGENT_NAME,
  CODE_AGENT_DESCRIPTION,
  CODE_SYSTEM_PROMPT,
} from "../agents/code/prompt.js";
import { createCodeAgent } from "../agents/code/agent.js";

describe("Code Agent prompt", () => {
  it("should export CODE_AGENT_NAME as 'code'", () => {
    expect(CODE_AGENT_NAME).toBe("code");
  });

  it("should export a non-empty CODE_AGENT_DESCRIPTION", () => {
    expect(CODE_AGENT_DESCRIPTION.length).toBeGreaterThan(20);
  });

  it("should export a non-empty CODE_SYSTEM_PROMPT", () => {
    expect(CODE_SYSTEM_PROMPT.length).toBeGreaterThan(100);
  });

  it("should include workspace path in system prompt", () => {
    expect(CODE_SYSTEM_PROMPT).toContain("/home/gem/workspace/code/");
  });

  it("should mention execute tool in system prompt", () => {
    expect(CODE_SYSTEM_PROMPT).toContain("execute");
  });

  it("should instruct concise summaries in system prompt", () => {
    expect(CODE_SYSTEM_PROMPT).toContain("500");
  });
});

describe("Code Agent factory", () => {
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

  it("should return null when no provider is available", () => {
    for (const key of envKeys) delete process.env[key];
    expect(createCodeAgent()).toBeNull();
  });

  it("should return a SubAgent with name 'code' when a provider is available", () => {
    for (const key of envKeys) delete process.env[key];
    process.env.GOOGLE_API_KEY = "test-key";
    const agent = createCodeAgent();
    expect(agent).not.toBeNull();
    expect(agent!.name).toBe("code");
    expect(agent!.description).toBeTruthy();
    expect(agent!.systemPrompt).toBeTruthy();
    expect(agent!.tools).toBeUndefined();
    expect(agent!.model).toBeDefined();
  });
});
