import { StoreBackend } from "deepagents";

/**
 * Creates the Nexus StoreBackend for persistent memory storage.
 *
 * Uses the LangGraph execution context's store (injected via createDeepAgent({ store })).
 * Namespace is ["memories"] for memory-scoped isolation.
 */
export function createNexusStore(): StoreBackend {
  return new StoreBackend({
    namespace: ["nexus"],
  });
}

/**
 * Creates a StoreBackend for the /skills/ route.
 *
 * Skills are read-only content seeded at startup from SKILL.md files
 * bundled in the repo. Uses a separate ["nexus-skills"] namespace
 * to isolate from memory data.
 */
export function createSkillsStore(): StoreBackend {
  return new StoreBackend({
    namespace: ["nexus-skills"],
  });
}
