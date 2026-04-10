import { describe, it, expect } from "vitest";
import {
  tavilySearch,
  tavilyExtract,
  tavilyMap,
  generateImage,
  researchTools,
  creativeTools,
  allTools,
} from "../tools/index.js";

describe("tools barrel export", () => {
  it("should export all 4 individual tools", () => {
    expect(tavilySearch).toBeDefined();
    expect(tavilyExtract).toBeDefined();
    expect(tavilyMap).toBeDefined();
    expect(generateImage).toBeDefined();
  });

  it("should export researchTools array with 3 Tavily tools", () => {
    expect(researchTools).toHaveLength(3);
    expect(researchTools.map((t) => t.name)).toEqual([
      "tavily_search",
      "tavily_extract",
      "tavily_map",
    ]);
  });

  it("should export creativeTools array with generate_image", () => {
    expect(creativeTools).toHaveLength(1);
    expect(creativeTools[0].name).toBe("generate_image");
  });

  it("should export allTools array with all 4 tools", () => {
    expect(allTools).toHaveLength(4);
  });
});
