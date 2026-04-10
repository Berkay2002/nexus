import { describe, it, expect } from "vitest";
import { tavilyMap } from "../tools/map/tool.js";
import { TOOL_NAME, TOOL_DESCRIPTION } from "../tools/map/prompt.js";

describe("map prompt", () => {
  it("should export TOOL_NAME as tavily_map", () => {
    expect(TOOL_NAME).toBe("tavily_map");
  });

  it("should export a detailed TOOL_DESCRIPTION", () => {
    expect(TOOL_DESCRIPTION.length).toBeGreaterThan(50);
  });
});

describe("tavilyMap tool", () => {
  it("should be a LangChain tool with correct name", () => {
    expect(tavilyMap.name).toBe("tavily_map");
  });

  it("should have a description matching the prompt", () => {
    expect(tavilyMap.description).toBe(TOOL_DESCRIPTION);
  });

  it("should have a schema", () => {
    expect(tavilyMap.schema).toBeDefined();
  });
});
