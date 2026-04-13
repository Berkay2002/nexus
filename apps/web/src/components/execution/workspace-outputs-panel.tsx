// apps/web/src/components/execution/workspace-outputs-panel.tsx
"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronRight,
  Download,
  ExternalLink,
  FileIcon,
  FileImageIcon,
  FileText,
  FolderIcon,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { SectionHeaderCollapsible } from "./section-header-collapsible";

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

function isImagePath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return (
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".gif") ||
    lower.endsWith(".svg")
  );
}

function isTextLikePath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return (
    lower.endsWith(".md") ||
    lower.endsWith(".txt") ||
    lower.endsWith(".json") ||
    lower.endsWith(".yml") ||
    lower.endsWith(".yaml") ||
    lower.endsWith(".ts") ||
    lower.endsWith(".tsx") ||
    lower.endsWith(".js") ||
    lower.endsWith(".jsx") ||
    lower.endsWith(".py") ||
    lower.endsWith(".css") ||
    lower.endsWith(".html")
  );
}

function OutputPathIcon({ path }: { path: string }) {
  if (isDirectoryPath(path)) {
    return <FolderIcon className="size-3.5 mt-0.5 text-blue-500 shrink-0" />;
  }

  if (isImagePath(path)) {
    return <FileImageIcon className="size-3.5 mt-0.5 text-emerald-500 shrink-0" />;
  }

  if (isTextLikePath(path)) {
    return <FileText className="size-3.5 mt-0.5 text-muted-foreground shrink-0" />;
  }

  return <FileIcon className="size-3.5 mt-0.5 text-muted-foreground shrink-0" />;
}

function buildFileHref(filePath: string, download = false): string {
  const params = new URLSearchParams({ path: filePath });
  if (download) params.set("download", "1");
  return `/api/workspace/file?${params.toString()}`;
}

function dedupeOutputPaths(paths: string[]): string[] {
  const orderedKeys: string[] = [];
  const byKey = new Map<string, string>();

  for (const rawPath of paths) {
    const path = rawPath.trim();
    if (!path) continue;

    const key = path.endsWith("/") ? path.slice(0, -1) : path;
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, path);
      orderedKeys.push(key);
      continue;
    }

    // If both forms exist, prefer directory-style with trailing slash.
    if (path.endsWith("/") && !existing.endsWith("/")) {
      byKey.set(key, path);
    }
  }

  return orderedKeys
    .map((key) => byKey.get(key))
    .filter((path): path is string => typeof path === "string");
}

type OutputTree = {
  roots: string[];
  childrenByParent: Map<string, string[]>;
};

function buildOutputTree(paths: string[]): OutputTree {
  const folderPaths = paths.filter((path) => isDirectoryPath(path));
  const foldersByLengthDesc = [...folderPaths].sort((a, b) => b.length - a.length);

  const parentByPath = new Map<string, string>();
  const childrenByParent = new Map<string, string[]>();

  for (const path of paths) {
    for (const folderPath of foldersByLengthDesc) {
      if (folderPath === path) continue;
      if (!path.startsWith(folderPath)) continue;

      parentByPath.set(path, folderPath);
      const children = childrenByParent.get(folderPath) ?? [];
      children.push(path);
      childrenByParent.set(folderPath, children);
      break;
    }
  }

  const roots = paths.filter((path) => !parentByPath.has(path));
  return { roots, childrenByParent };
}

export function WorkspaceOutputsPanel({
  paths,
}: {
  paths: string[];
}) {
  const dedupedPaths = useMemo(() => dedupeOutputPaths(paths), [paths]);
  const outputTree = useMemo(() => buildOutputTree(dedupedPaths), [dedupedPaths]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const toggleFolder = useCallback((folderPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  }, []);

  const renderOutputRow = useCallback(
    (path: string, depth = 0): React.ReactNode => {
      const children = outputTree.childrenByParent.get(path) ?? [];
      const isFolder = isDirectoryPath(path);
      const isExpandableFolder = isFolder && children.length > 0;
      const isExpanded = expandedFolders.has(path);

      return (
        <div key={path} className="rounded-md bg-transparent px-2.5 py-2">
          <div
            className="flex items-start gap-2"
            style={depth > 0 ? { paddingLeft: `${depth * 12}px` } : undefined}
          >
            {isExpandableFolder ? (
              <button
                type="button"
                onClick={() => toggleFolder(path)}
                className="mt-0.5 inline-flex items-center text-muted-foreground hover:text-foreground"
                aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
                title={isExpanded ? "Collapse folder" : "Expand folder"}
              >
                <ChevronRight
                  className={cn(
                    "size-3.5 shrink-0 transition-transform",
                    isExpanded && "rotate-90",
                  )}
                />
              </button>
            ) : (
              <span className="mt-0.5 size-3.5 shrink-0" />
            )}

            <OutputPathIcon path={path} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate">{baseName(path)}</p>
              <p className="text-[11px] text-muted-foreground break-all">{path}</p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 self-center">
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

          {isExpandableFolder && isExpanded && (
            <div className="mt-0.5">
              {children.map((childPath) => renderOutputRow(childPath, depth + 1))}
            </div>
          )}
        </div>
      );
    },
    [expandedFolders, outputTree.childrenByParent, toggleFolder],
  );

  if (dedupedPaths.length === 0) return null;

  return (
    <SectionHeaderCollapsible
      title="Workspace Outputs"
      rightSlot={
        <span className="text-xs text-muted-foreground tabular-nums">
          {dedupedPaths.length} files
        </span>
      }
    >
      <ScrollArea className="max-h-[35vh]">
        <div className="flex flex-col gap-1.5">
          {outputTree.roots.map((path) => renderOutputRow(path))}
        </div>
      </ScrollArea>
    </SectionHeaderCollapsible>
  );
}
