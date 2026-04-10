import { describe, it, expect } from "vitest";
import { graph } from "../graph.js";

describe("Nexus graph", () => {
  it("should be a compiled graph", () => {
    expect(graph).toBeDefined();
    // Compiled graphs have invoke and stream methods
    expect(typeof graph.invoke).toBe("function");
    expect(typeof graph.stream).toBe("function");
  });

  it("should have metaRouter and orchestrator nodes", () => {
    // CompiledGraph exposes nodes via getGraph()
    // getGraph().nodes is a plain object keyed by node ID
    const graphDef = graph.getGraph();
    const nodeIds = Object.keys(graphDef.nodes);
    expect(nodeIds).toContain("metaRouter");
    expect(nodeIds).toContain("orchestrator");
  });
});
