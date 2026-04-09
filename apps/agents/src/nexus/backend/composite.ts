import { CompositeBackend } from "deepagents";
import { AIOSandboxBackend } from "./aio-sandbox.js";
import { createNexusStore } from "./store.js";

/**
 * Creates the Nexus CompositeBackend:
 *
 * - Default route (/) → AIOSandboxBackend (ephemeral workspace in Docker)
 * - /memories/ route → StoreBackend (SQLite-persisted memory)
 *
 * The sandbox as default route means the agent gets the `execute` tool
 * auto-provisioned (BaseSandbox implements SandboxBackendProtocolV2).
 *
 * Note: The actual BaseStore for StoreBackend is passed via createDeepAgent({ store }).
 */
export function createNexusBackend(
  sandbox: AIOSandboxBackend
): CompositeBackend {
  return new CompositeBackend(sandbox, {
    "/memories/": createNexusStore(),
  });
}
