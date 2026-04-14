import { Annotation, MessagesAnnotation } from "@langchain/langgraph";

/**
 * Router classification result written by the meta-router node.
 * Read by the orchestrator node to select the correct model at runtime.
 *
 * Abstract complexity label — the orchestrator node translates it into a
 * concrete provider model via the tier-based model registry.
 */
export interface RouterResult {
  /** Abstract complexity label — "trivial" routes to the classifier tier, "default" to the default tier */
  complexity: "trivial" | "default";
  /** Brief reasoning for the classification */
  reasoning: string;
  /**
   * Concrete model reference chosen for the orchestrator (e.g. "zai:glm-4.7").
   * Optional for backwards compatibility with earlier router payloads.
   */
  selectedModel?: string;
  /**
   * Backend-selected concrete model refs by role (e.g. "research" ->
   * "openai:gpt-5.4"). Used by the frontend to render accurate per-subagent
   * badges without guessing from local env.
   */
  selectedModels?: Partial<
    Record<
      "orchestrator" | "research" | "code" | "creative" | "general-purpose",
      string
    >
  >;
}

/**
 * Nexus graph state.
 * - messages: conversation history (from MessagesAnnotation, with reducer)
 * - routerResult: meta-router's model classification (overwritten each turn)
 */
export const NexusStateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  routerResult: Annotation<RouterResult | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
});

export type NexusState = typeof NexusStateAnnotation.State;
