import { describe, it, expect, vi, afterEach } from "vitest";
import { routerOutputSchema, metaRouter } from "../meta-router.js";
import { z } from "zod/v4";
import { HumanMessage } from "@langchain/core/messages";
import * as modelRegistry from "../models/index.js";

describe("routerOutputSchema", () => {
  it("should accept valid 'default' classification", () => {
    const result = z.safeParse(routerOutputSchema, {
      complexity: "default",
      reasoning: "Multi-step task requiring delegation",
    });
    expect(result.success).toBe(true);
  });

  it("should accept valid 'trivial' classification", () => {
    const result = z.safeParse(routerOutputSchema, {
      complexity: "trivial",
      reasoning: "Trivial one-shot question, low latency",
    });
    expect(result.success).toBe(true);
  });

  it("should reject unknown complexity labels", () => {
    const result = z.safeParse(routerOutputSchema, {
      complexity: "hard",
      reasoning: "Unknown label",
    });
    expect(result.success).toBe(false);
  });

  it("should reject legacy model-id shaped output", () => {
    const result = z.safeParse(routerOutputSchema, {
      model: "gemini-3-flash-preview",
      reasoning: "Legacy shape",
    });
    expect(result.success).toBe(false);
  });
});

describe("metaRouter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should be a function that accepts NexusState", () => {
    expect(typeof metaRouter).toBe("function");
  });

  it("recovers from structured-output parsing failure when model returns raw 'default'", async () => {
    const parsingError = new Error(
      `Failed to parse. Text: "default". Error: SyntaxError: Unexpected token 'd', "default" is not valid JSON Troubleshooting URL: https://docs.langchain.com/oss/javascript/langchain/errors/OUTPUT_PARSING_FAILURE/`,
    );

    const structuredInvoker = {
      invoke: vi.fn().mockRejectedValue(parsingError),
    };

    const primaryModel = {
      withStructuredOutput: vi.fn().mockReturnValue(structuredInvoker),
      invoke: vi.fn().mockResolvedValue({ content: "default" }),
    };

    vi.spyOn(modelRegistry, "resolveTier").mockImplementation(
      ((tier: string) =>
        tier === "classifier" ? (primaryModel as any) : null) as any,
    );
    vi.spyOn(modelRegistry, "buildTierFallbacks").mockReturnValue([]);

    const state = {
      messages: [new HumanMessage("Build me a production-ready app")],
      routerResult: null,
    };

    const result = await metaRouter(state as any);

    expect(result.routerResult).not.toBeNull();
    expect(result.routerResult!.complexity).toBe("default");
    expect(result.routerResult!.reasoning).toContain(
      "Recovered from non-JSON classifier output",
    );
    expect(structuredInvoker.invoke).toHaveBeenCalledTimes(1);
    expect(primaryModel.invoke).toHaveBeenCalledTimes(1);
  });

  it("normalizes classification-shaped JSON from fallback output", async () => {
    const parsingError = new Error(
      `Failed to parse. Text: "{\n  \"classification\": \"default\"\n}". Error: schema mismatch`,
    );

    const structuredInvoker = {
      invoke: vi.fn().mockRejectedValue(parsingError),
    };

    const primaryModel = {
      withStructuredOutput: vi.fn().mockReturnValue(structuredInvoker),
      invoke: vi
        .fn()
        .mockResolvedValue({
          content: [
            {
              type: "text",
              text: '{\n  "classification": "default"\n}',
            },
          ],
        }),
    };

    vi.spyOn(modelRegistry, "resolveTier").mockImplementation(
      ((tier: string) =>
        tier === "classifier" ? (primaryModel as any) : null) as any,
    );
    vi.spyOn(modelRegistry, "buildTierFallbacks").mockReturnValue([]);

    const state = {
      messages: [new HumanMessage("Plan a multi-step migration")],
      routerResult: null,
    };

    const result = await metaRouter(state as any);

    expect(result.routerResult).not.toBeNull();
    expect(result.routerResult!.complexity).toBe("default");
    expect(result.routerResult!.reasoning).toContain(
      "normalized classification",
    );
  });

  it("recovers when parsing failure is thrown as a non-Error object", async () => {
    const parsingFailureObject = {
      message: `Failed to parse. Text: "\`\`\`json\n{\n  \"classification\": \"default\"\n}\n\`\`\`". Error: [{\"code\":\"invalid_value\",\"path\":[\"complexity\"]}]`,
    };

    const structuredInvoker = {
      invoke: vi.fn().mockRejectedValue(parsingFailureObject),
    };

    const primaryModel = {
      withStructuredOutput: vi.fn().mockReturnValue(structuredInvoker),
      invoke: vi
        .fn()
        .mockResolvedValue({
          content: [
            {
              type: "text",
              text: '```json\n{\n  "classification": "default"\n}\n```',
            },
          ],
        }),
    };

    vi.spyOn(modelRegistry, "resolveTier").mockImplementation(
      ((tier: string) =>
        tier === "classifier" ? (primaryModel as any) : null) as any,
    );
    vi.spyOn(modelRegistry, "buildTierFallbacks").mockReturnValue([]);

    const state = {
      messages: [new HumanMessage("Route this complex request")],
      routerResult: null,
    };

    const result = await metaRouter(state as any);

    expect(result.routerResult).not.toBeNull();
    expect(result.routerResult!.complexity).toBe("default");
    expect(result.routerResult!.reasoning).toContain(
      "normalized classification",
    );
  });

  it("rethrows non-parsing structured-output errors", async () => {
    const nonParsingError = new Error("Provider call failed");

    const structuredInvoker = {
      invoke: vi.fn().mockRejectedValue(nonParsingError),
    };

    const primaryModel = {
      withStructuredOutput: vi.fn().mockReturnValue(structuredInvoker),
      invoke: vi.fn().mockResolvedValue({ content: "default" }),
    };

    vi.spyOn(modelRegistry, "resolveTier").mockImplementation(
      ((tier: string) =>
        tier === "classifier" ? (primaryModel as any) : null) as any,
    );
    vi.spyOn(modelRegistry, "buildTierFallbacks").mockReturnValue([]);

    const state = {
      messages: [new HumanMessage("Analyze this")],
      routerResult: null,
    };

    await expect(metaRouter(state as any)).rejects.toThrow("Provider call failed");
    expect(primaryModel.invoke).not.toHaveBeenCalled();
  });
});
