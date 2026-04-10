import { ChatGoogle } from "@langchain/google/node";

export type GoogleModelOptions = ConstructorParameters<typeof ChatGoogle>[0];

/**
 * Factory for Google Gemini chat models.
 *
 * ChatGoogle auto-detects the platform:
 *   - AI Studio when GOOGLE_API_KEY is set
 *   - Vertex AI when GOOGLE_APPLICATION_CREDENTIALS / ADC is present
 *
 * Use this factory everywhere in apps/agents instead of constructing
 * ChatGoogle directly, so env-driven mode selection stays in one place.
 */
export function createGoogleModel(
  modelName: string,
  options: Omit<GoogleModelOptions, "model"> = {},
): ChatGoogle {
  return new ChatGoogle({ model: modelName, ...options });
}
