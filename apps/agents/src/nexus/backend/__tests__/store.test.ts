import { describe, it, expect } from "vitest";
import { createNexusStore } from "../store.js";

describe("createNexusStore", () => {
  it("should create a StoreBackend with nexus namespace", () => {
    const backend = createNexusStore();
    expect(backend).toBeDefined();
  });
});
