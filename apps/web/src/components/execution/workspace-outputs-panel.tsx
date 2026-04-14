// apps/web/src/components/execution/workspace-outputs-panel.tsx
"use client";

import {
  FileTree,
  FileTreeActions,
  FileTreeFile,
  FileTreeFolder,
} from "@/components/ai-elements/file-tree";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getWorkspaceRootForThread } from "@/lib/workspace-paths";
import {
  Download,
  ExternalLink,
  FileIcon,
  FileImageIcon,
  FileText,
} from "lucide-react";
import { useMemo } from "react";
import { useQueryState } from "nuqs";
import { SectionHeaderCollapsible } from "./section-header-collapsible";

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

function FileRowIcon({ path }: { path: string }) {
  if (isImagePath(path)) {
    return <FileImageIcon className="size-4 text-emerald-500 shrink-0" />;
  }
  if (isTextLikePath(path)) {
    return <FileText className="size-4 text-muted-foreground shrink-0" />;
  }
  return <FileIcon className="size-4 text-muted-foreground shrink-0" />;
}

function buildFileHref(filePath: string, threadId?: string, download = false): string {
  const params = new URLSearchParams({ path: filePath });
  if (threadId) params.set("threadId", threadId);
  if (download) params.set("download", "1");
  return `/api/workspace/file?${params.toString()}`;
}

type TreeNode = {
  name: string;
  fullPath: string; // absolute; folders end with "/"
  isDirectory: boolean;
  children: Map<string, TreeNode>;
};

function createNode(name: string, fullPath: string, isDirectory: boolean): TreeNode {
  return { name, fullPath, isDirectory, children: new Map() };
}

/**
 * Tokenize every path into segments and walk a trie so intermediate
 * directories exist as real folder nodes even when the upstream tool
 * output never printed them. This is the only way to reliably distinguish
 * files from folders when the source data is a flat list of leaf paths
 * scraped from tool messages.
 */
function buildSegmentTree(paths: string[]): TreeNode {
  const root = createNode("", "/", true);

  for (const rawPath of paths) {
    const trimmed = rawPath.trim();
    if (!trimmed) continue;

    const endsWithSlash = trimmed.endsWith("/");
    const withoutTrailing = endsWithSlash ? trimmed.slice(0, -1) : trimmed;
    const segments = withoutTrailing.split("/").filter(Boolean);
    if (segments.length === 0) continue;

    let node = root;
    let acc = "";
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const isLast = i === segments.length - 1;
      acc += `/${seg}`;

      let child = node.children.get(seg);
      if (!child) {
        const isDirectory = !isLast || endsWithSlash;
        child = createNode(seg, isDirectory ? `${acc}/` : acc, isDirectory);
        node.children.set(seg, child);
      } else if (!isLast) {
        // Walking past an existing leaf → it must be a directory.
        if (!child.isDirectory) {
          child.isDirectory = true;
          child.fullPath = `${acc}/`;
        }
      }

      node = child;
    }
  }

  return root;
}

/**
 * Walk the trie down to the node matching the workspace root, so the UI
 * starts inside the thread workspace instead of `/home/gem/workspace/...`.
 * Falls back to the deepest reachable node.
 */
function findDisplayRoot(root: TreeNode, workspaceRoot: string): TreeNode {
  const segments = workspaceRoot.split("/").filter(Boolean);
  let node = root;
  for (const seg of segments) {
    const next = node.children.get(seg);
    if (!next) break;
    node = next;
  }
  return node;
}

function sortChildren(node: TreeNode): TreeNode[] {
  return [...node.children.values()].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function countFiles(node: TreeNode): number {
  if (!node.isDirectory) return 1;
  let total = 0;
  for (const child of node.children.values()) total += countFiles(child);
  return total;
}

function FolderActions({ path, threadId }: { path: string; threadId?: string }) {
  return (
    <FileTreeActions>
      <a
        href={buildFileHref(path, threadId, false)}
        target="_blank"
        rel="noreferrer"
        aria-label="Browse folder"
        title="Browse folder"
        className="inline-flex items-center text-muted-foreground hover:text-foreground"
      >
        <ExternalLink className="size-3.5" />
        <span className="sr-only">Browse</span>
      </a>
    </FileTreeActions>
  );
}

function FileActions({
  path,
  name,
  threadId,
}: {
  path: string;
  name: string;
  threadId?: string;
}) {
  return (
    <FileTreeActions>
      <a
        href={buildFileHref(path, threadId, false)}
        target="_blank"
        rel="noreferrer"
        aria-label="Open file"
        title="Open file"
        className="inline-flex items-center text-muted-foreground hover:text-foreground"
      >
        <ExternalLink className="size-3.5" />
        <span className="sr-only">Open</span>
      </a>
      <a
        href={buildFileHref(path, threadId, true)}
        download={name}
        aria-label="Download file"
        title="Download file"
        className="inline-flex items-center text-muted-foreground hover:text-foreground"
      >
        <Download className="size-3.5" />
        <span className="sr-only">Download</span>
      </a>
    </FileTreeActions>
  );
}

export function WorkspaceOutputsPanel({ paths }: { paths: string[] }) {
  const [threadId] = useQueryState("threadId");
  const workspaceRoot = useMemo(
    () => getWorkspaceRootForThread(threadId ?? undefined),
    [threadId]
  );

  const displayRoot = useMemo(() => {
    const root = buildSegmentTree(paths);
    return findDisplayRoot(root, workspaceRoot);
  }, [paths, workspaceRoot]);

  const fileCount = useMemo(() => countFiles(displayRoot), [displayRoot]);

  const renderNode = (node: TreeNode): React.ReactNode => {
    if (node.isDirectory) {
      return (
        <FileTreeFolder
          key={node.fullPath}
          path={node.fullPath}
          name={node.name}
          actions={
            <FolderActions path={node.fullPath} threadId={threadId ?? undefined} />
          }
        >
          {sortChildren(node).map(renderNode)}
        </FileTreeFolder>
      );
    }

    return (
      <FileTreeFile
        key={node.fullPath}
        path={node.fullPath}
        name={node.name}
        icon={<FileRowIcon path={node.fullPath} />}
        actions={
          <FileActions
            path={node.fullPath}
            name={node.name}
            threadId={threadId ?? undefined}
          />
        }
      />
    );
  };

  if (displayRoot.children.size === 0) return null;

  return (
    <SectionHeaderCollapsible
      title="Workspace Outputs"
      rightSlot={
        <span className="text-xs text-muted-foreground tabular-nums">
          {fileCount} {fileCount === 1 ? "file" : "files"}
        </span>
      }
    >
      <ScrollArea className="max-h-[35vh]">
        <FileTree className="border-0 bg-transparent">
          {sortChildren(displayRoot).map(renderNode)}
        </FileTree>
      </ScrollArea>
    </SectionHeaderCollapsible>
  );
}
