import { describe, expect, it } from "vitest";
import { ClaudeOAuthChatAnthropic } from "../claude-oauth-chat-model.js";
import { OAUTH_ANTHROPIC_BETAS } from "../credentials.js";

describe("ClaudeOAuthChatAnthropic", () => {
  it("constructs with an OAuth token without throwing", () => {
    const model = new ClaudeOAuthChatAnthropic({
      model: "claude-sonnet-4-6",
      oauthToken: "sk-ant-oat01-test",
    });
    expect(model).toBeInstanceOf(ClaudeOAuthChatAnthropic);
  });

  it("stores the OAuth token for later client construction", () => {
    const model = new ClaudeOAuthChatAnthropic({
      model: "claude-sonnet-4-6",
      oauthToken: "sk-ant-oat01-abc",
    });
    expect((model as unknown as { oauthToken: string }).oauthToken).toBe(
      "sk-ant-oat01-abc",
    );
  });

  it("exposes the required anthropic-beta header string", () => {
    expect(OAUTH_ANTHROPIC_BETAS).toContain("oauth-2025-04-20");
    expect(OAUTH_ANTHROPIC_BETAS).toContain("claude-code-20250219");
  });
});
