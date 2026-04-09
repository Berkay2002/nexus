import { StoreBackend } from "deepagents";

/**
 * Creates the Nexus StoreBackend for persistent memory storage.
 *
 * Uses the LangGraph execution context's store (injected via createDeepAgent({ store })).
 * Namespace is ["memories"] for memory-scoped isolation.
 */
export function createNexusStore(): StoreBackend {
  return new StoreBackend({
    namespace: ["memories"],
  });
}
