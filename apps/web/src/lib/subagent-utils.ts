// apps/web/src/lib/subagent-utils.ts
"use client";

import { useEffect, useState } from "react";
import { useModelSettings, type Role } from "@/stores/model-settings";
import type {
  ModelOption,
  ModelsApiResponse,
  ProviderId,
} from "@/app/api/models/route";

export interface NexusTodo {
  content: string;
  status: "pending" | "in_progress" | "completed";
}

export type NexusTodoStatus = NexusTodo["status"];

export function normalizeTodoStatus(status: unknown): NexusTodoStatus {
  const raw = String(status ?? "").toLowerCase();

  if (["completed", "complete", "done", "success", "succeeded", "finished"].includes(raw)) {
    return "completed";
  }

  if (["in_progress", "in-progress", "in progress", "running", "active", "working"].includes(raw)) {
    return "in_progress";
  }

  if (["not-started", "not_started", "not started", "pending", "todo"].includes(raw)) {
    return "pending";
  }

  return "pending";
}

export function normalizeTodos(input: unknown): NexusTodo[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((todo): NexusTodo | null => {
      if (typeof todo === "string") {
        const text = todo.trim();
        if (!text) return null;
        return { content: text, status: "pending" };
      }

      if (!todo || typeof todo !== "object") return null;
      const value = todo as Record<string, unknown>;
      const contentCandidate =
        value.content ?? value.title ?? value.text ?? value.task ?? value.label;
      const statusCandidate = value.status ?? value.state;

      if (typeof contentCandidate !== "string" || !contentCandidate.trim()) {
        return null;
      }

      return {
        content: contentCandidate,
        status: normalizeTodoStatus(statusCandidate),
      };
    })
    .filter((todo): todo is NexusTodo => todo !== null);
}

function extractTodosPayload(args: unknown): unknown {
  if (!args) return undefined;

  if (Array.isArray(args)) {
    return args;
  }

  if (typeof args === "string") {
    try {
      return extractTodosPayload(JSON.parse(args));
    } catch {
      return undefined;
    }
  }

  if (typeof args !== "object") return undefined;

  const value = args as Record<string, unknown>;
  return value.todos ?? value.todoList ?? value.todo_list ?? value.items;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function extractTodosFromValues(values: unknown): NexusTodo[] {
  const root = asRecord(values);
  if (!root) return [];

  const state = asRecord(root.state);
  const update = asRecord(root.update);
  const output = asRecord(root.output);
  const outputUpdate = asRecord(output?.update);
  const nestedValues = asRecord(root.values);

  const payloadCandidates: unknown[] = [
    root.todos,
    root.todoList,
    root.todo_list,
    state?.todos,
    state?.todoList,
    state?.todo_list,
    update?.todos,
    update?.todoList,
    update?.todo_list,
    output?.todos,
    output?.todoList,
    output?.todo_list,
    outputUpdate?.todos,
    outputUpdate?.todoList,
    outputUpdate?.todo_list,
    nestedValues?.todos,
    nestedValues?.todoList,
    nestedValues?.todo_list,
  ];

  for (const payload of payloadCandidates) {
    const normalized = normalizeTodos(payload);
    if (normalized.length > 0) return normalized;
  }

  return [];
}

export function extractLatestTodosFromMessages(messages: any[]): NexusTodo[] {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    const toolCalls: any[] =
      message?.tool_calls ?? message?.additional_kwargs?.tool_calls ?? [];

    for (let j = toolCalls.length - 1; j >= 0; j--) {
      const toolCall = toolCalls[j];
      const toolName = toolCall?.name;
      if (toolName !== "write_todos" && toolName !== "write_todo") continue;

      const args = toolCall?.args ?? toolCall?.arguments;
      const todos = extractTodosPayload(args);

      const normalized = normalizeTodos(todos);
      if (normalized.length > 0) return normalized;
    }
  }

  return [];
}

export type SubagentStatus = "pending" | "running" | "complete" | "error";

/**
 * Normalize runtime status values from stream providers into a stable UI enum.
 */
export function normalizeSubagentStatus(status: unknown): SubagentStatus {
  const raw = String(status ?? "").toLowerCase();

  if (["running", "in_progress", "in-progress", "active", "working"].includes(raw)) {
    return "running";
  }

  if (["complete", "completed", "done", "success", "succeeded", "finished"].includes(raw)) {
    return "complete";
  }

  if (["error", "failed", "failure", "cancelled", "canceled", "aborted"].includes(raw)) {
    return "error";
  }

  return "pending";
}

