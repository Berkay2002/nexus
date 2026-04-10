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
 * `@langchain/google` reads GOOGLE_API_KEY; this lets users who copy
 * Vertex AI Express Mode docs (which use GEMINI_API_KEY) work unchanged.
 */
export function aliasApiKey(): void {
  if (!process.env.GOOGLE_API_KEY && process.env.GEMINI_API_KEY) {
    process.env.GOOGLE_API_KEY = process.env.GEMINI_API_KEY;
  }
}

/**
 * Detect which Google auth path is active.
 *
 * An explicit `GOOGLE_API_KEY` always wins: ChatGoogle auto-selects AI Studio
 * whenever an API key is present, so project/ADC env vars alongside it have
 * no effect. Otherwise, ADC (credentials file or `GOOGLE_CLOUD_PROJECT`)
 * selects Vertex AI.
 */
export function detectGoogleAuthMode(): GoogleAuthMode {
  if (process.env.GOOGLE_API_KEY) return "api-key";
  if (
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.GOOGLE_CLOUD_CREDENTIALS ||
    process.env.GOOGLE_CLOUD_PROJECT
  ) {
    return "vertex-adc";
  }
  return "none";
}

export function checkMissing(): string[] {
  const missing: string[] = [];
  if (detectGoogleAuthMode() === "none") {
    missing.push(
      "Google credentials (one of: Vertex AI [ADC via `gcloud auth application-default login` + GOOGLE_CLOUD_PROJECT], GOOGLE_API_KEY, or GEMINI_API_KEY)",
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
