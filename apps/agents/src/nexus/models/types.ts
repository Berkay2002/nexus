export type Tier =
  | "classifier"
  | "default"
  | "code"
  | "deep-research"
  | "image";

export type ProviderId =
  | "google"
  | "anthropic"
  | "openai"
  | "zai"
  | "claude-oauth"
  | "codex";

export interface ModelDescriptor {
  provider: ProviderId;
  /** Raw model ID passed to the provider SDK. */
  id: string;
  /** UI-facing human label (e.g. "Claude Sonnet 4.6"). */
  label: string;
  /** Abstract tiers this model is allowed to fill. */
  tiers: Tier[];
  capabilities: {
    tools: boolean;
    images: boolean;
  };
}
