import {
  BaseSandbox,
  type ExecuteResponse,
  type FileUploadResponse,
  type FileDownloadResponse,
} from "deepagents";
import { SandboxClient } from "@agent-infra/sandbox";
import {
  DEFAULT_WORKSPACE_ROOT,
  normalizeWorkspaceRoot,
  remapWorkspaceCommand,
  remapWorkspacePath,
} from "./workspace.js";

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
  private workspaceRoot: string;

  constructor(
    baseURL: string = "http://localhost:8080",
    workspaceRoot: string = DEFAULT_WORKSPACE_ROOT,
  ) {
    super();
    this.baseURL = baseURL;
    this.client = new SandboxClient({ environment: baseURL });
    this.workspaceRoot = normalizeWorkspaceRoot(workspaceRoot);
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
