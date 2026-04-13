import { createDeepAgent } from "deepagents";
import { AIOSandboxBackend } from "./backend/aio-sandbox.js";
import { createNexusBackend } from "./backend/composite.js";
import { getWorkspaceRootForThread } from "./backend/workspace.js";
import { configurableModelMiddleware } from "./middleware/configurable-model.js";
import { createModelFallbackMiddleware } from "./middleware/model-fallback.js";
import {
  resolveTier,
  getTierDefault,
  buildTierFallbacks,
  type Tier,
} from "./models/index.js";
import { ORCHESTRATOR_SYSTEM_PROMPT } from "./prompts/orchestrator-system.js";
import { getNexusSubagents } from "./agents/index.js";
import { nexusSkillFiles } from "./skills/index.js";
import type { NexusState } from "./state.js";

interface NexusRunnableConfig {
  configurable?: {
    models?: Record<string, string>;
    thread_id?: string;
    threadId?: string;
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
  workspaceRoot = getWorkspaceRootForThread(),
) {
  const sandbox = new AIOSandboxBackend(sandboxUrl, workspaceRoot);
  const backend = createNexusBackend(sandbox);

  const defaultModel = resolveTier("default");
  if (!defaultModel) {
    throw new Error(
      "No default-tier model available — set GOOGLE_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY, or ZAI_API_KEY",
    );
  }

  const orchestratorFallbacks = buildTierFallbacks("default");
  const orchestratorMiddleware = [
    configurableModelMiddleware,
    ...(orchestratorFallbacks.length > 0
      ? [
          createModelFallbackMiddleware(
            "nexus-orchestrator",
            orchestratorFallbacks,
          ),
        ]
      : []),
  ];

  return createDeepAgent({
    name: "nexus-orchestrator",
    model: defaultModel,
    systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT,
    middleware: orchestratorMiddleware,
    backend,
    memory: ["/memories/AGENTS.md"],
    skills: ["/skills/"],
    subagents: getNexusSubagents(),
  });
}

// Lazy cache — one orchestrator per thread workspace.
const orchestratorByThread = new Map<
  string,
  ReturnType<typeof createNexusOrchestrator>
>();

function resolveThreadId(config?: NexusRunnableConfig): string | undefined {
  const raw = config?.configurable?.thread_id ?? config?.configurable?.threadId;
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getOrchestrator(threadId?: string) {
  const key = threadId ?? "__default__";
  const cached = orchestratorByThread.get(key);
  if (cached) {
    return cached;
  }

  const workspaceRoot = getWorkspaceRootForThread(threadId);
  const orchestrator = createNexusOrchestrator(undefined, workspaceRoot);
  orchestratorByThread.set(key, orchestrator);
  return orchestrator;
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
  const threadId = resolveThreadId(config);
  const orchestrator = getOrchestrator(threadId);

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
      context: { model: selectedModel, models: modelsByRole, threadId },
    },
  );

  return { messages: result.messages };
}
