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
  it("should accept a valid model string", () => {
    const result = z.safeParse(modelContextSchema, {
      model: "gemini-3-flash-preview",
    });
    expect(result.success).toBe(true);
  });

  it("should accept context without model (optional)", () => {
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

  it("per-role miss falls through to legacy ctx.model", async () => {
    vi.stubEnv("GOOGLE_API_KEY", "test-google-key");

    const middleware = createConfigurableModelMiddleware("code");

    let capturedModel: unknown = null;
    const handler = vi.fn(async (req: any) => {
      capturedModel = req.model;
      return { type: "ai", content: "ok" } as any;
    });

    // models map has "research" but NOT "code" — should fall through to ctx.model
    const request = makeRequest({
      models: { research: "anthropic:claude-sonnet-4-6" },
      model: "google:gemini-3-flash-preview",
    });

    await middleware.wrapModelCall!(request as any, handler);

    expect(handler).toHaveBeenCalledOnce();
    // Should have resolved via ctx.model (google:gemini-3-flash-preview)
    expect(capturedModel).not.toBe("static-model");
    expect(typeof capturedModel).toBe("object");
  });

  it("unresolvable override falls back to static model (pass-through)", async () => {
    // Deliberately clear all provider env keys so resolveTier returns null.
    // When the override catalog lookup fails AND no tier fallback is available,
    // resolveTier("default", "nonexistent:bad-model-id") returns null and the
    // middleware passes through with the agent's static model unchanged.
    vi.stubEnv("GOOGLE_API_KEY", "");
    vi.stubEnv("GOOGLE_CLOUD_PROJECT", "");
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");

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

  it("no models and no ctx.model is a no-op pass-through", async () => {
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
