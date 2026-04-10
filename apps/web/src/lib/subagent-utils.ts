// apps/web/src/lib/subagent-utils.ts
"use client";

import { useEffect, useState } from "react";
import { useModelSettings, type Role } from "@/stores/model-settings";
import type {
  ModelOption,
  ModelsApiResponse,
} from "@/app/api/models/route";

export interface NexusTodo {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed";
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
  status: "pending" | "running" | "complete" | "error",
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
