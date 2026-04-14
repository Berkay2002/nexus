import { describe, it, expect, vi, afterEach } from "vitest";
import {
  configurableModelMiddleware,
  createConfigurableModelMiddleware,
  modelContextSchema,
} from "../middleware/configurable-model.js";
import { z } from "zod/v4";

// ---------------------------------------------------------------------------
// modelContextSchema tests
// ---------------------------------------------------------------------------
describe("modelContextSchema", () => {
  it("should accept empty context (models is optional)", () => {
    const result = z.safeParse(modelContextSchema, {});
    expect(result.success).toBe(true);
  });

  it("should accept a models map", () => {
    const result = z.safeParse(modelContextSchema, {
      models: { research: "anthropic:claude-sonnet-4-6", code: "google:gemini-3-flash-preview" },
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// configurableModelMiddleware shape test
// ---------------------------------------------------------------------------
describe("configurableModelMiddleware", () => {
  it("should be an AgentMiddleware object", () => {
    expect(configurableModelMiddleware).toBeDefined();
    expect(typeof configurableModelMiddleware).toBe("object");
  });
});

// ---------------------------------------------------------------------------
// Helper: build a minimal wrapModelCall request
// ---------------------------------------------------------------------------
function makeRequest(context: Record<string, unknown> | null | undefined) {
  return {
    model: "static-model" as any,
    messages: [],
    systemPrompt: "",
    systemMessage: { text: "" } as any,
    tools: [],
    state: { messages: [] } as any,
    runtime: {
      context: context ?? undefined,
      configurable: {},
      writer: () => {},
      interrupt: () => {},
      signal: new AbortController().signal,
    } as any,
  };
}

// ---------------------------------------------------------------------------
// Per-role override tests
// ---------------------------------------------------------------------------
describe("createConfigurableModelMiddleware — per-role routing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("per-role override routes to the right model when provider env is available", async () => {
    // Make both google + anthropic available
    vi.stubEnv("GOOGLE_API_KEY", "test-google-key");
    vi.stubEnv("ANTHROPIC_API_KEY", "test-anthropic-key");

    const middleware = createConfigurableModelMiddleware("research");
    expect(middleware.name).toBe("ConfigurableModel:research");

    let capturedModel: unknown = null;
    const handler = vi.fn(async (req: any) => {
      capturedModel = req.model;
      return { type: "ai", content: "ok" } as any;
    });

    const request = makeRequest({
      models: { research: "anthropic:claude-sonnet-4-6" },
    });

    await middleware.wrapModelCall!(request as any, handler);

    expect(handler).toHaveBeenCalledOnce();
    // The resolved model should be a ChatAnthropic instance (not the static string)
    expect(capturedModel).not.toBe("static-model");
    // ChatAnthropic has a lc_name or constructor name — just verify it's an object
    expect(typeof capturedModel).toBe("object");
  });

  it("per-role miss passes through to the agent's static model (no cross-agent leak)", async () => {
    // Regression: previously the middleware fell through to a shared
    // `ctx.model` slot when the per-role key was missing. That slot was
    // visible to every agent and leaked the orchestrator's resolved default-
    // tier model into sub-agents, silently overriding their static models.
    // The fix: when `ctx.models[agentName]` is missing, pass the request
    // through untouched so the agent's static model is used.
    vi.stubEnv("GOOGLE_API_KEY", "test-google-key");
    vi.stubEnv("ANTHROPIC_API_KEY", "test-anthropic-key");

    const middleware = createConfigurableModelMiddleware("code");

    let capturedRequest: unknown = null;
    const handler = vi.fn(async (req: any) => {
      capturedRequest = req;
      return { type: "ai", content: "ok" } as any;
    });

    // models map has "research" and a (now-ignored) legacy `model` field —
    // neither should affect the `code` middleware.
    const request = makeRequest({
      models: { research: "anthropic:claude-sonnet-4-6" },
      model: "google:gemini-3-flash-preview",
    });

    await middleware.wrapModelCall!(request as any, handler);

    expect(handler).toHaveBeenCalledOnce();
    // Request must be passed through unchanged — static model preserved.
    expect(capturedRequest).toBe(request);
    expect((capturedRequest as any).model).toBe("static-model");
  });

  it("orchestrator's resolved model in ctx.models does not leak into sub-agents", async () => {
    // Anti-leak regression. `orchestratorNode` writes its resolved model
    // into `ctx.models["nexus-orchestrator"]`. A sub-agent middleware
    // (e.g., "research") must NOT pick that up and substitute it for the
    // sub-agent's static model. Each middleware instance only reads its
    // own agentName key.
    vi.stubEnv("ZAI_API_KEY", "test-zai-key");

    const middleware = createConfigurableModelMiddleware("research");

    let capturedRequest: unknown = null;
    const handler = vi.fn(async (req: any) => {
      capturedRequest = req;
      return { type: "ai", content: "ok" } as any;
    });

    const request = makeRequest({
      models: { "nexus-orchestrator": "zai:glm-4.7" },
    });

    await middleware.wrapModelCall!(request as any, handler);

    expect(handler).toHaveBeenCalledOnce();
    // The research middleware must not have substituted the model — the
    // static model should still be in place.
    expect(capturedRequest).toBe(request);
    expect((capturedRequest as any).model).toBe("static-model");
  });

  it("unresolvable override warns and falls back even when providers are available", async () => {
    // Regression test for the silent-fallback bug: with providers available,
    // the middleware must still warn and pass through to the static model
    // when the override can't be matched to any catalog entry. The middleware
    // uses resolveOverride (strict) rather than resolveTier (which walks the
    // tier-priority chain and silently picks something else).
    vi.stubEnv("GOOGLE_API_KEY", "test-google-key");
    vi.stubEnv("ANTHROPIC_API_KEY", "test-anthropic-key");
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const middleware = createConfigurableModelMiddleware("research");

    const originalModel = "static-model-instance" as any;
    let capturedModel: unknown = null;
    const handler = vi.fn(async (req: any) => {
      capturedModel = req.model;
      return { type: "ai", content: "ok" } as any;
    });

    const request = makeRequest({
      models: { research: "nonexistent:bad-model-id" },
    });
    (request as any).model = originalModel;

    await middleware.wrapModelCall!(request as any, handler);

    expect(handler).toHaveBeenCalledOnce();
    // Should pass through with unmodified model since override is unresolvable
    expect(capturedModel).toBe(originalModel);
    // Should have emitted a warning containing the agent name and the override string
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("research"),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("nonexistent:bad-model-id"),
    );

    warnSpy.mockRestore();
  });

  it("no context is a no-op pass-through", async () => {
    const middleware = createConfigurableModelMiddleware("research");

    let capturedRequest: unknown = null;
    const handler = vi.fn(async (req: any) => {
      capturedRequest = req;
      return { type: "ai", content: "ok" } as any;
    });

    const request = makeRequest(null);

    await middleware.wrapModelCall!(request as any, handler);

    expect(handler).toHaveBeenCalledOnce();
    // Request should be passed through unmodified
    expect(capturedRequest).toBe(request);
  });

  it("empty models map is a no-op pass-through", async () => {
    const middleware = createConfigurableModelMiddleware("research");

    let capturedRequest: unknown = null;
    const handler = vi.fn(async (req: any) => {
      capturedRequest = req;
      return { type: "ai", content: "ok" } as any;
    });

    const request = makeRequest({});

    await middleware.wrapModelCall!(request as any, handler);

    expect(handler).toHaveBeenCalledOnce();
    expect(capturedRequest).toBe(request);
  });
});
