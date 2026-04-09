import { StateGraph } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { NexusStateAnnotation } from "./state.js";

/**
 * Nexus graph — minimal skeleton for Plan 1.
 * Will be expanded in Plan 2 with meta-router and orchestrator.
 * For now, a simple Gemini Flash responder to prove the dev server boots.
 */

// Lazy initialization of model to avoid API key requirement at import time
let modelInstance: ChatGoogleGenerativeAI | null = null;

function getModel(): ChatGoogleGenerativeAI {
  if (!modelInstance) {
    modelInstance = new ChatGoogleGenerativeAI({
      model: "gemini-2.0-flash",
      temperature: 0,
    });
  }
  return modelInstance;
}

async function respond(
  state: typeof NexusStateAnnotation.State,
): Promise<Partial<typeof NexusStateAnnotation.State>> {
  const model = getModel();
  const response = await model.invoke(state.messages);
  return { messages: [response] };
}

const workflow = new StateGraph(NexusStateAnnotation)
  .addNode("respond", respond)
  .addEdge("__start__", "respond")
  .addEdge("respond", "__end__");

export const graph = workflow.compile();
