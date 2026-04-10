// apps/agents/src/nexus/__tests__/agents-index.test.ts
import { describe, it, expect } from "vitest";
import {
  researchAgent,
  codeAgent,
  creativeAgent,
  generalPurposeAgent,
  nexusSubagents,
} from "../agents/index.js";

describe("Agents barrel export", () => {
  it("should export researchAgent", () => {
    expect(researchAgent).toBeDefined();
    expect(researchAgent.name).toBe("research");
  });

  it("should export codeAgent", () => {
    expect(codeAgent).toBeDefined();
    expect(codeAgent.name).toBe("code");
  });

  it("should export creativeAgent", () => {
    expect(creativeAgent).toBeDefined();
    expect(creativeAgent.name).toBe("creative");
  });

  it("should export generalPurposeAgent", () => {
    expect(generalPurposeAgent).toBeDefined();
    expect(generalPurposeAgent.name).toBe("general-purpose");
  });

  it("should export nexusSubagents array with all 4 agents", () => {
    expect(nexusSubagents).toHaveLength(4);
    const names = nexusSubagents.map((a) => a.name);
    expect(names).toContain("research");
    expect(names).toContain("code");
    expect(names).toContain("creative");
    expect(names).toContain("general-purpose");
  });

  it("should have unique names across all subagents", () => {
    const names = nexusSubagents.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("should have descriptions on all subagents", () => {
    for (const agent of nexusSubagents) {
      expect(agent.description.length).toBeGreaterThan(20);
    }
  });

  it("should have systemPrompts on all subagents", () => {
    for (const agent of nexusSubagents) {
      expect(agent.systemPrompt.length).toBeGreaterThan(50);
    }
  });
});
