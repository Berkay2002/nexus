import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORKSPACE_ROOT,
  getWorkspaceRootForThread,
  normalizeWorkspaceRoot,
  remapWorkspaceCommand,
  remapWorkspacePath,
  sanitizeThreadId,
} from "../workspace.js";

describe("workspace helpers", () => {
  it("keeps default workspace root when thread_id is missing", () => {
    expect(getWorkspaceRootForThread()).toBe(DEFAULT_WORKSPACE_ROOT);
  });

  it("derives a thread-scoped workspace root", () => {
    expect(getWorkspaceRootForThread("019d878c-5715-7339-aa42-6a9f8c99f0f6")).toBe(
      "/home/gem/workspace/threads/019d878c-5715-7339-aa42-6a9f8c99f0f6",
    );
  });

  it("sanitizes unsafe thread ids", () => {
    expect(sanitizeThreadId(" ../../evil thread/id ")).toBe("evil_thread_id");
  });

  it("normalizes workspace roots", () => {
    expect(normalizeWorkspaceRoot("/home/gem/workspace/threads/t1/")).toBe(
      "/home/gem/workspace/threads/t1",
    );
  });

  it("rejects non-absolute workspace roots", () => {
    expect(() => normalizeWorkspaceRoot("workspace/threads/t1")).toThrow(
      "workspaceRoot must be an absolute POSIX path",
    );
  });

  it("remaps workspace paths for thread roots", () => {
    const threadRoot = "/home/gem/workspace/threads/t1";
    expect(remapWorkspacePath("/home/gem/workspace/shared/report.md", threadRoot)).toBe(
      "/home/gem/workspace/threads/t1/shared/report.md",
    );
  });

  it("remaps workspace references in shell commands", () => {
    const threadRoot = "/home/gem/workspace/threads/t1";
    const command =
      "mkdir -p /home/gem/workspace/shared && ls -la /home/gem/workspace/shared";
    expect(remapWorkspaceCommand(command, threadRoot)).toBe(
      "mkdir -p /home/gem/workspace/threads/t1/shared && ls -la /home/gem/workspace/threads/t1/shared",
    );
  });
});
