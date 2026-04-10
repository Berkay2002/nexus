import { StateGraph } from "@langchain/langgraph";
import { NexusStateAnnotation } from "./state.js";
import { metaRouter } from "./meta-router.js";
import { orchestratorNode } from "./orchestrator.js";
import { logPreflight } from "./preflight.js";

logPreflight();

/**
 * Nexus main graph.
 *
 * Pipeline: __start__ → metaRouter → orchestrator → __end__
 *
 * 1. metaRouter: Fast Flash classifier that selects the orchestrator model
 * 2. orchestrator: DeepAgent that plans, delegates, and synthesizes
 *
 * The meta-router writes routerResult to state. The orchestrator node
 * reads it and passes it as context to the ConfigurableModel middleware.
 */
const workflow = new StateGraph(NexusStateAnnotation)
  .addNode("metaRouter", metaRouter)
  .addNode("orchestrator", orchestratorNode)
  .addEdge("__start__", "metaRouter")
  .addEdge("metaRouter", "orchestrator")
  .addEdge("orchestrator", "__end__");

export const graph = workflow.compile();
