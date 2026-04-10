import { describe, it, expect, vi } from "vitest";

// Mock deepagents
vi.mock("deepagents", () => ({
  CompositeBackend: class {
    defaultBackend: unknown;
    routes: Record<string, unknown>;
    constructor(defaultBackend: unknown, routes: Record<string, unknown>) {
      this.defaultBackend = defaultBackend;
      this.routes = routes;
    }
  },
  StoreBackend: class {
    config: unknown;
    constructor(config?: unknown) {
      this.config = config;
    }
  },
  BaseSandbox: class {
    constructor() {}
  },
}));

vi.mock("@agent-infra/sandbox", () => ({
  SandboxClient: class {
    constructor() {}
  },
}));

const { createNexusBackend } = await import("../backend/composite.js");
const { AIOSandboxBackend } = await import("../backend/aio-sandbox.js");

describe("Skills backend route", () => {
  it("should include /skills/ route in CompositeBackend", () => {
    const sandbox = new AIOSandboxBackend();
    const backend = createNexusBackend(sandbox) as unknown as {
      routes: Record<string, unknown>;
    };
    expect(backend.routes).toHaveProperty("/skills/");
  });

  it("should include /memories/ route in CompositeBackend", () => {
    const sandbox = new AIOSandboxBackend();
    const backend = createNexusBackend(sandbox) as unknown as {
      routes: Record<string, unknown>;
    };
    expect(backend.routes).toHaveProperty("/memories/");
  });

  it("should have sandbox as default backend", () => {
    const sandbox = new AIOSandboxBackend();
    const backend = createNexusBackend(sandbox) as unknown as {
      defaultBackend: unknown;
    };
    expect(backend.defaultBackend).toBe(sandbox);
  });
});
