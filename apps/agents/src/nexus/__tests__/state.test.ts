import { describe, it, expect } from "vitest";
import { NexusStateAnnotation } from "../state.js";

describe("NexusStateAnnotation", () => {
  it("should include messages field from MessagesAnnotation", () => {
    const spec = NexusStateAnnotation.spec;
    expect(spec).toHaveProperty("messages");
  });

  it("should include routerResult field", () => {
    const spec = NexusStateAnnotation.spec;
    expect(spec).toHaveProperty("routerResult");
  });
});
