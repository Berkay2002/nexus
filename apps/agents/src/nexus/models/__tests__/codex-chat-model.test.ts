import { describe, expect, it } from "vitest";
import { CodexChatModel } from "../codex-chat-model.js";

describe("CodexChatModel constructor", () => {
  it("rejects retryMaxAttempts < 1", () => {
    expect(
      () =>
        new CodexChatModel({
          accessToken: "token",
          accountId: "acct",
          retryMaxAttempts: 0,
        }),
    ).toThrow(/retryMaxAttempts must be >= 1/);
  });

  it("throws when accessToken is missing", () => {
    expect(() => new CodexChatModel({ accountId: "acct" })).toThrow(
      /Codex CLI credential not found/,
    );
  });

  it("defaults model to gpt-5.4", () => {
    const model = new CodexChatModel({ accessToken: "tok", accountId: "acct" });
    expect(model.model).toBe("gpt-5.4");
  });

  it("defaults reasoningEffort to medium", () => {
    const model = new CodexChatModel({ accessToken: "tok", accountId: "acct" });
    expect(model.reasoningEffort).toBe("medium");
  });

  it("strips maxTokens field from fields record", () => {
    const model = new CodexChatModel({
      accessToken: "tok",
      accountId: "acct",
      // @ts-expect-error intentional — factory may pass this through
      maxTokens: 1234,
    });
    expect((model as unknown as { maxTokens?: number }).maxTokens).toBeUndefined();
  });
});
