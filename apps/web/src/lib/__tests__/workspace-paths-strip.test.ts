import { describe, it, expect } from "vitest";
import { stripWorkspacePrefix } from "../workspace-paths";

describe("stripWorkspacePrefix", () => {
  it("strips a thread-scoped absolute workspace path", () => {
    expect(
      stripWorkspacePrefix(
        "/home/gem/workspace/threads/019d8d2f-6a82-7ddf-831a-d585b78370e5/code/task_2/llm-wiki-blog",
      ),
    ).toBe("/code/task_2/llm-wiki-blog");
  });

  it("strips a bare legacy workspace path", () => {
    expect(
      stripWorkspacePrefix("/home/gem/workspace/research/task_1/findings.md"),
    ).toBe("/research/task_1/findings.md");
  });

  it("strips multiple occurrences in a single string", () => {
    const input =
      "Wrote /home/gem/workspace/threads/abc/research/task_1/findings.md and /home/gem/workspace/shared/report.md";
    expect(stripWorkspacePrefix(input)).toBe(
      "Wrote /research/task_1/findings.md and /shared/report.md",
    );
  });

  it("leaves unrelated paths alone", () => {
    expect(stripWorkspacePrefix("/etc/hosts")).toBe("/etc/hosts");
    expect(stripWorkspacePrefix("relative/path/file.md")).toBe(
      "relative/path/file.md",
    );
  });

  it("handles null and empty values safely", () => {
    expect(stripWorkspacePrefix(null)).toBe("");
    expect(stripWorkspacePrefix(undefined)).toBe("");
    expect(stripWorkspacePrefix("")).toBe("");
  });

  it("collapses a bare workspace root to empty so callers can fall back to '/'", () => {
    expect(stripWorkspacePrefix("/home/gem/workspace")).toBe("");
    expect(
      stripWorkspacePrefix(
        "/home/gem/workspace/threads/019d8d2f-6a82-7ddf-831a-d585b78370e5",
      ),
    ).toBe("");
  });

  it("handles a shell command with mixed paths", () => {
    expect(
      stripWorkspacePrefix(
        "ls /home/gem/workspace/threads/abc/code/task_2 && cat /home/gem/workspace/threads/abc/code/task_2/build-log.md",
      ),
    ).toBe("ls /code/task_2 && cat /code/task_2/build-log.md");
  });
});
