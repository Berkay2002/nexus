import { ChatAnthropic, type ChatAnthropicInput } from "@langchain/anthropic";
import Anthropic from "@anthropic-ai/sdk";
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
}
