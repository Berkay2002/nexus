import { describe, it, expect } from "vitest";
import { createNexusBackend } from "../composite.js";
import { AIOSandboxBackend } from "../aio-sandbox.js";

describe("createNexusBackend", () => {
  it("should create a CompositeBackend with sandbox default and store for memories", () => {
    const sandbox = new AIOSandboxBackend("http://localhost:8080");
    const backend = createNexusBackend(sandbox);
    expect(backend).toBeDefined();
  });
});
