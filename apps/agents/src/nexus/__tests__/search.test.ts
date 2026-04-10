import { describe, it, expect } from "vitest";
import { tavilySearch } from "../tools/search/tool.js";
import { TOOL_NAME, TOOL_DESCRIPTION } from "../tools/search/prompt.js";

describe("search prompt", () => {
  it("should export TOOL_NAME as tavily_search", () => {
    expect(TOOL_NAME).toBe("tavily_search");
  });

  it("should export a detailed TOOL_DESCRIPTION", () => {
    expect(TOOL_DESCRIPTION.length).toBeGreaterThan(50);
  });
});

describe("tavilySearch tool", () => {
  it("should be a LangChain tool with correct name", () => {
    expect(tavilySearch.name).toBe("tavily_search");
  });

  it("should have a description matching the prompt", () => {
    expect(tavilySearch.description).toBe(TOOL_DESCRIPTION);
  });

  it("should have a schema", () => {
    expect(tavilySearch.schema).toBeDefined();
  });
});
