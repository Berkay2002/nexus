import { describe, expect, it } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { ClaudeOAuthChatAnthropic } from "../claude-oauth-chat-model.js";
import { loadClaudeOAuthCredential } from "../credentials.js";

const HAS_CRED =
  !!process.env.CLAUDE_CODE_OAUTH_TOKEN ||
  !!process.env.ANTHROPIC_AUTH_TOKEN ||
  loadClaudeOAuthCredential() !== null;

describe.skipIf(!HAS_CRED)("ClaudeOAuthChatAnthropic integration", () => {
  it("round-trips a single message through the OAuth endpoint", async () => {
    const cred = loadClaudeOAuthCredential();
    if (!cred) throw new Error("precondition: credential should exist");
    const model = new ClaudeOAuthChatAnthropic({
      model: "claude-haiku-4-5",
      oauthToken: cred.accessToken,
      maxTokens: 64,
    });
    const response = await model.invoke([new HumanMessage("Reply with the single word: ok")]);
    expect(typeof response.content).toBe("string");
    expect((response.content as string).toLowerCase()).toContain("ok");
  }, 30_000);
});
