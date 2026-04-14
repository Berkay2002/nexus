import { describe, it, expect, beforeEach, vi } from "vitest";
import { BaseSandbox } from "deepagents";
import type {
  ExecuteResponse,
  FileUploadResponse,
  FileDownloadResponse,
} from "deepagents";
import {
  ensureSandboxFilesystem,
  isMcpFilesystemReady,
  __resetBootstrapStateForTests,
} from "../backend/sandbox-bootstrap.js";

class FakeSandboxBackend extends BaseSandbox {
  readonly id = "fake-sandbox";
  files = new Map<string, Uint8Array>();
  executeLog: string[] = [];
  uploadBatches: Array<Array<[string, Uint8Array]>> = [];
  executeOverrides: Array<(command: string) => ExecuteResponse | null> = [];
  uploadOverride: ((files: Array<[string, Uint8Array]>) => FileUploadResponse[]) | null = null;

  async execute(command: string): Promise<ExecuteResponse> {
    this.executeLog.push(command);

    for (const override of this.executeOverrides) {
      const result = override(command);
      if (result) return result;
    }

    // test -f PATH && echo exists
    const testMatch = command.match(/^test -f (\S+) && echo exists$/);
    if (testMatch) {
      const present = this.files.has(testMatch[1]);
      return {
        output: present ? "exists\n" : "",
        exitCode: present ? 0 : 1,
        truncated: false,
      };
    }

    // cd X && npm install 2>&1
    if (/cd \/home\/gem\/nexus-servers && npm install 2>&1/.test(command)) {
      return { output: "added 1 package\n", exitCode: 0, truncated: false };
    }

    // date ... > PATH
    const dateMatch = command.match(/^date .* > (\S+)$/);
    if (dateMatch) {
      this.files.set(dateMatch[1], new TextEncoder().encode("2026-04-14T00:00:00Z\n"));
      return { output: "", exitCode: 0, truncated: false };
    }

    return { output: `unexpected command: ${command}`, exitCode: 1, truncated: false };
  }

  async uploadFiles(
    files: Array<[string, Uint8Array]>,
  ): Promise<FileUploadResponse[]> {
    this.uploadBatches.push(files);
    if (this.uploadOverride) return this.uploadOverride(files);
    const results: FileUploadResponse[] = [];
    for (const [path, bytes] of files) {
      this.files.set(path, bytes);
      results.push({ path, error: null });
    }
    return results;
  }

  async downloadFiles(paths: string[]): Promise<FileDownloadResponse[]> {
    return paths.map((path) => {
      const content = this.files.get(path);
      if (!content) return { path, content: null, error: "file_not_found" };
      return { path, content, error: null };
    });
  }
}

describe("ensureSandboxFilesystem", () => {
  beforeEach(() => {
    __resetBootstrapStateForTests();
    vi.restoreAllMocks();
  });

  it("cold start uploads the tree, runs npm install, writes the marker", async () => {
    const fake = new FakeSandboxBackend();
    const ok = await ensureSandboxFilesystem(fake);

    expect(ok).toBe(true);
    expect(isMcpFilesystemReady()).toBe(true);
    expect(fake.uploadBatches).toHaveLength(1);
    // Batch should contain at least package.json + callMCPTool.js
    const paths = fake.uploadBatches[0].map(([p]) => p);
    expect(paths).toContain("/home/gem/nexus-servers/package.json");
    expect(paths).toContain("/home/gem/nexus-servers/_client/callMCPTool.js");
    // Marker exists after success
    expect(fake.files.has("/home/gem/nexus-servers/.bootstrap-marker")).toBe(true);
    // npm install was invoked
    expect(
      fake.executeLog.some((cmd) =>
        /cd \/home\/gem\/nexus-servers && npm install 2>&1/.test(cmd),
      ),
    ).toBe(true);
  });

  it("fast path: marker present → no uploads, no npm install", async () => {
    const fake = new FakeSandboxBackend();
    fake.files.set(
      "/home/gem/nexus-servers/.bootstrap-marker",
      new TextEncoder().encode("prior-run"),
    );
    const ok = await ensureSandboxFilesystem(fake);

    expect(ok).toBe(true);
    expect(fake.uploadBatches).toHaveLength(0);
    expect(
      fake.executeLog.filter((cmd) => cmd.includes("npm install")),
    ).toHaveLength(0);
  });

  it("concurrent calls dedupe to a single bootstrap", async () => {
    const fake = new FakeSandboxBackend();
    const [a, b] = await Promise.all([
      ensureSandboxFilesystem(fake),
      ensureSandboxFilesystem(fake),
    ]);

    expect(a).toBe(true);
    expect(b).toBe(true);
    expect(fake.uploadBatches).toHaveLength(1);
    // npm install fired exactly once
    expect(
      fake.executeLog.filter((cmd) => cmd.includes("npm install")),
    ).toHaveLength(1);
  });

  it("partial upload error: marker not written, flag set false", async () => {
    const fake = new FakeSandboxBackend();
    fake.uploadOverride = (files) =>
      files.map(([path], i) => ({
        path,
        error: i === 0 ? "permission_denied" : null,
      }));

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const ok = await ensureSandboxFilesystem(fake);

    expect(ok).toBe(false);
    expect(isMcpFilesystemReady()).toBe(false);
    expect(fake.files.has("/home/gem/nexus-servers/.bootstrap-marker")).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
  });

  it("npm install failure: marker not written, captured stderr logged", async () => {
    const fake = new FakeSandboxBackend();
    fake.executeOverrides.push((command) => {
      if (command.includes("npm install")) {
        return {
          output: "npm ERR! network request failed\n",
          exitCode: 1,
          truncated: false,
        };
      }
      return null;
    });

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const ok = await ensureSandboxFilesystem(fake);

    expect(ok).toBe(false);
    expect(isMcpFilesystemReady()).toBe(false);
    expect(fake.files.has("/home/gem/nexus-servers/.bootstrap-marker")).toBe(false);
    const logged = errorSpy.mock.calls.flat().join(" ");
    expect(logged).toContain("npm ERR! network request failed");
  });

  it("retry after partial failure succeeds and flips the flag back to true", async () => {
    const fake = new FakeSandboxBackend();
    let callCount = 0;
    fake.executeOverrides.push((command) => {
      if (command.includes("npm install")) {
        callCount++;
        if (callCount === 1) {
          return { output: "transient failure", exitCode: 1, truncated: false };
        }
      }
      return null;
    });

    vi.spyOn(console, "error").mockImplementation(() => {});
    const first = await ensureSandboxFilesystem(fake);
    expect(first).toBe(false);
    expect(isMcpFilesystemReady()).toBe(false);

    // Second attempt: allow npm install to succeed. __resetBootstrapStateForTests
    // is NOT called — we want the real retry path that re-enters because the
    // previous promise rejected and the marker isn't there.
    const second = await ensureSandboxFilesystem(fake);
    expect(second).toBe(true);
    expect(isMcpFilesystemReady()).toBe(true);
  });

  it("isMcpFilesystemReady starts false before any bootstrap", () => {
    __resetBootstrapStateForTests();
    expect(isMcpFilesystemReady()).toBe(false);
  });
});
