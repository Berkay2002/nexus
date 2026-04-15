import { ChatAnthropic, type ChatAnthropicInput } from "@langchain/anthropic";
import Anthropic from "@anthropic-ai/sdk";
import { createHash, randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { OAUTH_ANTHROPIC_BETAS } from "./credentials.js";

// Module-level identity constants. Sharing these across every
// `ClaudeOAuthChatAnthropic` instance in a single Nexus process means
// Anthropic sees one long session per process lifetime instead of a fresh
// session for every model rebuild (which can happen on configurable-model
// reselection). Keeping the values in module scope ties them to the process,
// which is exactly what Claude Code's native CLI does.
const NEXUS_SESSION_ID = randomUUID();
const NEXUS_DEVICE_ID = createHash("sha256")
  .update(`nexus-${hostname()}`)
  .digest("hex");

/**
 * Full sentinel prefix for the Anthropic OAuth billing system-block. We match
 * this exact prefix when deduping so that a user system prompt that merely
 * *mentions* `x-anthropic-billing-header` (e.g. in documentation or an
 * injection-defense description) is NOT accidentally stripped.
 */
const BILLING_HEADER_PREFIX = "x-anthropic-billing-header: cc_version=";

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
      // ChatAnthropic validates a non-empty apiKey at construct time (before
      // createClient ever runs), so we supply a placeholder to satisfy the
      // check. The real credential is attached below via createClient, which
      // constructs the underlying Anthropic SDK client with `authToken` set
      // and `apiKey: null`. DO NOT remove this placeholder — ChatAnthropic's
      // constructor will throw without it and OAuth will break.
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
            ((b as { text: string }).text as string).startsWith(
              BILLING_HEADER_PREFIX,
            )
          ),
      );
      payload.system = [billingBlock, ...filtered];
    } else if (typeof system === "string") {
      if (system.startsWith(BILLING_HEADER_PREFIX)) {
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
        device_id: NEXUS_DEVICE_ID,
        account_uuid: "nexus",
        session_id: NEXUS_SESSION_ID,
      }),
    };
  }
}
