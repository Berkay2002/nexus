import { createDeepAgent } from "deepagents";
import { AIOSandboxBackend } from "./backend/aio-sandbox.js";
import { createNexusBackend } from "./backend/composite.js";
import { configurableModelMiddleware } from "./middleware/configurable-model.js";
import { ORCHESTRATOR_SYSTEM_PROMPT } from "./prompts/orchestrator-system.js";
import { nexusSubagents } from "./agents/index.js";
import type { NexusState } from "./state.js";

/**
 * Creates the Nexus orchestrator DeepAgent.
 *
 * The orchestrator is the central brain — it receives user prompts,
 * plans work via write_todos, and delegates to specialized sub-agents
 * (research, code, creative, general-purpose).
 *
 * Model is selected at runtime via ConfigurableModel middleware,
 * based on the meta-router's classification in graph state.
 *
 * @param sandboxUrl - URL of the AIO Sandbox Docker container (default: http://localhost:8080)
 */
export function createNexusOrchestrator(sandboxUrl = "http://localhost:8080") {
  const sandbox = new AIOSandboxBackend(sandboxUrl);
  const backend = createNexusBackend(sandbox);

  return createDeepAgent({
    name: "nexus-orchestrator",
    model: "google-genai:gemini-3-flash-preview",
    systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT,
    middleware: [configurableModelMiddleware] as const,
    backend,
    memory: ["/memories/AGENTS.md"],
    skills: ["/skills/"],
    subagents: [...nexusSubagents],
  });
}

// Lazy singleton — initialized on first invocation
let orchestratorInstance: ReturnType<typeof createNexusOrchestrator> | null =
  null;

function getOrchestrator() {
  if (!orchestratorInstance) {
    orchestratorInstance = createNexusOrchestrator();
  }
  return orchestratorInstance;
}

/**
 * LangGraph node wrapper for the orchestrator.
 *
 * Reads routerResult from graph state and passes the selected model
 * as runtime context to the DeepAgent. This is the bridge between
 * the meta-router's classification and the ConfigurableModel middleware.
 */
export async function orchestratorNode(
  state: NexusState,
): Promise<Partial<NexusState>> {
  const orchestrator = getOrchestrator();

  // Build the model name with provider prefix for initChatModel
  const selectedModel = state.routerResult?.model;
  const modelWithProvider = selectedModel
    ? `google-genai:${selectedModel}`
    : undefined;

  const result = await orchestrator.invoke(
    { messages: state.messages },
    {
      context: { model: modelWithProvider },
    },
  );

  return { messages: result.messages };
}
