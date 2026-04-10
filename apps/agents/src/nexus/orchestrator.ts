import { createDeepAgent } from "deepagents";
import { AIOSandboxBackend } from "./backend/aio-sandbox.js";
import { createNexusBackend } from "./backend/composite.js";
import { configurableModelMiddleware } from "./middleware/configurable-model.js";
import { resolveTier, getTierDefault, type Tier } from "./models/index.js";
import { ORCHESTRATOR_SYSTEM_PROMPT } from "./prompts/orchestrator-system.js";
import { getNexusSubagents } from "./agents/index.js";
import { nexusSkillFiles } from "./skills/index.js";
import type { NexusState } from "./state.js";

interface NexusRunnableConfig {
  configurable?: {
    models?: Record<string, string>;
    [key: string]: unknown;
  };
}

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
export function createNexusOrchestrator(
  sandboxUrl = process.env.SANDBOX_URL ?? "http://localhost:8080",
) {
  const sandbox = new AIOSandboxBackend(sandboxUrl);
  const backend = createNexusBackend(sandbox);

  const defaultModel = resolveTier("default");
  if (!defaultModel) {
    throw new Error(
      "No default-tier model available — set GOOGLE_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY",
    );
  }

  return createDeepAgent({
    name: "nexus-orchestrator",
    model: defaultModel,
    systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT,
    middleware: [configurableModelMiddleware] as const,
    backend,
    memory: ["/memories/AGENTS.md"],
    skills: ["/skills/"],
    subagents: getNexusSubagents(),
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
 * Reads routerResult from graph state and translates the abstract complexity
 * label into a concrete `provider:id` override for the ConfigurableModel
 * middleware. Also merges any role-based overrides passed through
 * `config.configurable.models` (reserved for Task 3).
 */
export async function orchestratorNode(
  state: NexusState,
  config?: NexusRunnableConfig,
): Promise<Partial<NexusState>> {
  const orchestrator = getOrchestrator();

  const tierForComplexity: Tier =
    state.routerResult?.complexity === "trivial" ? "classifier" : "default";
  const descriptor = getTierDefault(tierForComplexity);
  const classifierResolvedString = descriptor
    ? `${descriptor.provider}:${descriptor.id}`
    : undefined;

  const modelsByRole = config?.configurable?.models;

  // Per-role override for the orchestrator wins over the classifier's complexity result
  const orchestratorOverride = modelsByRole?.["orchestrator"];
  const selectedModel = orchestratorOverride ?? classifierResolvedString;

  const result = await orchestrator.invoke(
    {
      messages: state.messages,
      files: nexusSkillFiles,
    },
    {
      context: { model: selectedModel, models: modelsByRole },
    },
  );

  return { messages: result.messages };
}
