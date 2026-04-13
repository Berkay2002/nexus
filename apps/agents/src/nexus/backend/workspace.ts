export const DEFAULT_WORKSPACE_ROOT = "/home/gem/workspace";

function trimTrailingSlash(value: string): string {
  if (value.length > 1 && value.endsWith("/")) {
    return value.replace(/\/+$/, "");
  }
  return value;
}

export function normalizeWorkspaceRoot(workspaceRoot: string): string {
  const trimmed = workspaceRoot.trim();
  if (!trimmed.startsWith("/")) {
    throw new Error("workspaceRoot must be an absolute POSIX path");
  }
  return trimTrailingSlash(trimmed);
}

export function sanitizeThreadId(threadId: string): string {
  const trimmed = threadId.trim();
  if (!trimmed) return "default";

  const sanitized = trimmed
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^[._-]+|[._-]+$/g, "")
    .replace(/_+/g, "_");

  if (!sanitized) return "default";
  return sanitized.slice(0, 120);
}

export function getWorkspaceRootForThread(threadId?: string): string {
  if (!threadId) return DEFAULT_WORKSPACE_ROOT;
  const safeThreadId = sanitizeThreadId(threadId);
  return `${DEFAULT_WORKSPACE_ROOT}/threads/${safeThreadId}`;
}

export function remapWorkspacePath(
  originalPath: string,
  workspaceRoot: string,
): string {
  const normalizedRoot = normalizeWorkspaceRoot(workspaceRoot);
  if (normalizedRoot === DEFAULT_WORKSPACE_ROOT) return originalPath;

  if (originalPath === DEFAULT_WORKSPACE_ROOT) {
    return normalizedRoot;
  }
  if (originalPath.startsWith(`${DEFAULT_WORKSPACE_ROOT}/`)) {
    return `${normalizedRoot}${originalPath.slice(DEFAULT_WORKSPACE_ROOT.length)}`;
  }
  return originalPath;
}

export function remapWorkspaceCommand(
  command: string,
  workspaceRoot: string,
): string {
  const normalizedRoot = normalizeWorkspaceRoot(workspaceRoot);
  if (normalizedRoot === DEFAULT_WORKSPACE_ROOT) return command;
  if (!command.includes(DEFAULT_WORKSPACE_ROOT)) return command;

  return command.split(DEFAULT_WORKSPACE_ROOT).join(normalizedRoot);
}
