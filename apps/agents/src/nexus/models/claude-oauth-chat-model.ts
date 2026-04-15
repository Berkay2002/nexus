import { ChatAnthropic, type ChatAnthropicInput } from "@langchain/anthropic";
import Anthropic from "@anthropic-ai/sdk";
import { createHash, randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { OAUTH_ANTHROPIC_BETAS } from "./credentials.js";

export interface ClaudeOAuthChatAnthropicFields
  extends Omit<ChatAnthropicInput, "apiKey" | "anthropicApiKey"> {
  oauthToken: string;
}

export class ClaudeOAuthChatAnthropic extends ChatAnthropic {
  readonly oauthToken: string;

  constructor(fields: ClaudeOAuthChatAnthropicFields) {
    if (!fields.oauthToken) {
      throw new Error(
        "ClaudeOAuthChatAnthropic requires a non-empty oauthToken",
      );
    }

    const oauthToken = fields.oauthToken;

    super({
      ...fields,
      apiKey: "oauth-placeholder",
      clientOptions: {
        ...(fields.clientOptions ?? {}),
        defaultHeaders: {
          ...(fields.clientOptions?.defaultHeaders ?? {}),
          "anthropic-beta": OAUTH_ANTHROPIC_BETAS,
        },
      },
      createClient: (options) =>
        new Anthropic({
          ...options,
          apiKey: null,
          authToken: oauthToken,
        }),
    } as ChatAnthropicInput);

    this.oauthToken = oauthToken;
  }

  private static readonly DEFAULT_BILLING_HEADER =
    "x-anthropic-billing-header: cc_version=2.1.85.351; cc_entrypoint=cli; cch=6c6d5;";

  private _sessionId = randomUUID();
  private _deviceId = createHash("sha256")
    .update(`nexus-${hostname()}`)
    .digest("hex");

  private get billingHeader(): string {
    return (
      process.env.ANTHROPIC_BILLING_HEADER ??
      ClaudeOAuthChatAnthropic.DEFAULT_BILLING_HEADER
    );
  }

  override invocationParams(
    options?: this["ParsedCallOptions"],
  ): ReturnType<ChatAnthropic["invocationParams"]> {
    const params = super.invocationParams(options) as Record<string, unknown>;
    this._applyOAuthBilling(params);
    this._applyOAuthMetadata(params);
    return params as ReturnType<ChatAnthropic["invocationParams"]>;
  }

  private _applyOAuthBilling(payload: Record<string, unknown>): void {
    const billingBlock = { type: "text" as const, text: this.billingHeader };
    const system = payload.system;

    if (Array.isArray(system)) {
      const filtered = system.filter(
        (b) =>
          !(
            b &&
            typeof b === "object" &&
            typeof (b as { text?: unknown }).text === "string" &&
            ((b as { text: string }).text as string).includes(
              "x-anthropic-billing-header",
            )
          ),
      );
      payload.system = [billingBlock, ...filtered];
    } else if (typeof system === "string") {
      if (system.includes("x-anthropic-billing-header")) {
        payload.system = [billingBlock];
      } else {
        payload.system = [billingBlock, { type: "text" as const, text: system }];
      }
    } else {
      payload.system = [billingBlock];
    }
  }

  private _applyOAuthMetadata(payload: Record<string, unknown>): void {
    const existing =
      (payload.metadata as Record<string, unknown> | undefined) ?? {};
    if (typeof existing.user_id === "string") {
      payload.metadata = existing;
      return;
    }
    payload.metadata = {
      ...existing,
      user_id: JSON.stringify({
        device_id: this._deviceId,
        account_uuid: "nexus",
        session_id: this._sessionId,
      }),
    };
  }
}
