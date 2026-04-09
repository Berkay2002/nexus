import {
  BaseSandbox,
  type ExecuteResponse,
  type FileUploadResponse,
  type FileDownloadResponse,
} from "deepagents";
import { SandboxClient } from "@agent-infra/sandbox";

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

  constructor(baseURL: string = "http://localhost:8080") {
    super();
    this.client = new SandboxClient({ environment: baseURL });
  }

  async execute(command: string): Promise<ExecuteResponse> {
    const response = await this.client.shell.execCommand({ command });
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
    for (const [filePath, content] of files) {
      try {
        // Encode binary content as base64 for the sandbox file API
        const base64Content = Buffer.from(content).toString("base64");
        await this.client.file.writeFile({
          file: filePath,
          content: base64Content,
          encoding: "base64",
        });
        results.push({ path: filePath, error: null });
      } catch (err) {
        // Map generic errors to the closest FileOperationError code
        const message =
          err instanceof Error ? err.message : String(err);
        if (message.includes("not found") || message.includes("No such file")) {
          results.push({ path: filePath, error: "file_not_found" });
        } else if (
          message.includes("permission") ||
          message.includes("Permission")
        ) {
          results.push({ path: filePath, error: "permission_denied" });
        } else {
          results.push({ path: filePath, error: "invalid_path" });
        }
      }
    }
    return results;
  }

  async downloadFiles(paths: string[]): Promise<FileDownloadResponse[]> {
    const results: FileDownloadResponse[] = [];
    for (const filePath of paths) {
      try {
        const response = await this.client.file.readFile({ file: filePath });
        if (!response.ok) {
          results.push({
            path: filePath,
            content: null,
            error: "file_not_found",
          });
          continue;
        }
        const fileContent = response.body.data?.content ?? "";
        const content = new TextEncoder().encode(fileContent);
        results.push({ path: filePath, content, error: null });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : String(err);
        if (message.includes("not found") || message.includes("No such file")) {
          results.push({ path: filePath, content: null, error: "file_not_found" });
        } else if (
          message.includes("permission") ||
          message.includes("Permission")
        ) {
          results.push({
            path: filePath,
            content: null,
            error: "permission_denied",
          });
        } else {
          results.push({ path: filePath, content: null, error: "invalid_path" });
        }
      }
    }
    return results;
  }
}
