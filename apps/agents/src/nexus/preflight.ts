export type GoogleAuthMode = "vertex-adc" | "api-key" | "none";

export class NexusConfigError extends Error {
  constructor(public readonly missing: string[]) {
    super(
      `Nexus is not configured. Missing: ${missing.join(", ")}. See .env.example.`,
    );
    this.name = "NexusConfigError";
  }
}

/**
 * Alias GEMINI_API_KEY → GOOGLE_API_KEY if only the former is set.
 * `@langchain/google-genai` reads GOOGLE_API_KEY; this lets users who copy
 * Vertex AI Express Mode docs (which use GEMINI_API_KEY) work unchanged.
 */
export function aliasApiKey(): void {
  if (!process.env.GOOGLE_API_KEY && process.env.GEMINI_API_KEY) {
    process.env.GOOGLE_API_KEY = process.env.GEMINI_API_KEY;
  }
}

export function detectGoogleAuthMode(): GoogleAuthMode {
  const vertex =
    process.env.GOOGLE_GENAI_USE_VERTEXAI === "true" &&
    !!process.env.GOOGLE_CLOUD_PROJECT;
  if (vertex) return "vertex-adc";
  if (process.env.GOOGLE_API_KEY) return "api-key";
  return "none";
}

export function checkMissing(): string[] {
  const missing: string[] = [];
  if (detectGoogleAuthMode() === "none") {
    missing.push(
      "Google credentials (one of: Vertex AI [GOOGLE_GENAI_USE_VERTEXAI=true + GOOGLE_CLOUD_PROJECT], GOOGLE_API_KEY, or GEMINI_API_KEY)",
    );
  }
  if (!process.env.TAVILY_API_KEY) missing.push("TAVILY_API_KEY");
  return missing;
}

export function logPreflight(): void {
  aliasApiKey();
  const mode = detectGoogleAuthMode();
  const missing = checkMissing();
  if (missing.length === 0) {
    console.log(`[nexus] preflight ok (google auth: ${mode})`);
    return;
  }
  console.warn(
    `[nexus] preflight warning: missing ${missing.join(", ")}. ` +
      `Server starts but requests will fail with a clear error. See .env.example.`,
  );
}
