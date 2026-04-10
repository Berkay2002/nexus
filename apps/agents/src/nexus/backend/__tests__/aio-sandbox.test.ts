import { describe, it, expect, beforeAll } from "vitest";
import { AIOSandboxBackend } from "../aio-sandbox.js";

// Integration test — requires AIO Sandbox running at :8080
// Run: docker run --security-opt seccomp=unconfined --rm -it -p 8080:8080 ghcr.io/agent-infra/sandbox:latest
const SANDBOX_URL = process.env.SANDBOX_URL ?? "http://localhost:8080";

async function isSandboxReachable(): Promise<boolean> {
  try {
    const res = await fetch(SANDBOX_URL, {
      signal: AbortSignal.timeout(1000),
    });
    return res.status < 500;
  } catch {
    return false;
  }
}

const sandboxReachable = await isSandboxReachable();

describe.skipIf(!sandboxReachable)("AIOSandboxBackend", () => {
  let backend: AIOSandboxBackend;

  beforeAll(() => {
    backend = new AIOSandboxBackend(SANDBOX_URL);
  });

  it("should have a stable id", () => {
    expect(backend.id).toBe("aio-sandbox");
  });

  it("should execute a shell command", async () => {
    const result = await backend.execute("echo hello");
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("hello");
    expect(result.truncated).toBe(false);
  });

  it("should report non-zero exit codes", async () => {
    const result = await backend.execute("exit 1");
    expect(result.exitCode).toBe(1);
  });

  it("should execute in the sandbox home directory", async () => {
    const result = await backend.execute("pwd");
    expect(result.output.trim()).toBe("/home/gem");
  });

  it("should write and read files via execute", async () => {
    await backend.execute(
      "mkdir -p /home/gem/workspace/test && echo 'test content' > /home/gem/workspace/test/file.txt",
    );
    const result = await backend.execute(
      "cat /home/gem/workspace/test/file.txt",
    );
    expect(result.output.trim()).toBe("test content");
    await backend.execute("rm -rf /home/gem/workspace/test");
  });

  it("should upload and download files", async () => {
    const content = new TextEncoder().encode("uploaded content");
    const uploadResult = await backend.uploadFiles([
      ["/home/gem/workspace/upload-test.txt", content],
    ]);
    expect(uploadResult[0].error).toBeNull();

    const downloadResult = await backend.downloadFiles([
      "/home/gem/workspace/upload-test.txt",
    ]);
    expect(downloadResult[0].error).toBeNull();

    const decoded = new TextDecoder().decode(
      downloadResult[0].content as Uint8Array,
    );
    expect(decoded).toBe("uploaded content");
    await backend.execute("rm /home/gem/workspace/upload-test.txt");
  });
});
