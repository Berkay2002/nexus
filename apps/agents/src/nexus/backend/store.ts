import { StoreBackend } from "deepagents";

/**
 * Creates a StoreBackend for persistent memory storage.
 *
 * Routes: /memories/ in the CompositeBackend
 * Namespace: ["nexus"] — single-user, agent-scoped
 *
 * The actual BaseStore instance is passed at the createDeepAgent() level
 * via the `store` parameter — StoreBackend reads from it automatically.
 */
export function createNexusStore(): StoreBackend {
  return new StoreBackend({
    namespace: ["nexus"],
  });
}
