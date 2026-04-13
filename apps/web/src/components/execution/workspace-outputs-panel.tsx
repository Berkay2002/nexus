// apps/web/src/components/execution/workspace-outputs-panel.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ExternalLink, Download, FileText } from "lucide-react";

function baseName(filePath: string): string {
  if (filePath.endsWith("/")) {
    const trimmed = filePath.slice(0, -1);
    const parts = trimmed.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? filePath;
  }
  const parts = filePath.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? filePath;
}

function isDirectoryPath(filePath: string): boolean {
  return filePath.endsWith("/");
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
    <Collapsible defaultOpen>
      <div className="flex flex-col gap-2">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between px-1 text-muted-foreground hover:text-foreground"
          >
            <div className="flex items-center gap-1.5">
              <ChevronDown className="size-3.5 shrink-0 transition-transform [[data-state=closed]_&]:-rotate-90" />
              <h3 className="text-xs font-semibold uppercase tracking-wider">
                Workspace Outputs
              </h3>
            </div>
            <Badge variant="secondary" className="text-[0.6rem] h-4 px-1.5">
              {paths.length} files
            </Badge>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <ScrollArea className="max-h-[35vh]">
            <div className="flex flex-col gap-1.5">
              {paths.map((path) => (
                <div
                  key={path}
                  className="rounded-md border border-border/60 bg-transparent px-2.5 py-2"
                >
                  <div className="flex items-start gap-2">
                    <FileText className="size-3.5 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{baseName(path)}</p>
                      <p className="text-[11px] text-muted-foreground break-all">{path}</p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={buildFileHref(path, false)}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={isDirectoryPath(path) ? "Browse folder" : "Open file"}
                        title={isDirectoryPath(path) ? "Browse folder" : "Open file"}
                        className="inline-flex items-center text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="size-3.5" />
                        <span className="sr-only">
                          {isDirectoryPath(path) ? "Browse" : "Open"}
                        </span>
                      </a>

                      {!isDirectoryPath(path) && (
                        <a
                          href={buildFileHref(path, true)}
                          download={baseName(path)}
                          aria-label="Download file"
                          title="Download file"
                          className="inline-flex items-center text-muted-foreground hover:text-foreground"
                        >
                          <Download className="size-3.5" />
                          <span className="sr-only">Download</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
