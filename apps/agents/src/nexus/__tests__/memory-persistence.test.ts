import { describe, it, expect } from "vitest";
import { Annotation, InMemoryStore, StateGraph } from "@langchain/langgraph";
import { createNexusBackend } from "../backend/composite.js";
import { AIOSandboxBackend } from "../backend/aio-sandbox.js";

/**
 * Verifies that the /memories/ → StoreBackend chain works across graph
 * invocations. The original failure mode was
 *
 *   StoreBackend.getStore() → getLangGraphStore() → undefined
 *   "Store is required but not available in LangGraph execution context.
 *    Ensure the graph was configured with a store."
 *
 * thrown from deepagents' memory middleware `beforeAgent` hook. This test
 * reproduces that exact code path — it compiles a graph with a BaseStore,
 * seeds /memories/AGENTS.md via the store (same namespace/shape that
 * StoreBackend.uploadFiles uses), then runs a node that routes a
 * `downloadFiles` call through the same `createNexusBackend` used by the
 * orchestrator. The composite backend must dispatch to StoreBackend,
 * StoreBackend must pick up the store from LangGraph runtime context, and
 * both invocations of the compiled graph must return the seeded content.
 *
 * No LLM is involved — the chain is what was broken, so the chain is what
 * gets asserted. No API credentials required.
 */
describe("Memory persistence across invocations", () => {
  it("loads /memories/AGENTS.md from the store on every invocation", async () => {
    const store = new InMemoryStore();
    const now = new Date().toISOString();
    const expected = "User prefers TypeScript for all code examples.";
    // CompositeBackend strips the "/memories/" prefix before dispatching,
    // so the StoreBackend sees the key "/AGENTS.md".
    await store.put(["nexus"], "/AGENTS.md", {
      content: expected,
      created_at: now,
      modified_at: now,
    });

    // Build a minimal graph whose single node downloads the memory file
    // through the same composite backend the orchestrator uses. The sandbox
    // URL is never contacted because /memories/ is routed to StoreBackend.
    const backend = createNexusBackend(
      new AIOSandboxBackend("http://localhost:8080"),
    );

    const State = Annotation.Root({
      content: Annotation<string | null>(),
    });

    const workflow = new StateGraph(State)
      .addNode("read-memory", async () => {
        const [response] = await backend.downloadFiles([
          "/memories/AGENTS.md",
        ]);
        if (response.error) {
          throw new Error(`downloadFiles failed: ${response.error}`);
        }
        const content =
          response.content == null
            ? null
            : new TextDecoder().decode(response.content);
        return { content };
      })
      .addEdge("__start__", "read-memory")
      .addEdge("read-memory", "__end__");

    const graph = workflow.compile({ store });

    const first = await graph.invoke({ content: null });
    expect(first.content).toContain(expected);

    const second = await graph.invoke({ content: null });
    expect(second.content).toContain(expected);
  });
});
