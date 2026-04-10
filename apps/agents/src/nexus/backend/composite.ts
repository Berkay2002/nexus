import { CompositeBackend } from "deepagents";
import { AIOSandboxBackend } from "./aio-sandbox.js";
import { createNexusStore, createSkillsStore } from "./store.js";

/**
 * Creates the Nexus CompositeBackend:
 *
 * - Default route (/) → AIOSandboxBackend (ephemeral workspace in Docker)
 * - /memories/ route → StoreBackend (SQLite-persisted memory)
 * - /skills/ route → StoreBackend (skill files seeded from repo)
 *
 * The sandbox as default route means the agent gets the `execute` tool
 * auto-provisioned (BaseSandbox implements SandboxBackendProtocolV2).
 */
export function createNexusBackend(
  sandbox: AIOSandboxBackend,
): CompositeBackend {
  return new CompositeBackend(sandbox, {
    "/memories/": createNexusStore(),
    "/skills/": createSkillsStore(),
  });
}
