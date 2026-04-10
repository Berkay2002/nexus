import { describe, it, expect } from "vitest";
import { routerOutputSchema, metaRouter } from "../meta-router.js";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod/v4";

/**
 * Integration tests that hit a real model provider.
 * Requires GOOGLE_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY.
 * Skip with: npx vitest run --exclude "**\/integration*"
 */
const hasProvider =
  !!process.env.GOOGLE_API_KEY ||
  !!process.env.GEMINI_API_KEY ||
  !!process.env.GOOGLE_CLOUD_PROJECT ||
  !!process.env.ANTHROPIC_API_KEY ||
  !!process.env.OPENAI_API_KEY;

describe.skipIf(!hasProvider)("Meta-Router Integration", () => {
  it("should classify a trivial question as Flash-Lite", async () => {
    const state = {
      messages: [new HumanMessage("What is the capital of France?")],
      routerResult: null,
    };

    const result = await metaRouter(state);

    expect(result.routerResult).not.toBeNull();
    expect(result.routerResult!.complexity).toBe("trivial");
    expect(result.routerResult!.reasoning).toBeTruthy();
  }, 30000);

  it("should classify a complex project as default", async () => {
    const state = {
      messages: [
        new HumanMessage(
          "Build me a full-stack web application with user authentication, a dashboard with real-time charts, and deploy it to production",
        ),
      ],
      routerResult: null,
    };

    const result = await metaRouter(state);

    expect(result.routerResult).not.toBeNull();
    expect(result.routerResult!.complexity).toBe("default");
    expect(result.routerResult!.reasoning).toBeTruthy();
  }, 30000);

  it("should return valid schema-conformant output", async () => {
    const state = {
      messages: [new HumanMessage("Help me debug this Python error")],
      routerResult: null,
    };

    const result = await metaRouter(state);
    const parsed = z.safeParse(routerOutputSchema, result.routerResult);
    expect(parsed.success).toBe(true);
  }, 30000);
});
