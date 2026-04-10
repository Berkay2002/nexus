import { describe, it, expect } from "vitest";
import { routerOutputSchema, metaRouter } from "../meta-router.js";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod/v4";

/**
 * Integration tests that hit the real Gemini API.
 * Requires GOOGLE_API_KEY or Vertex AI credentials.
 * Skip with: npx vitest run --exclude "**\/integration*"
 */
describe("Meta-Router Integration", () => {
  it("should classify a simple question as Flash", async () => {
    const state = {
      messages: [new HumanMessage("What is the capital of France?")],
      routerResult: null,
    };

    const result = await metaRouter(state);

    expect(result.routerResult).not.toBeNull();
    expect(result.routerResult!.model).toBe("gemini-2.0-flash");
    expect(result.routerResult!.reasoning).toBeTruthy();
  }, 30000);

  it("should classify a complex project as Pro", async () => {
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
    expect(result.routerResult!.model).toBe("gemini-2.5-pro-preview-05-06");
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
