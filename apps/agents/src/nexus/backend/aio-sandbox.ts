import {
  BaseSandbox,
  type ExecuteResponse,
  type FileUploadResponse,
  type FileDownloadResponse,
  type LsResult,
  type GlobResult,
} from "deepagents";
import { SandboxClient } from "@agent-infra/sandbox";
import {
  DEFAULT_WORKSPACE_ROOT,
  normalizeWorkspaceRoot,
  remapWorkspaceCommand,
  remapWorkspacePath,
} from "./workspace.js";

function shellQuote(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

/**
 * Delimiter for stat format output. The AIO Sandbox API strips tab characters
 * from command output, so we use a multi-char delimiter that survives the
 * round-trip.
 */
const STAT_DELIM = "|||";

/**
 * Shared stat-line parser for ls() and glob() overrides.
 * Input format: "size|||mtime|||type|||path" from `stat -c '%s|||%Y|||%F|||%n'`.
 */
function parseStatCLine(
  line: string,
): { size: number; mtime: number; isDir: boolean; fullPath: string } | null {
  const parts = line.split(STAT_DELIM);
  if (parts.length < 4) return null;
  const size = parseInt(parts[0], 10);
  const mtime = parseInt(parts[1], 10);
  const typeStr = parts[2];
  const fullPath = parts.slice(3).join(STAT_DELIM); // path might contain delimiter
  if (isNaN(size) || isNaN(mtime)) return null;
  return { size, mtime, isDir: typeStr === "directory", fullPath };
}

/**
 * Convert a glob pattern to a regex for matching relative paths.
 * Supports *, **, ?, and [...] character classes.
 */
function globToRegex(pattern: string): RegExp {
  let regexStr = "^";
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === "*") {
      if (pattern[i + 1] === "*") {
        // ** matches any path segments
        regexStr += ".*";
        i += 2;
        if (pattern[i] === "/") i++; // skip trailing slash after **
      } else {
        // * matches anything except /
        regexStr += "[^/]*";
        i++;
      }
    } else if (ch === "?") {
      regexStr += "[^/]";
      i++;
    } else if (ch === "[") {
      const close = pattern.indexOf("]", i + 1);
      if (close === -1) {
        regexStr += "\\[";
        i++;
      } else {
        regexStr += pattern.slice(i, close + 1);
        i = close + 1;
      }
    } else if (".+^${}()|\\".includes(ch)) {
      regexStr += "\\" + ch;
      i++;
    } else {
      regexStr += ch;
      i++;
    }
  }
  regexStr += "$";
  return new RegExp(regexStr);
}

/**
 * AIO Sandbox backend for DeepAgents.
 *
 * Wraps the @agent-infra/sandbox TypeScript SDK to connect to an AIO Sandbox
 * Docker container. Only execute() is strictly required — BaseSandbox derives
 * all filesystem tools (ls, read_file, write_file, edit_file, glob, grep)
 * from shell commands via execute().
 *
 * uploadFiles() and downloadFiles() are implemented for efficient bulk transfer
 * (seeding workspace, retrieving artifacts).
 */
export class AIOSandboxBackend extends BaseSandbox {
  readonly id = "aio-sandbox";
  private client: SandboxClient;
  private baseURL: string;
  readonly workspaceRoot: string;

  constructor(
    baseURL: string = "http://localhost:8080",
    workspaceRoot: string = DEFAULT_WORKSPACE_ROOT,
  ) {
    super();
    this.baseURL = baseURL;
    this.client = new SandboxClient({ environment: baseURL });
    this.workspaceRoot = normalizeWorkspaceRoot(workspaceRoot);
  }

  /**
   * Map a virtual path to a physical sandbox path.
   *
   * DeepAgents tools present a virtual filesystem where "/" is the workspace
   * root. Paths like "/research/task_1/" are virtual — the real files live at
   * "{workspaceRoot}/research/task_1/" in the container.
   *
   * This method handles three cases:
   * 1. Path already starts with workspaceRoot → use as-is
   * 2. Path starts with DEFAULT_WORKSPACE_ROOT → remap to workspaceRoot
   * 3. Bare virtual path (e.g. "/research/") → prepend workspaceRoot
   */
  private toPhysicalPath(virtualPath: string): string {
    // Already fully qualified with this thread's workspace root
    if (virtualPath.startsWith(this.workspaceRoot + "/") || virtualPath === this.workspaceRoot) {
      return virtualPath;
    }
    // Legacy default workspace path → remap
    if (virtualPath.startsWith(DEFAULT_WORKSPACE_ROOT + "/") || virtualPath === DEFAULT_WORKSPACE_ROOT) {
      return remapWorkspacePath(virtualPath, this.workspaceRoot);
    }
    // Virtual path (e.g. "/research/", "/shared/file.md") → prepend workspace root
    if (virtualPath.startsWith("/")) {
      return this.workspaceRoot + virtualPath;
    }
    // Relative path — shouldn't happen but be safe
    return this.workspaceRoot + "/" + virtualPath;
  }

  private unreachableMessage(): string {
    return (
      `AIO Sandbox unreachable at ${this.baseURL}. Is the container running? ` +
      `Start with: docker run --security-opt seccomp=unconfined --rm -it -p 8080:8080 ghcr.io/agent-infra/sandbox:latest`
    );
  }

