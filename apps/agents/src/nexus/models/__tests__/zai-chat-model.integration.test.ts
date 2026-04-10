import { describe, it, expect } from "vitest";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ZaiChatOpenAI } from "../zai-chat-model.js";

const hasKey = Boolean(process.env.ZAI_API_KEY);

describe.skipIf(!hasKey)("ZaiChatOpenAI integration", () => {
  it("round-trips reasoning_content on a two-turn request", async () => {
    const capturedBodies: unknown[] = [];

    const customFetch: typeof fetch = async (input, init) => {
      if (init?.body && typeof init.body === "string") {
        try {
          capturedBodies.push(JSON.parse(init.body));
        } catch {
          // ignore non-JSON bodies
        }
      }
      return fetch(input, init);
    };

    const model = new ZaiChatOpenAI({
      model: "glm-4.7",
      apiKey: process.env.ZAI_API_KEY,
      configuration: {
        baseURL: process.env.ZAI_BASE_URL ?? "https://api.z.ai/api/paas/v4",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fetch: customFetch as any,
      },
    });

    // Turn 1: elicit a thinking-enabled response.
    const turn1 = await model.invoke([
      new SystemMessage("You are a concise assistant."),
      new HumanMessage("What is 17 times 23? Think briefly then answer."),
    ]);
    expect(turn1).toBeInstanceOf(AIMessage);
    const reasoning = (turn1 as AIMessage).additional_kwargs?.reasoning_content;
    // If z.ai returns no reasoning_content, skip the round-trip assertion —
    // the contract only matters when thinking is actually produced.
    if (typeof reasoning !== "string" || reasoning.length === 0) {
      console.warn(
        "z.ai returned no reasoning_content on turn 1; skipping round-trip assertion",
      );
      return;
    }

    // Turn 2: include turn 1's AI message verbatim and ask a follow-up.
    capturedBodies.length = 0;
    await model.invoke([
      new SystemMessage("You are a concise assistant."),
      new HumanMessage("What is 17 times 23? Think briefly then answer."),
      turn1 as AIMessage,
      new HumanMessage("Now multiply that by 2."),
    ]);

    expect(capturedBodies.length).toBeGreaterThan(0);
    const body = capturedBodies[capturedBodies.length - 1] as {
      messages: Array<{ role: string; reasoning_content?: string }>;
    };
    const assistants = body.messages.filter((m) => m.role === "assistant");
    expect(assistants.length).toBeGreaterThanOrEqual(1);
    expect(assistants[0].reasoning_content).toBe(reasoning);
  }, 60_000);
});
