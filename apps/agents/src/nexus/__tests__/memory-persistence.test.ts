import { describe, it, expect } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { detectGoogleAuthMode } from "../preflight.js";

/**
 * Verifies that the /memories/ → StoreBackend chain works across graph
 * invocations. The orchestrator is instructed to remember a fact; a second
 * invocation (different HumanMessage, same process) asks for it back.
 *
 * Requirements:
 *   - Google credentials
 *   - AIO Sandbox running (the orchestrator's filesystem tools go through it)
 */
const skip = detectGoogleAuthMode() === "none";

describe.skipIf(skip)("Memory persistence across invocations", () => {
  it("remembers a fact written in one invocation and recalls it in another", async () => {
    const { graph } = await import("../graph.js");

    await graph.invoke({
      messages: [
        new HumanMessage(
          "Remember that I prefer TypeScript for all code examples. Write this preference to memory.",
        ),
      ],
    });

    const recall = await graph.invoke({
      messages: [
        new HumanMessage(
          "What programming language do I prefer for code examples? Check your memory.",
        ),
      ],
    });

    const lastMessage = recall.messages[recall.messages.length - 1];
    const content =
      typeof lastMessage.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);
    expect(content.toLowerCase()).toContain("typescript");
  }, 180000);
});
