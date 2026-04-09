import { describe, it, expect } from "vitest";

describe("Nexus Graph", () => {
  it("should export a compiled graph", async () => {
    const { graph } = await import("../graph.js");
    expect(graph).toBeDefined();
    // Compiled graphs have nodes and channels
    expect(graph.nodes).toBeDefined();
    expect(graph.channels).toBeDefined();
  });

  it("should have a respond node", async () => {
    const { graph } = await import("../graph.js");
    // LangGraph compiled graphs expose nodes as an object with node names as keys
    expect(graph.nodes).toBeDefined();
    expect(typeof graph.nodes).toBe("object");
    expect("respond" in graph.nodes).toBe(true);
  });
});
