import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  aliasApiKey,
  detectGoogleAuthMode,
  checkMissing,
} from "../preflight.js";

const ENV_KEYS = [
  "GOOGLE_GENAI_USE_VERTEXAI",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "GOOGLE_CLOUD_CREDENTIALS",
  "GOOGLE_CLOUD_PROJECT",
  "GOOGLE_CLOUD_LOCATION",
  "GOOGLE_API_KEY",
  "GEMINI_API_KEY",
  "TAVILY_API_KEY",
] as const;

describe("preflight", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  describe("detectGoogleAuthMode", () => {
    it("returns vertex-adc when GOOGLE_APPLICATION_CREDENTIALS is set", () => {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = "/tmp/key.json";
      expect(detectGoogleAuthMode()).toBe("vertex-adc");
    });

    it("returns vertex-adc when only GOOGLE_CLOUD_PROJECT is set (ADC via gcloud)", () => {
      process.env.GOOGLE_CLOUD_PROJECT = "my-project";
      expect(detectGoogleAuthMode()).toBe("vertex-adc");
    });

    it("returns api-key when only GOOGLE_API_KEY is set", () => {
      process.env.GOOGLE_API_KEY = "key-abc";
      expect(detectGoogleAuthMode()).toBe("api-key");
    });

    it("returns api-key when only GEMINI_API_KEY is set (after aliasApiKey)", () => {
      process.env.GEMINI_API_KEY = "key-xyz";
      aliasApiKey();
      expect(detectGoogleAuthMode()).toBe("api-key");
      expect(process.env.GOOGLE_API_KEY).toBe("key-xyz");
    });

    it("returns none when nothing is set", () => {
      expect(detectGoogleAuthMode()).toBe("none");
    });

    it("prefers api-key when both GOOGLE_API_KEY and GOOGLE_CLOUD_PROJECT are set", () => {
      // ChatGoogle auto-selects AI Studio whenever an API key is present, so
      // explicit API key wins even if Vertex vars are also set.
      process.env.GOOGLE_API_KEY = "key-abc";
      process.env.GOOGLE_CLOUD_PROJECT = "my-project";
      expect(detectGoogleAuthMode()).toBe("api-key");
    });
  });

  describe("checkMissing", () => {
    it("returns empty for Vertex ADC + Tavily", () => {
      process.env.GOOGLE_CLOUD_PROJECT = "my-project";
      process.env.TAVILY_API_KEY = "tvly-x";
      expect(checkMissing()).toEqual([]);
    });

    it("returns empty for GOOGLE_API_KEY + Tavily", () => {
      process.env.GOOGLE_API_KEY = "k";
      process.env.TAVILY_API_KEY = "tvly-x";
      expect(checkMissing()).toEqual([]);
    });

    it("returns empty for GEMINI_API_KEY (aliased) + Tavily", () => {
      process.env.GEMINI_API_KEY = "k";
      process.env.TAVILY_API_KEY = "tvly-x";
      aliasApiKey();
      expect(checkMissing()).toEqual([]);
    });

    it("reports missing credentials when nothing is set", () => {
      const missing = checkMissing();
      expect(missing).toHaveLength(2);
      expect(missing[0]).toContain("Google credentials");
      expect(missing).toContain("TAVILY_API_KEY");
    });

    it("reports only TAVILY_API_KEY when Google auth present", () => {
      process.env.GOOGLE_API_KEY = "k";
      expect(checkMissing()).toEqual(["TAVILY_API_KEY"]);
    });
  });
});
