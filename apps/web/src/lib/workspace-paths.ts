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

/**
 * Regex matching either a thread-scoped workspace root
 * (`/home/gem/workspace/threads/<id>`) or the legacy bare workspace root
 * (`/home/gem/workspace`). Used to strip the noisy absolute prefix from
 * paths rendered in the UI so users see short, workspace-relative paths.
 *
 * IMPORTANT: the thread variant must be tested before the bare variant so
 * the regex consumes the whole `/threads/<id>` segment in one match.
 */
const WORKSPACE_PREFIX_REGEX =
  /\/home\/gem\/workspace(?:\/threads\/[a-zA-Z0-9._-]+)?/g;

/**
 * Strip the workspace root prefix from any paths inside `text`. Purely
 * cosmetic — intended for labels, tool-call args, command previews, and
 * terminal output. Never apply to raw agent state or data that will round-
 * trip back into tool calls; the LLM must still see (and emit) the full
 * absolute path so its tool invocations resolve correctly.
 *
 * Result: `/home/gem/workspace/threads/019d.../code/task_2/foo.md` → `/code/task_2/foo.md`.
 */
export function stripWorkspacePrefix(value: string | null | undefined): string {
  if (typeof value !== "string" || value.length === 0) return value ?? "";
  return value.replace(WORKSPACE_PREFIX_REGEX, "");
}
