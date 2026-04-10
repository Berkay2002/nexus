import { describe, it, expect } from "vitest";
import {
  CREATIVE_AGENT_NAME,
  CREATIVE_AGENT_DESCRIPTION,
  CREATIVE_SYSTEM_PROMPT,
} from "../agents/creative/prompt.js";
import { creativeAgent } from "../agents/creative/agent.js";

describe("Creative Agent prompt", () => {
  it("should export CREATIVE_AGENT_NAME as 'creative'", () => {
    expect(CREATIVE_AGENT_NAME).toBe("creative");
  });

  it("should export a non-empty CREATIVE_AGENT_DESCRIPTION", () => {
    expect(CREATIVE_AGENT_DESCRIPTION.length).toBeGreaterThan(20);
  });

  it("should export a non-empty CREATIVE_SYSTEM_PROMPT", () => {
    expect(CREATIVE_SYSTEM_PROMPT.length).toBeGreaterThan(100);
  });

  it("should include workspace path in system prompt", () => {
    expect(CREATIVE_SYSTEM_PROMPT).toContain("/home/gem/workspace/creative/");
  });

  it("should instruct concise summaries in system prompt", () => {
    expect(CREATIVE_SYSTEM_PROMPT).toContain("500");
  });
});

describe("Creative Agent config", () => {
  it("should have name matching CREATIVE_AGENT_NAME", () => {
    expect(creativeAgent.name).toBe("creative");
  });

  it("should have a description", () => {
    expect(creativeAgent.description).toBeTruthy();
  });

  it("should have a systemPrompt", () => {
    expect(creativeAgent.systemPrompt).toBeTruthy();
  });

  it("should have exactly 1 tool (generate_image)", () => {
    expect(creativeAgent.tools).toHaveLength(1);
    expect(creativeAgent.tools![0].name).toBe("generate_image");
  });

  it("should use gemini-3.1-flash-image-preview model", () => {
    expect(creativeAgent.model).toBe("google-genai:gemini-3.1-flash-image-preview");
  });
});
