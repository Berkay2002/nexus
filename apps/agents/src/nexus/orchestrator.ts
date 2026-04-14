import { createDeepAgent } from "deepagents";
import { AIMessage } from "@langchain/core/messages";
import type { FileData } from "deepagents";
import { AIOSandboxBackend } from "./backend/aio-sandbox.js";
import { createNexusBackend } from "./backend/composite.js";
import { ensureSandboxFilesystem } from "./backend/sandbox-bootstrap.js";
import {
  getWorkspaceRootForThread,
  renderWorkspaceTemplate,
} from "./backend/workspace.js";
import { configurableModelMiddleware } from "./middleware/configurable-model.js";
import { createModelFallbackMiddleware } from "./middleware/model-fallback.js";
import { createRuntimeInstructionsMiddleware } from "./middleware/runtime-instructions.js";
import {
  resolveTier,
  getTierDefault,
  buildTierFallbacks,
  type Tier,
} from "./models/index.js";
import { ORCHESTRATOR_SYSTEM_PROMPT } from "./prompts/orchestrator-system.js";
import { getNexusSubagents } from "./agents/index.js";
import { buildNexusSkillFiles } from "./skills/index.js";
import type { NexusState } from "./state.js";

interface NexusRunnableConfig {
  configurable?: {
    models?: Record<string, string>;
    thread_id?: string;
    threadId?: string;
    [key: string]: unknown;
  };
}

interface OrchestratorBundle {
  agent: ReturnType<typeof createNexusOrchestrator>;
  allowedSubagentTypes: string[];
  skillFiles: Record<string, FileData>;
}

function buildSubagentAvailabilityMessage(
  allowedSubagentTypes: string[],
): string {
  const unique = Array.from(new Set(allowedSubagentTypes));
  const quotedList = unique.map((name) => `"${name}"`).join(", ");
  const lines = [
    `Runtime sub-agent availability: call the task tool only with subagent_type in [${quotedList}].`,
  ];
  if (!unique.includes("creative")) {
    lines.push(
      'The "creative" sub-agent is unavailable in this runtime (no image-tier provider is configured). If the user requests images, explain this limitation and continue with available sub-agents. Do NOT call task with subagent_type "creative".',
    );
  }
  return lines.join("\n");
}

function parseAllowedTypesFromTaskError(error: unknown): string[] | null {
  if (!(error instanceof Error)) return null;
  const message = error.message;
  if (
    !/invoked agent of type/i.test(message) ||
    !/only allowed types are/i.test(message)
  ) {
    return null;
  }
  const match = message.match(/only allowed types are\s*([\s\S]*)$/i);
  if (!match) return null;
  const cleaned = match[1]
    .replace(/[`.]/g, "")
    .replace(/["']/g, "")
    .trim();
  if (!cleaned) return null;
  const parts = cleaned
    .split(/,|\bor\b/i)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : null;
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

  // Fire-and-forget: seed /home/gem/nexus-servers/ with the MCP wrapper tree.
  // Idempotent, dedup'd process-wide, returns fast after the first success.
  // Failures are logged to stderr and flip isMcpFilesystemReady() to false —
  // mcp_tool_search then short-circuits with a structured "catalog unavailable"
  // error so the agent falls back to hot-layer tools.
  void ensureSandboxFilesystem(sandbox);

  const defaultModel = resolveTier("default");
  if (!defaultModel) {
    throw new Error(
      "No default-tier model available — set GOOGLE_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY, or ZAI_API_KEY",
    );
  }

  const orchestratorFallbacks = buildTierFallbacks("default");
  const orchestratorMiddleware = [
    createRuntimeInstructionsMiddleware("nexus-orchestrator"),
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
    systemPrompt: renderWorkspaceTemplate(
      ORCHESTRATOR_SYSTEM_PROMPT,
      workspaceRoot,
    ),
    middleware: orchestratorMiddleware,
    backend,
    memory: ["/memories/AGENTS.md"],
    skills: ["/skills/"],
    subagents: getNexusSubagents(workspaceRoot),
  });
}

// Lazy cache — one orchestrator per thread workspace.
const orchestratorByThread = new Map<string, OrchestratorBundle>();

function resolveThreadId(config?: NexusRunnableConfig): string | undefined {
  const raw = config?.configurable?.thread_id ?? config?.configurable?.threadId;
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getOrchestrator(threadId?: string): OrchestratorBundle {
  const key = threadId ?? "__default__";
  const cached = orchestratorByThread.get(key);
  if (cached) {
    return cached;
  }

  const workspaceRoot = getWorkspaceRootForThread(threadId);
  const orchestrator = createNexusOrchestrator(undefined, workspaceRoot);
  const allowedSubagentTypes = getNexusSubagents(workspaceRoot).map(
    (subagent) => subagent.name.trim(),
  );
  const skillFiles = buildNexusSkillFiles(workspaceRoot);
  const bundle: OrchestratorBundle = {
    agent: orchestrator,
    allowedSubagentTypes,
    skillFiles,
  };
  orchestratorByThread.set(key, bundle);
  return bundle;
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
  const {
    agent: orchestrator,
    allowedSubagentTypes,
    skillFiles,
  } = getOrchestrator(threadId);

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

  // Merge the orchestrator's resolved model into the per-role map under the
  // DeepAgent's actual name ("nexus-orchestrator" — what the middleware
  // factory binds to). Do NOT route it through a shared ctx.model slot: that
  // slot is visible to every sub-agent's ConfigurableModel middleware and
  // leaks across agents, silently overriding their tier-resolved static
  // models (observed: research subagent running on the orchestrator's
  // default-tier model instead of deep-research).
  const mergedModels: Record<string, string> = { ...(modelsByRole ?? {}) };
  if (selectedModel) {
    mergedModels["nexus-orchestrator"] = selectedModel;
  }

  const runtimeInstructions = buildSubagentAvailabilityMessage(
    allowedSubagentTypes,
  );

  const invokeInput = {
    messages: state.messages,
    files: skillFiles,
  };

  const invokeConfig = {
    context: {
      models: mergedModels,
      threadId,
      runtimeInstructions,
    },
  };

  try {
    const result = await orchestrator.invoke(invokeInput, invokeConfig);
    return { messages: result.messages };
  } catch (error) {
    const allowedFromError = parseAllowedTypesFromTaskError(error);
    if (!allowedFromError) {
      throw error;
    }

    const retryInstructions =
      `${runtimeInstructions}\n` +
      `Your previous task call used an unavailable sub-agent type. Allowed sub-agent types for this run: ${allowedFromError.join(", ")}. Revise your plan and continue using only these types.`;

    try {
      const retryResult = await orchestrator.invoke(
        {
          messages: state.messages,
          files: skillFiles,
        },
        {
          context: {
            models: mergedModels,
            threadId,
            runtimeInstructions: retryInstructions,
          },
        },
      );
      return { messages: retryResult.messages };
    } catch {
      return {
        messages: [
          new AIMessage(
            `Warning: creative/image delegation is unavailable in this runtime. Available sub-agents: ${allowedFromError.join(", ")}. I skipped the unavailable agent so the run does not fail hard.`,
          ),
        ],
      };
    }
  }
}
