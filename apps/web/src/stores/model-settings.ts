"use client";

// apps/web/src/stores/model-settings.ts
//
// Per-role model override store. Persists to localStorage.
// Zustand is not installed, so this is a plain custom hook backed by a
// module-level store + subscribe pattern so multiple components stay in sync.

import { useSyncExternalStore } from "react";

export type Role =
  | "orchestrator"
  | "research"
  | "code"
  | "creative"
  | "general-purpose";

export type ModelsByRole = Partial<Record<Role, string>>;

const STORAGE_KEY = "nexus:model-settings";

function loadFromStorage(): ModelsByRole {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as ModelsByRole;
    }
    return {};
  } catch {
    return {};
  }
}

function saveToStorage(value: ModelsByRole): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore quota / serialization errors
  }
}

// Module-level store with subscriber set.
let state: ModelsByRole = {};
let initialized = false;
const listeners = new Set<() => void>();

function ensureInitialized(): void {
  if (initialized) return;
  initialized = true;
  state = loadFromStorage();
}

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ModelsByRole {
  ensureInitialized();
  return state;
}

function getServerSnapshot(): ModelsByRole {
  return {};
}

function setModelInternal(role: Role, fullId: string | undefined): void {
  ensureInitialized();
  const next: ModelsByRole = { ...state };
  if (fullId === undefined) {
    delete next[role];
  } else {
    next[role] = fullId;
  }
  state = next;
  saveToStorage(state);
  emit();
}

function clearAllInternal(): void {
  state = {};
  initialized = true;
  saveToStorage(state);
  emit();
}

export interface ModelSettingsApi {
  modelsByRole: ModelsByRole;
  setModel: (role: Role, fullId: string | undefined) => void;
  clearAll: () => void;
}

/**
 * Hook returning the current per-role model overrides and mutators.
 * SSR-safe — server snapshot is an empty object; first client render
 * hydrates from localStorage.
 */
export function useModelSettings(): ModelSettingsApi {
  const modelsByRole = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  return {
    modelsByRole,
    setModel: setModelInternal,
    clearAll: clearAllInternal,
  };
}

/**
 * Non-hook accessor for the current overrides. Useful inside event handlers
 * (e.g. submit) where a hook isn't available. Safe to call on the server —
 * returns an empty object.
 */
export function getModelsByRole(): ModelsByRole {
  if (typeof window === "undefined") return {};
  ensureInitialized();
  return state;
}

