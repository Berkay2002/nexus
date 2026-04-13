import { describe, it, expect } from "vitest";
import {
  generateImage,
  resolveGenerateImageOutputPath,
} from "../tools/generate-image/tool.js";
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

  it("should remap legacy workspace path using thread_id", () => {
    const outputPath = resolveGenerateImageOutputPath(
      "/home/gem/workspace/creative/task_1/cover.png",
      { configurable: { thread_id: "019d87ff-278c-7bbc-a895-0b29d9ebc908" } },
    );
    expect(outputPath).toBe(
      "/home/gem/workspace/threads/019d87ff-278c-7bbc-a895-0b29d9ebc908/creative/task_1/cover.png",
    );
  });

  it("should keep already-threaded workspace path unchanged", () => {
    const path =
      "/home/gem/workspace/threads/019d87ff-278c-7bbc-a895-0b29d9ebc908/creative/task_1/cover.png";
    const outputPath = resolveGenerateImageOutputPath(path, {
      configurable: { thread_id: "019d87ff-278c-7bbc-a895-0b29d9ebc908" },
    });
    expect(outputPath).toBe(path);
  });
});