export function isSubagentTerminalStatus(status: unknown): boolean {
  const normalized = normalizeSubagentStatus(status);
  return normalized === "complete" || normalized === "error";
}

/**
 * Pure function: look up a display label for a subagent type, given a
 * precomputed map. Falls back to the raw subagent type.
 */
export function getModelBadge(
  subagentType: string,
  labelBySubagent: Record<string, string>,
): string {
  return labelBySubagent[subagentType] ?? subagentType;
}

const SUBAGENT_ROLES: Role[] = [
  "orchestrator",
  "research",
  "code",
  "creative",
  "general-purpose",
];

const SUBAGENT_ROLE_LABEL: Record<Role, string> = {
  orchestrator: "Strong",
  research: "Research",
  code: "Code",
  creative: "Creative",
  "general-purpose": "General",
};

const SUBAGENT_TYPE_TO_ROLE: Record<string, Role> = {
  orchestrator: "orchestrator",
  research: "research",
  code: "code",
  creative: "creative",
  "general-purpose": "general-purpose",
};

const CLASSIFIER_FALLBACK_PRIORITY: Array<{
  provider: ProviderId;
  id: string;
}> = [
  { provider: "google", id: "gemini-3-flash-preview" },
  { provider: "anthropic", id: "claude-haiku-4-5" },
  { provider: "openai", id: "gpt-5.4-nano" },
  { provider: "zai", id: "glm-4.7" },
];

const FALLBACK_MODELS: ModelOption[] = [
  {
    provider: "google",
    id: "gemini-3-flash-preview",
    label: "Gemini 3 Flash",
    fullId: "google:gemini-3-flash-preview",
    roles: ["orchestrator", "code", "general-purpose"],
  },
  {
    provider: "google",
    id: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro",
    fullId: "google:gemini-3.1-pro-preview",
    roles: ["research"],
  },
  {
    provider: "google",
    id: "gemini-3.1-flash-image-preview",
    label: "Gemini 3.1 Flash Image",
    fullId: "google:gemini-3.1-flash-image-preview",
    roles: ["creative"],
  },
  {
    provider: "anthropic",
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    fullId: "anthropic:claude-haiku-4-5",
    roles: ["orchestrator", "general-purpose"],
  },
  {
    provider: "anthropic",
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    fullId: "anthropic:claude-sonnet-4-6",
    roles: ["orchestrator", "code", "research", "general-purpose"],
  },
  {
    provider: "anthropic",
    id: "claude-opus-4-6",
    label: "Claude Opus 4.6",
    fullId: "anthropic:claude-opus-4-6",
    roles: ["code", "research"],
  },
  {
    provider: "openai",
    id: "gpt-5.4-nano",
    label: "GPT-5.4 nano",
    fullId: "openai:gpt-5.4-nano",
    roles: ["orchestrator", "general-purpose"],
  },
  {
    provider: "openai",
    id: "gpt-5.4-mini",
    label: "GPT-5.4 mini",
    fullId: "openai:gpt-5.4-mini",
    roles: ["orchestrator", "code", "general-purpose"],
  },
  {
    provider: "openai",
    id: "gpt-5.4",
    label: "GPT-5.4",
    fullId: "openai:gpt-5.4",
    roles: ["orchestrator", "code", "research", "general-purpose"],
  },
  {
    provider: "zai",
    id: "glm-4.7",
    label: "GLM-4.7",
    fullId: "zai:glm-4.7",
    roles: ["orchestrator", "general-purpose"],
  },
  {
    provider: "zai",
    id: "glm-5-turbo",
    label: "GLM-5 Turbo",
    fullId: "zai:glm-5-turbo",
    roles: ["orchestrator", "general-purpose"],
  },
  {
    provider: "zai",
    id: "glm-5.1",
    label: "GLM-5.1",
    fullId: "zai:glm-5.1",
    roles: ["orchestrator", "code", "research", "general-purpose"],
  },
];

