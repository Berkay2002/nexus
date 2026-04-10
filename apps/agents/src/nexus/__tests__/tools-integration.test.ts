// apps/agents/src/nexus/__tests__/tools-integration.test.ts
import { describe, it, expect } from "vitest";
import { tavilySearch } from "../tools/search/tool.js";
import { tavilyExtract } from "../tools/extract/tool.js";
import { tavilyMap } from "../tools/map/tool.js";

/**
 * Integration tests that hit the real Tavily API.
 * Requires TAVILY_API_KEY environment variable.
 * Skip with: npx vitest run --exclude "**\/integration*" --exclude "**\/tools-integration*"
 */
describe("Tavily Tools Integration", () => {
  it("tavily_search should return results for a query", async () => {
    const result = await tavilySearch.invoke({
      query: "What is TypeScript?",
      max_results: 3,
    });

    const parsed = JSON.parse(result);
    expect(parsed.results).toBeDefined();
    expect(parsed.results.length).toBeGreaterThan(0);
    expect(parsed.results[0]).toHaveProperty("title");
    expect(parsed.results[0]).toHaveProperty("url");
    expect(parsed.results[0]).toHaveProperty("content");
  }, 30000);

  it("tavily_extract should extract content from a URL", async () => {
    const result = await tavilyExtract.invoke({
      urls: "https://en.wikipedia.org/wiki/TypeScript",
    });

    const parsed = JSON.parse(result);
    expect(parsed.results).toBeDefined();
    expect(parsed.results.length).toBeGreaterThan(0);
    expect(parsed.results[0]).toHaveProperty("url");
    expect(parsed.results[0]).toHaveProperty("raw_content");
  }, 30000);

  it("tavily_map should return URLs from a site", async () => {
    const result = await tavilyMap.invoke({
      url: "https://docs.tavily.com",
      max_depth: 1,
      limit: 10,
    });

    const parsed = JSON.parse(result);
    expect(parsed.results).toBeDefined();
    expect(parsed.results.length).toBeGreaterThan(0);
    expect(parsed).toHaveProperty("base_url");
  }, 30000);
});
