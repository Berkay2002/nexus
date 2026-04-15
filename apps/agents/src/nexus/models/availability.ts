import { loadClaudeOAuthCredential, loadCodexCliCredential } from "./credentials.js";
import type { ProviderId } from "./types.js";

function hasEnv(name: string): boolean {
  const value = process.env[name];
  return typeof value === "string" && value.length > 0;
}

export function isGoogleAvailable(): boolean {
  return (
    hasEnv("GOOGLE_CLOUD_PROJECT") ||
    hasEnv("GOOGLE_API_KEY") ||
    hasEnv("GEMINI_API_KEY")
  );
}

export function isAnthropicAvailable(): boolean {
  return hasEnv("ANTHROPIC_API_KEY");
}

export function isOpenAIAvailable(): boolean {
  return hasEnv("OPENAI_API_KEY");
}

export function isZaiAvailable(): boolean {
  return hasEnv("ZAI_API_KEY");
}

export function isClaudeOAuthAvailable(): boolean {
  return loadClaudeOAuthCredential() !== null;
}

export function isCodexCliAvailable(): boolean {
  return loadCodexCliCredential() !== null;
}

export function isProviderAvailable(provider: ProviderId): boolean {
  switch (provider) {
    case "google":
      return isGoogleAvailable();
    case "anthropic":
      return isAnthropicAvailable();
    case "openai":
      return isOpenAIAvailable();
    case "zai":
      return isZaiAvailable();
    case "claude-oauth":
      return isClaudeOAuthAvailable();
    case "codex":
      return isCodexCliAvailable();
  }
}