const FALLBACK_TIER_DEFAULTS: Record<Role, string> = {
  orchestrator: "anthropic:claude-haiku-4-5",
  research: "google:gemini-3.1-pro-preview",
  code: "anthropic:claude-sonnet-4-6",
  creative: "google:gemini-3.1-flash-image-preview",
  "general-purpose": "anthropic:claude-haiku-4-5",
};

const FALLBACK_CATALOG: ModelsApiResponse = {
  providers: {
    google: true,
    anthropic: true,
    openai: true,
    zai: true,
  },
  models: FALLBACK_MODELS,
  tierDefaults: FALLBACK_TIER_DEFAULTS,
};

export interface ModelIdentity {
  provider: ProviderId;
  modelLabel: string;
  fullId: string;
}

export interface RoleModelIdentity extends ModelIdentity {
  role: Role;
  roleLabel: string;
}

function buildModelMap(catalog: ModelsApiResponse): Map<string, ModelOption> {
  const modelsByFullId = new Map<string, ModelOption>();
  for (const model of catalog.models) {
    modelsByFullId.set(model.fullId, model);
  }
  return modelsByFullId;
}

function findModelById(
  catalog: ModelsApiResponse,
  id: string,
): ModelOption | null {
  return catalog.models.find((m) => m.id === id) ?? null;
}

function findModelByRef(
  catalog: ModelsApiResponse,
  modelsByFullId: Map<string, ModelOption>,
  modelRef: string,
): ModelOption | null {
  const direct = modelsByFullId.get(modelRef);
  if (direct) return direct;

  if (!modelRef.includes(":")) {
    return findModelById(catalog, modelRef);
  }

  const [, id] = modelRef.split(":", 2);
  return findModelById(catalog, id);
}

function useModelCatalog(): ModelsApiResponse {
  const [catalog, setCatalog] = useState<ModelsApiResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/models")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ModelsApiResponse | null) => {
        if (!cancelled && data) setCatalog(data);
      })
      .catch(() => {
        // ignore — fall back to static catalog below
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!catalog || catalog.models.length === 0) {
    return FALLBACK_CATALOG;
  }

  const mergedTierDefaults: Record<Role, string | null> = {
    orchestrator:
      catalog.tierDefaults.orchestrator ?? FALLBACK_TIER_DEFAULTS.orchestrator,
    research: catalog.tierDefaults.research ?? FALLBACK_TIER_DEFAULTS.research,
    code: catalog.tierDefaults.code ?? FALLBACK_TIER_DEFAULTS.code,
    creative: catalog.tierDefaults.creative ?? FALLBACK_TIER_DEFAULTS.creative,
    "general-purpose":
      catalog.tierDefaults["general-purpose"] ??
      FALLBACK_TIER_DEFAULTS["general-purpose"],
  };

  return {
    ...catalog,
    tierDefaults: mergedTierDefaults,
  };
}

function toRoleIdentity(
  role: Role,
  model: ModelOption,
): RoleModelIdentity {
  return {
    role,
    roleLabel: SUBAGENT_ROLE_LABEL[role],
    provider: model.provider,
    modelLabel: model.label,
    fullId: model.fullId,
  };
}

function resolveRoleModel(
  role: Role,
  catalog: ModelsApiResponse,
  preferredModelRefsByRole: Partial<Record<Role, string>>,
  modelsByRole: Partial<Record<Role, string>>,
  modelsByFullId: Map<string, ModelOption>,
): ModelOption | null {
  const preferredRef = preferredModelRefsByRole[role];
  if (preferredRef) {
    const preferredModel = findModelByRef(
      catalog,
      modelsByFullId,
      preferredRef,
    );
    if (preferredModel) return preferredModel;
  }

  const override = modelsByRole[role];
  if (override) {
    const overrideModel = findModelByRef(catalog, modelsByFullId, override);
    if (overrideModel) return overrideModel;
  }

  const tierDefault =
    catalog.tierDefaults[role] ?? FALLBACK_TIER_DEFAULTS[role];
  if (tierDefault) {
    const defaultModel = findModelByRef(catalog, modelsByFullId, tierDefault);
    if (defaultModel) return defaultModel;
  }

  return catalog.models.find((m) => m.roles.includes(role)) ?? null;
}

