import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { detectGoogleAuthMode } from "../preflight.js";

/**
 * End-to-end test exercising the full graph: metaRouter → orchestrator → response.
 *
 * Requirements:
 *   - Google credentials (Vertex ADC, GOOGLE_API_KEY, or GEMINI_API_KEY)
 *   - AIO Sandbox running at http://localhost:8080 (or SANDBOX_URL)
 *   - TAVILY_API_KEY (for the missing-key error-surface case)
 *
 * Vitest does not auto-load .env — run with:
 *   set -a && source ../../.env && set +a
 *   npx vitest run src/nexus/__tests__/e2e.test.ts
 */
const skip = detectGoogleAuthMode() === "none";

describe.skipIf(skip)("Nexus E2E graph", () => {
  it("routes a trivial prompt through metaRouter and returns an AI response", async () => {
    const { graph } = await import("../graph.js");
    const result = await graph.invoke({
      messages: [new HumanMessage("What is 2+2?")],
    });

    expect(result.routerResult).toBeDefined();
    expect(result.routerResult?.complexity).toBeTruthy();
    expect(result.messages.length).toBeGreaterThan(1);

    const last = result.messages[result.messages.length - 1];
    const content =
      typeof last.content === "string"
        ? last.content
        : JSON.stringify(last.content);
    expect(content.length).toBeGreaterThan(0);
  }, 60000);
});

describe.skipIf(skip)("Nexus E2E — Tavily key missing error surface", () => {
  let savedKey: string | undefined;

  beforeEach(() => {
    savedKey = process.env.TAVILY_API_KEY;
    delete process.env.TAVILY_API_KEY;
  });

  afterEach(() => {
    if (savedKey !== undefined) process.env.TAVILY_API_KEY = savedKey;
  });

  it("surfaces TAVILY_API_KEY missing to the user instead of crashing", async () => {
    const { graph } = await import("../graph.js");
    const result = await graph.invoke({
      messages: [
        new HumanMessage(
          "Research the latest news about quantum computing using web search.",
        ),
      ],
    });

    // Orchestrator should complete without throwing; the error surfaces
    // either in the final AI message or embedded in a tool result.
    const allContent = result.messages
      .map((m) =>
        typeof m.content === "string"
          ? m.content
          : JSON.stringify(m.content),
      )
      .join("\n");
    expect(allContent).toContain("TAVILY_API_KEY");
  }, 120000);
});
