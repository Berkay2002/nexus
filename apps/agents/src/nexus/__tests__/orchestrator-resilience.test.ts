import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AIMessage, HumanMessage } from "@langchain/core/messages";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("deepagents", () => ({
  createDeepAgent: () => ({
    invoke: invokeMock,
  }),
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

vi.mock("@agent-infra/sandbox", () => ({
  SandboxClient: class {
    constructor() {}
  },
}));

const { orchestratorNode } = await import("../orchestrator.js");

describe("orchestratorNode resilience for unavailable sub-agents", () => {
  beforeEach(() => {
    invokeMock.mockReset();

    vi.stubEnv("GOOGLE_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("GOOGLE_CLOUD_PROJECT", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("ZAI_API_KEY", "test-zai-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("retries once when creative is invoked but unavailable", async () => {
    const unavailableCreativeError = new Error(
      "Error: invoked agent of type creative, the only allowed types are `general-purpose`, `research`, `code`",
    );

    invokeMock
      .mockRejectedValueOnce(unavailableCreativeError)
      .mockResolvedValueOnce({
        messages: [new AIMessage("Recovered and continued")],
      });

    const result = await orchestratorNode(
      {
        messages: [new HumanMessage("Create a report with an image")],
        routerResult: { complexity: "default", reasoning: "complex request" },
      } as any,
      {
        configurable: { thread_id: "resilience-retry" },
      },
    );

    expect(invokeMock).toHaveBeenCalledTimes(2);
    const [firstInput, firstConfig] = invokeMock.mock.calls[0] as [
      { messages: unknown[] },
      { context: Record<string, unknown> },
    ];
    expect(firstInput.messages[0]).toBeInstanceOf(HumanMessage);
    expect(String(firstConfig.context.runtimeInstructions)).toContain(
      "Runtime sub-agent availability",
    );
    expect((result.messages ?? [])[0]).toBeInstanceOf(AIMessage);
  });

  it("returns a warning message instead of hard-failing when retry also fails", async () => {
    const unavailableCreativeError = new Error(
      "Error: invoked agent of type creative, the only allowed types are `general-purpose`, `research`, `code`",
    );

    invokeMock
      .mockRejectedValueOnce(unavailableCreativeError)
      .mockRejectedValueOnce(new Error("Second attempt still failed"));

    const result = await orchestratorNode(
      {
        messages: [new HumanMessage("Create a cover image")],
        routerResult: { complexity: "default", reasoning: "image requested" },
      } as any,
      {
        configurable: { thread_id: "resilience-warning" },
      },
    );

    expect(invokeMock).toHaveBeenCalledTimes(2);
    const first = (result.messages ?? [])[0];
    expect(first).toBeInstanceOf(AIMessage);
    expect(String((first as AIMessage).content)).toContain(
      "creative/image delegation is unavailable",
    );
  });
});
