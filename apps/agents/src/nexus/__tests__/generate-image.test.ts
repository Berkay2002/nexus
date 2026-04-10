import { describe, it, expect } from "vitest";
import { generateImage } from "../tools/generate-image/tool.js";
import { TOOL_NAME, TOOL_DESCRIPTION } from "../tools/generate-image/prompt.js";

describe("generate-image prompt", () => {
  it("should export TOOL_NAME as generate_image", () => {
    expect(TOOL_NAME).toBe("generate_image");
  });

  it("should export a detailed TOOL_DESCRIPTION", () => {
    expect(TOOL_DESCRIPTION.length).toBeGreaterThan(50);
  });
});

describe("generateImage tool", () => {
  it("should be a LangChain tool with correct name", () => {
    expect(generateImage.name).toBe("generate_image");
  });

  it("should have a description matching the prompt", () => {
    expect(generateImage.description).toBe(TOOL_DESCRIPTION);
  });

  it("should have a schema", () => {
    expect(generateImage.schema).toBeDefined();
  });
});
