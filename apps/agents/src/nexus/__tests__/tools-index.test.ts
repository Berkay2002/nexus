import { describe, it, expect } from "vitest";
import {
  tavilySearch,
  tavilyExtract,
  tavilyMap,
  generateImage,
  sandboxCodeExecute,
  sandboxJupyterCreateSession,
  sandboxJupyterExecute,
  researchTools,
  creativeTools,
  codeTools,
  allTools,
} from "../tools/index.js";

describe("tools barrel export", () => {
  it("should export all individual tools", () => {
    expect(tavilySearch).toBeDefined();
    expect(tavilyExtract).toBeDefined();
    expect(tavilyMap).toBeDefined();
    expect(generateImage).toBeDefined();
    expect(sandboxCodeExecute).toBeDefined();
    expect(sandboxJupyterCreateSession).toBeDefined();
    expect(sandboxJupyterExecute).toBeDefined();
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

  it("should export codeTools array with sandbox runtime tools", () => {
    expect(codeTools).toHaveLength(3);
    expect(codeTools.map((t) => t.name)).toEqual([
      "sandbox_code_execute",
      "sandbox_jupyter_create_session",
      "sandbox_jupyter_execute",
    ]);
  });

  it("should export allTools array with all tools", () => {
    expect(allTools).toHaveLength(7);
  });
});
