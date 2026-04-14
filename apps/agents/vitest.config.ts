import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["src/nexus/__tests__/setup-fs-mock.ts"],
    include: ["src/**/__tests__/**/*.test.ts"],
    testTimeout: 30000,
  },
});
