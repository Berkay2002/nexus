import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  RESEARCH_AGENT_NAME,
  RESEARCH_AGENT_DESCRIPTION,
  RESEARCH_SYSTEM_PROMPT,
} from "../agents/research/prompt.js";
import { createResearchAgent } from "../agents/research/agent.js";

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

describe("Research Agent factory", () => {
  const envKeys = [
    "GOOGLE_CLOUD_PROJECT",
    "GOOGLE_API_KEY",
    "GEMINI_API_KEY",
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
  ];
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of envKeys) saved[key] = process.env[key];
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("should return null when no provider is available", () => {
    for (const key of envKeys) delete process.env[key];
    expect(createResearchAgent()).toBeNull();
  });

  it("should return a SubAgent with research tools when google is available", () => {
    for (const key of envKeys) delete process.env[key];
    process.env.GOOGLE_API_KEY = "test-key";
    const agent = createResearchAgent();
    expect(agent).not.toBeNull();
    expect(agent!.name).toBe("research");
    expect(agent!.tools).toHaveLength(10);
    const toolNames = agent!.tools!.map((t) => t.name);
    expect(toolNames).toContain("tavily_search");
    expect(toolNames).toContain("tavily_extract");
    expect(toolNames).toContain("tavily_map");
    expect(toolNames).toContain("sandbox_util_convert_to_markdown");
    expect(toolNames).toContain("sandbox_browser_info");
    expect(toolNames).toContain("sandbox_browser_screenshot");
    expect(toolNames).toContain("sandbox_browser_action");
    expect(toolNames).toContain("sandbox_browser_config");
    expect(toolNames).toContain("sandbox_nodejs_execute");
    expect(toolNames).toContain("mcp_tool_search");
    expect(agent!.model).toBeDefined();
  });
});