function resolveClassifierModel(
  catalog: ModelsApiResponse,
  modelsByFullId: Map<string, ModelOption>,
): ModelOption | null {
  for (const candidate of CLASSIFIER_FALLBACK_PRIORITY) {
    const fullId = `${candidate.provider}:${candidate.id}`;
    const model = findModelByRef(catalog, modelsByFullId, fullId);
    if (model) return model;
  }

  return resolveRoleModel("orchestrator", catalog, {}, {}, modelsByFullId);
}

/**
 * Hook returning a map from subagent_type -> human-friendly model label.
 * Combines the user's per-role overrides with the server-side tierDefaults
 * fetched from `/api/models`. Returns an empty map while loading or on
 * fetch error — callers must handle the fallback via `getModelBadge`.
 */
export function useSubagentModelLabels(): Record<string, string> {
  const { modelsByRole } = useModelSettings();
  const catalog = useModelCatalog();

  const modelsByFullId = buildModelMap(catalog);

  const result: Record<string, string> = {};
  for (const role of SUBAGENT_ROLES) {
    const fullId = modelsByRole[role] ?? catalog.tierDefaults[role];
    if (!fullId) continue;
    const model = modelsByFullId.get(fullId);
    if (model) {
      result[role] = model.label;
    }
  }
  return result;
}

/**
 * Hook returning a map from subagent_type -> structured model identity.
 * Used by execution cards to render provider logo + model + role labels.
 */
export function useSubagentModelIdentities(
  preferredModelRefsByRole: Partial<Record<Role, string>> = {},
): Record<string, RoleModelIdentity> {
  const { modelsByRole } = useModelSettings();
  const catalog = useModelCatalog();

  const modelsByFullId = buildModelMap(catalog);
  const result: Record<string, RoleModelIdentity> = {};

  for (const role of SUBAGENT_ROLES) {
    const model = resolveRoleModel(
      role,
      catalog,
      preferredModelRefsByRole,
      modelsByRole,
      modelsByFullId,
    );
    if (!model) continue;
    result[role] = toRoleIdentity(role, model);
  }

  return result;
}

/**
 * Hook returning structured model identity for the routing card.
 * Uses orchestrator override when set; otherwise follows default/classifier
 * routing behavior so the badge reflects runtime intent.
 */
export function useRoutingModelIdentity(
  complexity: "trivial" | "default" | undefined,
  selectedModelRef?: string,
): RoleModelIdentity | null {
  const { modelsByRole } = useModelSettings();
  const catalog = useModelCatalog();

  if (!complexity) return null;

  const modelsByFullId = buildModelMap(catalog);
  const selectedModel =
    typeof selectedModelRef === "string" && selectedModelRef.trim()
      ? findModelByRef(catalog, modelsByFullId, selectedModelRef.trim())
      : null;
  const override = modelsByRole.orchestrator;
  const overrideModel = override ? modelsByFullId.get(override) ?? null : null;
  const model =
    selectedModel ??
    overrideModel ??
    (complexity === "trivial"
      ? resolveClassifierModel(catalog, modelsByFullId)
      : resolveRoleModel(
          "orchestrator",
          catalog,
          {},
          modelsByRole,
          modelsByFullId,
        ));

  if (!model) return null;

  return {
    role: "orchestrator",
    roleLabel: complexity === "trivial" ? "Fast" : "Strong",
    provider: model.provider,
    modelLabel: model.label,
    fullId: model.fullId,
  };
}

export function getRoleForSubagentType(subagentType: string): Role | null {
  return SUBAGENT_TYPE_TO_ROLE[subagentType] ?? null;
}

/** Map subagent_type to display-friendly agent name */
const AGENT_NAME_MAP: Record<string, string> = {
  research: "Research Agent",
  code: "Code Agent",
  creative: "Creative Agent",
  "general-purpose": "General Agent",
};

export function getAgentName(subagentType: string): string {
  return AGENT_NAME_MAP[subagentType] ?? subagentType;
}

/** Format elapsed time from timestamps */
export function getElapsedTime(
  startedAt: number | undefined,
  completedAt: number | undefined,
): string | null {
  if (!startedAt) return null;
  const end = completedAt ?? Date.now();
  const seconds = Math.round((end - startedAt) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

/** Get status color class for a subagent status */
export function getStatusColor(
  status: SubagentStatus,
): string {
  switch (status) {
    case "pending":
      return "text-muted-foreground";
    case "running":
      return "text-primary";
    case "complete":
      return "text-green-500";
    case "error":
      return "text-destructive";
  }
}
