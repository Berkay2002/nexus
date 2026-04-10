import { describe, it, expect } from "vitest";
import { routerOutputSchema, metaRouter } from "../meta-router.js";
import { z } from "zod/v4";

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
  it("should be a function that accepts NexusState", () => {
    expect(typeof metaRouter).toBe("function");
  });
});
