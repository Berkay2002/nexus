// apps/agents/src/nexus/__tests__/agents-index.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createResearchAgent,
  createCodeAgent,
  createCreativeAgent,
  generalPurposeAgent,
  getNexusSubagents,
} from "../agents/index.js";

describe("Agents barrel export", () => {
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
    for (const key of envKeys) delete process.env[key];
    process.env.GOOGLE_API_KEY = "test-key";
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("should export createResearchAgent factory", () => {
    expect(createResearchAgent()).not.toBeNull();
    expect(createResearchAgent()!.name).toBe("research");
  });

  it("should export createCodeAgent factory", () => {
    expect(createCodeAgent()).not.toBeNull();
    expect(createCodeAgent()!.name).toBe("code");
  });

  it("should export createCreativeAgent factory", () => {
    expect(createCreativeAgent()).not.toBeNull();
    expect(createCreativeAgent()!.name).toBe("creative");
  });

  it("should export generalPurposeAgent", () => {
    expect(generalPurposeAgent).toBeDefined();
    expect(generalPurposeAgent.name).toBe("general-purpose");
  });

  it("should return all 4 agents from getNexusSubagents() when all tiers resolve", () => {
    const agents = getNexusSubagents();
    expect(agents).toHaveLength(4);
    const names = agents.map((a) => a.name);
    expect(names).toContain("research");
    expect(names).toContain("code");
    expect(names).toContain("creative");
    expect(names).toContain("general-purpose");
  });

  it("should have unique names across all subagents", () => {
    const agents = getNexusSubagents();
    const names = agents.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("should have descriptions on all subagents", () => {
    const agents = getNexusSubagents();
    for (const agent of agents) {
      expect(agent.description.length).toBeGreaterThan(20);
    }
  });

  it("should have systemPrompts on all subagents", () => {
    const agents = getNexusSubagents();
    for (const agent of agents) {
      expect(agent.systemPrompt.length).toBeGreaterThan(50);
    }
  });

  it("should always include general-purpose even when only general-purpose is available", () => {
    for (const key of envKeys) delete process.env[key];
    const agents = getNexusSubagents();
    expect(agents.map((a) => a.name)).toEqual(["general-purpose"]);
  });
});
