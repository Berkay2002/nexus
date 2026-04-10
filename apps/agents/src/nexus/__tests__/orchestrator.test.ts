import { describe, it, expect } from "vitest";
import { createNexusOrchestrator, orchestratorNode } from "../orchestrator.js";

describe("createNexusOrchestrator", () => {
  it("should be a function", () => {
    expect(typeof createNexusOrchestrator).toBe("function");
  });
});

describe("orchestratorNode", () => {
  it("should be a function that accepts state", () => {
    expect(typeof orchestratorNode).toBe("function");
  });
});
