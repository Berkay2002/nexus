import { describe, expect, it } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { CodexChatModel } from "../codex-chat-model.js";
import { loadCodexCliCredential } from "../credentials.js";

const HAS_CRED = loadCodexCliCredential() !== null || !!process.env.CODEX_ACCESS_TOKEN;

describe.skipIf(!HAS_CRED)("CodexChatModel integration", () => {
  it("round-trips a single message through the ChatGPT Codex endpoint", async () => {
    const cred = loadCodexCliCredential();
    if (!cred) throw new Error("precondition: credential should exist");
    const model = new CodexChatModel({
      model: "gpt-5.4",
      accessToken: cred.accessToken,
      accountId: cred.accountId,
      reasoningEffort: "none",
    });
    const response = await model.invoke([new HumanMessage("Reply with the single word: ok")]);
    expect(typeof response.content).toBe("string");
    expect((response.content as string).toLowerCase()).toContain("ok");
  }, 60_000);
});
