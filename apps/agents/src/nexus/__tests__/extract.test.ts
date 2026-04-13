import { describe, it, expect } from "vitest";
import {
  tavilyExtract,
  tavilyExtractSchema,
  normalizeChunksPerSource,
} from "../tools/extract/tool.js";
import { TOOL_NAME, TOOL_DESCRIPTION } from "../tools/extract/prompt.js";

describe("extract prompt", () => {
  it("should export TOOL_NAME as tavily_extract", () => {
    expect(TOOL_NAME).toBe("tavily_extract");
  });

  it("should export a detailed TOOL_DESCRIPTION", () => {
    expect(TOOL_DESCRIPTION.length).toBeGreaterThan(50);
  });
});

describe("tavilyExtract tool", () => {
  it("should be a LangChain tool with correct name", () => {
    expect(tavilyExtract.name).toBe("tavily_extract");
  });

  it("should have a description matching the prompt", () => {
    expect(tavilyExtract.description).toBe(TOOL_DESCRIPTION);
  });

  it("should have a schema", () => {
    expect(tavilyExtract.schema).toBeDefined();
  });

  it("should allow integer chunks_per_source in schema", () => {
    const parsed = tavilyExtractSchema.parse({
      urls: "https://example.com",
      query: "test",
      chunks_per_source: 10,
    });

    expect(parsed.chunks_per_source).toBe(10);
  });

  it("should clamp chunks_per_source to the supported range at runtime", () => {
    expect(normalizeChunksPerSource(10)).toBe(5);
    expect(normalizeChunksPerSource(-2)).toBe(1);
    expect(normalizeChunksPerSource(4.9)).toBe(4);
  });

  it("should default chunks_per_source to 3 when runtime input is invalid", () => {
    expect(normalizeChunksPerSource(undefined)).toBe(3);
    expect(normalizeChunksPerSource(Number.NaN)).toBe(3);
  });
});
