import { describe, it, expect, vi, beforeEach } from "vitest";

// Ensure a provider is considered available so the orchestrator and
// sub-agent factories can resolve their model tiers during this unit test.
process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY ?? "test-key";

/**
 * These tests verify the orchestrator is wired with sub-agents
 * without hitting real APIs. We mock createDeepAgent to capture
 * the params it receives.
 */

// Mock createDeepAgent to capture params
let capturedParams: Record<string, unknown> | null = null;
vi.mock("deepagents", () => ({
  createDeepAgent: (params: Record<string, unknown>) => {
    capturedParams = params;
    return {
      invoke: vi.fn().mockResolvedValue({ messages: [] }),
    };
  },
  CompositeBackend: class {
    constructor() {}
  },
  StoreBackend: class {
    constructor() {}
  },
  BaseSandbox: class {
    constructor() {}
  },
}));

// Mock @agent-infra/sandbox since AIOSandboxBackend creates a SandboxClient
vi.mock("@agent-infra/sandbox", () => ({
  SandboxClient: class {
    constructor() {}
  },
}));

// Must import AFTER mock setup
const { createNexusOrchestrator } = await import("../orchestrator.js");

describe("Orchestrator sub-agent wiring", () => {
  beforeEach(() => {
    capturedParams = null;
    createNexusOrchestrator();
  });

  it("should pass subagents to createDeepAgent", () => {
    expect(capturedParams).not.toBeNull();
    expect(capturedParams!.subagents).toBeDefined();
  });

  it("should include all 4 sub-agents", () => {
    const subagents = capturedParams!.subagents as Array<{ name: string }>;
    expect(subagents).toHaveLength(4);
    const names = subagents.map((a) => a.name);
    expect(names).toContain("research");
    expect(names).toContain("code");
    expect(names).toContain("creative");
    expect(names).toContain("general-purpose");
  });

  it("should include research agent with tools", () => {
    const subagents = capturedParams!.subagents as Array<{
      name: string;
      tools?: Array<{ name: string }>;
    }>;
    const research = subagents.find((a) => a.name === "research")!;
    expect(research.tools).toHaveLength(3);
  });

  it("should include code agent with runtime tools", () => {
    const subagents = capturedParams!.subagents as Array<{
      name: string;
      tools?: Array<{ name: string }>;
    }>;
    const code = subagents.find((a) => a.name === "code")!;
    expect(code.tools).toHaveLength(3);
    expect(code.tools?.map((tool) => tool.name)).toEqual([
      "sandbox_code_execute",
      "sandbox_jupyter_create_session",
      "sandbox_jupyter_execute",
    ]);
  });

  it("should include creative agent with tools", () => {
    const subagents = capturedParams!.subagents as Array<{
      name: string;
      tools?: Array<{ name: string }>;
    }>;
    const creative = subagents.find((a) => a.name === "creative")!;
    expect(creative.tools).toHaveLength(1);
  });
});
