import { describe, it, expect } from "vitest";
import { routerOutputSchema, metaRouter } from "../meta-router.js";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod/v4";

describe("routerOutputSchema", () => {
  it("should accept valid Flash classification", () => {
    const result = z.safeParse(routerOutputSchema, {
      model: "gemini-3-flash-preview",
      reasoning: "Simple question, single-step",
    });
    expect(result.success).toBe(true);
  });

  it("should accept valid Pro classification", () => {
    const result = z.safeParse(routerOutputSchema, {
      model: "gemini-3.1-pro-preview",
      reasoning: "Complex multi-step project",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid model names", () => {
    const result = z.safeParse(routerOutputSchema, {
      model: "gpt-4",
      reasoning: "Not a valid Gemini model",
    });
    expect(result.success).toBe(false);
  });
});

describe("metaRouter", () => {
  it("should be a function that accepts NexusState", () => {
    expect(typeof metaRouter).toBe("function");
  });
});
