// apps/web/src/components/execution/workspace-outputs-panel.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExternalLink, Download, FileText } from "lucide-react";

function baseName(filePath: string): string {
  const parts = filePath.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? filePath;
}

function buildFileHref(filePath: string, download = false): string {
  const params = new URLSearchParams({ path: filePath });
  if (download) params.set("download", "1");
  return `/api/workspace/file?${params.toString()}`;
}

export function WorkspaceOutputsPanel({
  paths,
}: {
  paths: string[];
}) {
  if (paths.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Workspace Outputs
        </h3>
        <Badge variant="secondary" className="text-[0.6rem] h-4 px-1.5">
          {paths.length} files
        </Badge>
      </div>

      <ScrollArea className="max-h-[35vh]">
        <div className="flex flex-col gap-1.5">
          {paths.map((path) => (
            <div
              key={path}
              className="rounded-md border border-border/60 bg-card/50 px-2.5 py-2"
            >
              <div className="flex items-start gap-2">
                <FileText className="size-3.5 mt-0.5 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{baseName(path)}</p>
                  <p className="text-[11px] text-muted-foreground break-all">{path}</p>
                </div>
              </div>

              <div className="mt-2 flex items-center gap-3 pl-5.5">
                <a
                  href={buildFileHref(path, false)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  <ExternalLink className="size-3" />
                  Open
                </a>
                <a
                  href={buildFileHref(path, true)}
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                >
                  <Download className="size-3" />
                  Download
                </a>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
