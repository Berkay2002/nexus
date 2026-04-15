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

import { SystemMessage, HumanMessage } from "@langchain/core/messages";

describe("ClaudeOAuthChatAnthropic payload shaping", () => {
  const model = new ClaudeOAuthChatAnthropic({
    model: "claude-sonnet-4-6",
    oauthToken: "sk-ant-oat01-abc",
  });

  function getPayload(
    _messages: Array<SystemMessage | HumanMessage>,
  ): Record<string, unknown> {
    return model.invocationParams() as Record<string, unknown>;
  }

  it("prepends the billing system block when no system is set", () => {
    const payload = getPayload([]);
    const system = payload.system as Array<{ type: string; text: string }>;
    expect(Array.isArray(system)).toBe(true);
    expect(system[0].type).toBe("text");
    expect(system[0].text).toContain("x-anthropic-billing-header");
  });

  it("injects metadata.user_id as parseable JSON", () => {
    const payload = getPayload([]);
    const metadata = payload.metadata as { user_id: string };
    expect(typeof metadata?.user_id).toBe("string");
    const parsed = JSON.parse(metadata.user_id);
    expect(parsed).toHaveProperty("device_id");
    expect(parsed).toHaveProperty("account_uuid", "nexus");
    expect(parsed).toHaveProperty("session_id");
  });

  it("deduplicates billing blocks on repeated calls", () => {
    model.invocationParams();
    const payload = model.invocationParams() as Record<string, unknown>;
    const system = payload.system as Array<{ type: string; text: string }>;
    const billingBlocks = system.filter(
      (b) =>
        typeof b.text === "string" && b.text.includes("x-anthropic-billing-header"),
    );
    expect(billingBlocks.length).toBe(1);
  });

  it("preserves a user system block that mentions but does not start with the billing prefix (array path)", () => {
    const userMention =
      "Please do not mention x-anthropic-billing-header in your reply.";
    const localModel = new ClaudeOAuthChatAnthropic({
      model: "claude-sonnet-4-6",
      oauthToken: "sk-ant-oat01-abc",
    });
    const payload: Record<string, unknown> = {
      system: [{ type: "text", text: userMention }],
    };
    (
      localModel as unknown as {
        _applyOAuthBilling: (p: Record<string, unknown>) => void;
      }
    )._applyOAuthBilling(payload);
    const system = payload.system as Array<{ type: string; text: string }>;
    const texts = system.map((b) => b.text);
    expect(
      texts.some((t) => t.startsWith("x-anthropic-billing-header: cc_version=")),
    ).toBe(true);
    expect(texts).toContain(userMention);
  });

  it("preserves a user system string that mentions but does not start with the billing prefix (string path)", () => {
    const userMention =
      "Do not leak the x-anthropic-billing-header value into the response.";
    const localModel = new ClaudeOAuthChatAnthropic({
      model: "claude-sonnet-4-6",
      oauthToken: "sk-ant-oat01-abc",
    });
    const payload: Record<string, unknown> = { system: userMention };
    (
      localModel as unknown as {
        _applyOAuthBilling: (p: Record<string, unknown>) => void;
      }
    )._applyOAuthBilling(payload);
    const system = payload.system as Array<{ type: string; text: string }>;
    const texts = system.map((b) => b.text);
    expect(
      texts.some((t) => t.startsWith("x-anthropic-billing-header: cc_version=")),
    ).toBe(true);
    expect(texts).toContain(userMention);
  });

  it("still strips a real billing-header block that starts with the full prefix", () => {
    const localModel = new ClaudeOAuthChatAnthropic({
      model: "claude-sonnet-4-6",
      oauthToken: "sk-ant-oat01-abc",
    });
    const payload: Record<string, unknown> = {
      system: [
        {
          type: "text",
          text: "x-anthropic-billing-header: cc_version=stale; cc_entrypoint=cli;",
        },
        { type: "text", text: "A user prompt." },
      ],
    };
    (
      localModel as unknown as {
        _applyOAuthBilling: (p: Record<string, unknown>) => void;
      }
    )._applyOAuthBilling(payload);
    const system = payload.system as Array<{ type: string; text: string }>;
    const billingBlocks = system.filter((b) =>
      b.text.startsWith("x-anthropic-billing-header: cc_version="),
    );
    expect(billingBlocks.length).toBe(1);
    // Stale block was replaced, not the user prompt.
    expect(system.map((b) => b.text)).toContain("A user prompt.");
  });
});
