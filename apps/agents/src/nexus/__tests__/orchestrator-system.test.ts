import { describe, it, expect } from "vitest";
import { ORCHESTRATOR_SYSTEM_PROMPT } from "../prompts/orchestrator-system.js";

describe("ORCHESTRATOR_SYSTEM_PROMPT", () => {
  it("should be a non-empty string", () => {
    expect(typeof ORCHESTRATOR_SYSTEM_PROMPT).toBe("string");
    expect(ORCHESTRATOR_SYSTEM_PROMPT.length).toBeGreaterThan(100);
  });

  it("should mention workspace convention via templated workspaceRoot placeholder", () => {
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("{workspaceRoot}/");
  });

  it("should mention sub-agent delegation via task tool", () => {
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("task");
  });

  it("should mention write_todos for planning", () => {
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("write_todos");
  });

  it("should instruct concise sub-agent responses", () => {
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("500");
  });
});
