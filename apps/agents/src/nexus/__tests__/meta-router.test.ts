import { describe, it, expect } from "vitest";
import { routerOutputSchema, metaRouter } from "../meta-router.js";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod/v4";

describe("routerOutputSchema", () => {
  it("should accept valid Flash classification", () => {
    const result = z.safeParse(routerOutputSchema, {
      model: "gemini-3-flash-preview",
      reasoning: "Default workhorse for multi-step tasks",
    });
    expect(result.success).toBe(true);
  });

  it("should accept valid Flash-Lite classification", () => {
    const result = z.safeParse(routerOutputSchema, {
      model: "gemini-3.1-flash-lite-preview",
      reasoning: "Trivial one-shot question, low latency",
    });
    expect(result.success).toBe(true);
  });

  it("should reject Pro model names — Pro is deep-research only", () => {
    const result = z.safeParse(routerOutputSchema, {
      model: "gemini-3.1-pro-preview",
      reasoning: "Pro is not a valid orchestrator model",
    });
    expect(result.success).toBe(false);
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
