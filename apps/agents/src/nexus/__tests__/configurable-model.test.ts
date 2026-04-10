import { describe, it, expect } from "vitest";
import {
  configurableModelMiddleware,
  modelContextSchema,
} from "../middleware/configurable-model.js";
import { z } from "zod/v4";

describe("modelContextSchema", () => {
  it("should accept a valid model string", () => {
    const result = z.safeParse(modelContextSchema, {
      model: "gemini-3-flash-preview",
    });
    expect(result.success).toBe(true);
  });

  it("should accept context without model (optional)", () => {
    const result = z.safeParse(modelContextSchema, {});
    expect(result.success).toBe(true);
  });
});

describe("configurableModelMiddleware", () => {
  it("should be an AgentMiddleware object", () => {
    expect(configurableModelMiddleware).toBeDefined();
    expect(typeof configurableModelMiddleware).toBe("object");
  });
});
