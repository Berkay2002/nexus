import { Annotation, MessagesAnnotation } from "@langchain/langgraph";

/**
 * Router classification result written by the meta-router node.
 * Read by the orchestrator node to select the correct model at runtime.
 */
export interface RouterResult {
  /** The Gemini model name to use for the orchestrator */
  model: string;
  /** Brief reasoning for the model selection */
  reasoning: string;
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
