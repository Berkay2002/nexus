"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useModelSettings, type Role } from "@/stores/model-settings";
import type {
  ModelOption,
  ModelsApiResponse,
  ProviderId,
} from "@/app/api/models/route";

const AUTO_VALUE = "__auto__";

const ROLE_ORDER: Array<{ role: Role; label: string; description: string }> = [
  {
    role: "orchestrator",
    label: "Orchestrator",
    description: "Plans tasks and delegates to sub-agents.",
  },
  {
    role: "research",
    label: "Research",
    description: "Deep research sub-agent. High-capability model by default.",
  },
  {
    role: "code",
    label: "Code",
    description: "Code sub-agent for builds and debugging.",
  },
  {
    role: "creative",
    label: "Creative",
    description: "Image generation. Google-only.",
  },
  {
    role: "general-purpose",
    label: "General",
    description: "Fallback sub-agent for misc tasks.",
  },
];

const PROVIDER_LABELS: Record<ProviderId, string> = {
  google: "Google",
  anthropic: "Anthropic",
  openai: "OpenAI",
};

const PROVIDER_ENV_HINTS: Record<ProviderId, string> = {
  google: "GEMINI_API_KEY, GOOGLE_API_KEY, or GOOGLE_CLOUD_PROJECT",
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
};

interface ModelSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ModelSettingsSheet({
  open,
  onOpenChange,
}: ModelSettingsSheetProps) {
  const { modelsByRole, setModel, clearAll } = useModelSettings();
  const [data, setData] = useState<ModelsApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || data) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/models")
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed: ${res.status}`);
        return (await res.json()) as ModelsApiResponse;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, data]);

  const modelsById = useMemo(() => {
    const map = new Map<string, ModelOption>();
    if (data) for (const m of data.models) map.set(m.fullId, m);
    return map;
  }, [data]);

  const disabledProviders = useMemo<ProviderId[]>(() => {
    if (!data) return [];
    return (Object.keys(data.providers) as ProviderId[]).filter(
      (p) => !data.providers[p],
    );
  }, [data]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b">
          <SheetTitle>Model settings</SheetTitle>
          <SheetDescription>
            Pick a model per role. Auto uses the tier default based on the
            API keys available on the server.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {loading && !data && (
            <p className="text-xs text-muted-foreground">
              Loading available models...
            </p>
          )}
          {error && (
            <p className="text-xs text-destructive">
              Failed to load models: {error}
            </p>
          )}

          {data && (
            <div className="flex flex-col gap-5">
              {ROLE_ORDER.map(({ role, label, description }) => {
                const roleModels = data.models.filter((m) =>
                  m.roles.includes(role),
                );
                const selected = modelsByRole[role];
                const defaultFullId = data.tierDefaults[role];
                const defaultLabel = defaultFullId
                  ? (modelsById.get(defaultFullId)?.label ?? defaultFullId)
                  : null;
                const autoLabel = defaultLabel
                  ? `Auto (${defaultLabel})`
                  : "Auto";

                const value = selected ?? AUTO_VALUE;
                const hasOptions = roleModels.length > 0;

                return (
                  <div key={role} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <label className="text-xs font-medium text-foreground">
                        {label}
                      </label>
                      <span className="text-[0.65rem] text-muted-foreground">
                        {description}
                      </span>
                    </div>
                    <Select
                      value={value}
                      onValueChange={(next: string) => {
                        if (next === AUTO_VALUE) {
                          setModel(role, undefined);
                        } else {
                          setModel(role, next);
                        }
                      }}
                      disabled={!hasOptions}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={
                            hasOptions ? autoLabel : "No providers available"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={AUTO_VALUE}>{autoLabel}</SelectItem>
                        {roleModels.map((m) => (
                          <SelectItem key={m.fullId} value={m.fullId}>
                            {m.label}
                            <span className="ml-1 text-muted-foreground">
                              · {PROVIDER_LABELS[m.provider]}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}

              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => clearAll()}
                  disabled={Object.keys(modelsByRole).length === 0}
                >
                  Reset to auto
                </Button>
              </div>

              {disabledProviders.length > 0 && (
                <div className="mt-2 rounded-md border border-border/60 bg-muted/30 p-3">
                  <p className="mb-1 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                    Disabled providers
                  </p>
                  <ul className="flex flex-col gap-0.5">
                    {disabledProviders.map((p) => (
                      <li
                        key={p}
                        className="text-[0.7rem] text-muted-foreground"
                      >
                        {PROVIDER_LABELS[p]} — set {PROVIDER_ENV_HINTS[p]} to
                        enable
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
