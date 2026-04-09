import { Annotation, MessagesAnnotation } from "@langchain/langgraph";

/**
 * Nexus graph state.
 * Extends MessagesAnnotation (provides `messages` with reducer).
 * Additional fields added in Plan 2 (meta-router output, model selection).
 */
export const NexusStateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
});

export type NexusState = typeof NexusStateAnnotation.State;