  async execute(command: string): Promise<ExecuteResponse> {
    const remappedCommand = remapWorkspaceCommand(command, this.workspaceRoot);
    const commandToRun =
      this.workspaceRoot === DEFAULT_WORKSPACE_ROOT
        ? remappedCommand
        : `mkdir -p ${this.workspaceRoot} && ${remappedCommand}`;

    let response;
    try {
      response = await this.client.shell.execCommand({ command: commandToRun });
    } catch {
      return {
        output: this.unreachableMessage(),
        exitCode: 1,
        truncated: false,
      };
    }
    // response is APIResponse — on success, body.data holds ShellCommandResult
    if (!response.ok) {
      const failed = response as { ok: false; error: unknown };
      return {
        output: `Sandbox error: ${JSON.stringify(failed.error)}`,
        exitCode: 1,
        truncated: false,
      };
    }
    const result = response.body.data;
    // Treat timeout statuses as truncated output
    const truncated =
      result?.status === "hard_timeout" ||
      result?.status === "no_change_timeout";
    return {
      output: result?.output ?? "",
      exitCode: result?.exit_code ?? null,
      truncated,
    };
  }

  /**
   * Override BaseSandbox.ls() which uses `find` with `/dev/null`-based
   * detection of GNU vs BusyBox vs BSD tooling. The AIO Sandbox runs shell
   * commands in a chrooted environment where `/dev/null` doesn't exist,
   * causing all three detection branches to fail silently and return empty.
   *
   * This override uses a simple `stat`-based listing that works in any
   * POSIX environment without relying on `/dev/null`.
   */
  async ls(dirPath: string): Promise<LsResult> {
    const physicalPath = this.toPhysicalPath(dirPath);
    const command =
      `for f in ${shellQuote(physicalPath)}/*; do ` +
      `[ -e "$f" ] || continue; ` +
      `stat -c '%s|||%Y|||%F|||%n' "$f"; ` +
      `done`;
    const result = await this.execute(command);
    const files = [];
    for (const line of result.output.trim().split("\n")) {
      if (!line) continue;
      const parsed = parseStatCLine(line);
      if (!parsed) continue;
      files.push({
        path: parsed.isDir ? parsed.fullPath + "/" : parsed.fullPath,
        is_dir: parsed.isDir,
        size: parsed.size,
        modified_at: new Date(parsed.mtime * 1000).toISOString(),
      });
    }
    return { files };
  }

  /**
   * Override BaseSandbox.glob() — same /dev/null issue as ls(), plus
   * needs virtual-to-physical path mapping.
   */
  async glob(pattern: string, searchPath = "/"): Promise<GlobResult> {
    const physicalPath = this.toPhysicalPath(searchPath);
    const command =
      `find ${shellQuote(physicalPath)} -not -path ${shellQuote(physicalPath)} ` +
      `-exec stat -c '%s|||%Y|||%F|||%n' {} +`;
    const result = await this.execute(command);
    const regex = globToRegex(pattern);
    const basePath = physicalPath.endsWith("/")
      ? physicalPath.slice(0, -1)
      : physicalPath;
    const files = [];
    for (const line of result.output.trim().split("\n")) {
      if (!line) continue;
      const parsed = parseStatCLine(line);
      if (!parsed) continue;
      const relPath = parsed.fullPath.startsWith(basePath + "/")
        ? parsed.fullPath.slice(basePath.length + 1)
        : parsed.fullPath;
      if (regex.test(relPath)) {
        files.push({
          path: relPath,
          is_dir: parsed.isDir,
          size: parsed.size,
          modified_at: new Date(parsed.mtime * 1000).toISOString(),
        });
      }
    }
    return { files };
  }

  async uploadFiles(
    files: Array<[string, Uint8Array]>,
  ): Promise<FileUploadResponse[]> {
    const results: FileUploadResponse[] = [];
    for (const [originalPath, content] of files) {
      const remappedPath = remapWorkspacePath(originalPath, this.workspaceRoot);
      try {
        // Encode binary content as base64 for the sandbox file API
        const base64Content = Buffer.from(content).toString("base64");
        await this.client.file.writeFile({
          file: remappedPath,
          content: base64Content,
          encoding: "base64",
        });
        results.push({ path: originalPath, error: null });
      } catch (err) {
        // Map generic errors to the closest FileOperationError code
        const message =
          err instanceof Error ? err.message : String(err);
        if (message.includes("not found") || message.includes("No such file")) {
          results.push({ path: originalPath, error: "file_not_found" });
        } else if (
          message.includes("permission") ||
          message.includes("Permission")
        ) {
          results.push({ path: originalPath, error: "permission_denied" });
        } else {
          results.push({ path: originalPath, error: "invalid_path" });
        }
      }
    }
    return results;
  }

  async downloadFiles(paths: string[]): Promise<FileDownloadResponse[]> {
    const results: FileDownloadResponse[] = [];
    for (const originalPath of paths) {
      const remappedPath = remapWorkspacePath(originalPath, this.workspaceRoot);
      try {
        const response = await this.client.file.readFile({ file: remappedPath });
        if (!response.ok) {
          results.push({
            path: originalPath,
            content: null,
            error: "file_not_found",
          });
          continue;
        }
        const fileContent = response.body.data?.content ?? "";
        const content = new TextEncoder().encode(fileContent);
        results.push({ path: originalPath, content, error: null });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : String(err);
        if (message.includes("not found") || message.includes("No such file")) {
          results.push({
            path: originalPath,
            content: null,
            error: "file_not_found",
          });
        } else if (
          message.includes("permission") ||
          message.includes("Permission")
        ) {
          results.push({
            path: originalPath,
            content: null,
            error: "permission_denied",
          });
        } else {
          results.push({ path: originalPath, content: null, error: "invalid_path" });
        }
      }
    }
    return results;
  }
}
