// apps/web/src/lib/subagent-utils.ts
"use client";

import { useEffect, useState } from "react";
import { useModelSettings, type Role } from "@/stores/model-settings";
import type {
  ModelOption,
  ModelsApiResponse,
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

/**
 * Hook returning a map from subagent_type -> human-friendly model label.
 * Combines the user's per-role overrides with the server-side tierDefaults
 * fetched from `/api/models`. Returns an empty map while loading or on
 * fetch error — callers must handle the fallback via `getModelBadge`.
 */
export function useSubagentModelLabels(): Record<string, string> {
  const { modelsByRole } = useModelSettings();
  const [catalog, setCatalog] = useState<ModelsApiResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/models")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ModelsApiResponse | null) => {
        if (!cancelled && data) setCatalog(data);
      })
      .catch(() => {
        // ignore — leave catalog null, consumers fall back to raw type
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!catalog) return {};

  const modelsByFullId = new Map<string, ModelOption>();
  for (const model of catalog.models) {
    modelsByFullId.set(model.fullId, model);
  }

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
