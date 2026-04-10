import { describe, it, expect } from "vitest";
import {
  RESEARCH_AGENT_NAME,
  RESEARCH_AGENT_DESCRIPTION,
  RESEARCH_SYSTEM_PROMPT,
} from "../agents/research/prompt.js";
import { researchAgent } from "../agents/research/agent.js";

describe("Research Agent prompt", () => {
  it("should export RESEARCH_AGENT_NAME as 'research'", () => {
    expect(RESEARCH_AGENT_NAME).toBe("research");
  });

  it("should export a non-empty RESEARCH_AGENT_DESCRIPTION", () => {
    expect(RESEARCH_AGENT_DESCRIPTION.length).toBeGreaterThan(20);
  });

  it("should export a non-empty RESEARCH_SYSTEM_PROMPT", () => {
    expect(RESEARCH_SYSTEM_PROMPT.length).toBeGreaterThan(100);
  });

  it("should include workspace path in system prompt", () => {
    expect(RESEARCH_SYSTEM_PROMPT).toContain("/home/gem/workspace/research/");
  });

  it("should instruct concise summaries in system prompt", () => {
    expect(RESEARCH_SYSTEM_PROMPT).toContain("500");
  });
});

describe("Research Agent config", () => {
  it("should have name matching RESEARCH_AGENT_NAME", () => {
    expect(researchAgent.name).toBe("research");
  });

  it("should have a description", () => {
    expect(researchAgent.description).toBeTruthy();
  });

  it("should have a systemPrompt", () => {
    expect(researchAgent.systemPrompt).toBeTruthy();
  });

  it("should have exactly 3 tools (tavily_search, tavily_extract, tavily_map)", () => {
    expect(researchAgent.tools).toHaveLength(3);
    const toolNames = researchAgent.tools!.map((t) => t.name);
    expect(toolNames).toContain("tavily_search");
    expect(toolNames).toContain("tavily_extract");
    expect(toolNames).toContain("tavily_map");
  });

  it("should use gemini-3.1-pro-preview model", () => {
    expect(researchAgent.model).toBe("google-genai:gemini-3.1-pro-preview");
  });
});
