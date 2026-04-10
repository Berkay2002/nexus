// apps/agents/src/nexus/__tests__/code-agent.test.ts
import { describe, it, expect } from "vitest";
import {
  CODE_AGENT_NAME,
  CODE_AGENT_DESCRIPTION,
  CODE_SYSTEM_PROMPT,
} from "../agents/code/prompt.js";
import { codeAgent } from "../agents/code/agent.js";

describe("Code Agent prompt", () => {
  it("should export CODE_AGENT_NAME as 'code'", () => {
    expect(CODE_AGENT_NAME).toBe("code");
  });

  it("should export a non-empty CODE_AGENT_DESCRIPTION", () => {
    expect(CODE_AGENT_DESCRIPTION.length).toBeGreaterThan(20);
  });

  it("should export a non-empty CODE_SYSTEM_PROMPT", () => {
    expect(CODE_SYSTEM_PROMPT.length).toBeGreaterThan(100);
  });

  it("should include workspace path in system prompt", () => {
    expect(CODE_SYSTEM_PROMPT).toContain("/home/gem/workspace/code/");
  });

  it("should mention execute tool in system prompt", () => {
    expect(CODE_SYSTEM_PROMPT).toContain("execute");
  });

  it("should instruct concise summaries in system prompt", () => {
    expect(CODE_SYSTEM_PROMPT).toContain("500");
  });
});

describe("Code Agent config", () => {
  it("should have name matching CODE_AGENT_NAME", () => {
    expect(codeAgent.name).toBe("code");
  });

  it("should have a description", () => {
    expect(codeAgent.description).toBeTruthy();
  });

  it("should have a systemPrompt", () => {
    expect(codeAgent.systemPrompt).toBeTruthy();
  });

  it("should have no custom tools (uses auto-provisioned execute + filesystem)", () => {
    expect(codeAgent.tools).toBeUndefined();
  });

  it("should use gemini-3.1-pro-preview model", () => {
    expect(codeAgent.model).toBe("google-genai:gemini-3.1-pro-preview");
  });
});
