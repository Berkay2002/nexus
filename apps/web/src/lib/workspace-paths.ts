export const DEFAULT_WORKSPACE_ROOT = "/home/gem/workspace";

export function sanitizeThreadId(threadId: string): string {
  const trimmed = threadId.trim();
  if (!trimmed) return "default";

  const sanitized = trimmed
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^[._-]+|[._-]+$/g, "")
    .replace(/_+/g, "_");

  return sanitized || "default";
}

export function getWorkspaceRootForThread(threadId?: string): string {
  if (!threadId) return DEFAULT_WORKSPACE_ROOT;
  return `${DEFAULT_WORKSPACE_ROOT}/threads/${sanitizeThreadId(threadId)}`;
}

export function remapWorkspacePath(path: string, workspaceRoot: string): string {
  if (workspaceRoot === DEFAULT_WORKSPACE_ROOT) return path;
  if (path === workspaceRoot || path.startsWith(`${workspaceRoot}/`)) return path;
  if (path === DEFAULT_WORKSPACE_ROOT) return workspaceRoot;
  if (path.startsWith(`${DEFAULT_WORKSPACE_ROOT}/`)) {
    return `${workspaceRoot}${path.slice(DEFAULT_WORKSPACE_ROOT.length)}`;
  }
  return path;
}
