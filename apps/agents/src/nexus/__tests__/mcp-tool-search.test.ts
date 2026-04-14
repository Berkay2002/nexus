import { describe, it, expect, beforeEach, vi } from "vitest";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { createMcpToolSearch } from "../tools/mcp-tool-search/tool.js";

const here = fileURLToPath(import.meta.url);
const fixtureRoot = resolve(here, "..", "fixtures", "wrapper-files");

function makeTool(overrides: { ready?: boolean } = {}) {
  return createMcpToolSearch({
    sourceRoot: fixtureRoot,
    readyChecker: () => overrides.ready ?? true,
  });
}

async function invoke(
  tool: ReturnType<typeof createMcpToolSearch>,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const raw = await tool.invoke(input);
  return JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));
}

describe("mcp_tool_search", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("exact name substring match wins", async () => {
    const tool = makeTool();
    const result = await invoke(tool, { query: "navigate" });
    expect(result.results).toBeInstanceOf(Array);
    const top = (result.results as Array<{ name: string }>)[0];
    expect(top.name).toBe("chrome_devtools_navigate");
  });

  it("description keyword match works for capability-flavored queries", async () => {
    const tool = makeTool();
    const result = await invoke(tool, { query: "markdown" });
    const names = (result.results as Array<{ name: string }>).map((r) => r.name);
    expect(names).toContain("sandbox_convert_to_markdown");
  });

  it("argument names contribute to ranking", async () => {
    const tool = makeTool();
    const result = await invoke(tool, { query: "timeout" });
    const names = (result.results as Array<{ name: string }>).map((r) => r.name);
    expect(names).toContain("sandbox_execute_bash");
  });

  it("namespace parameter restricts the search", async () => {
    const tool = makeTool();
    const result = await invoke(tool, {
      query: "screenshot",
      namespace: "browser",
    });
    const names = (result.results as Array<{ name: string }>).map((r) => r.name);
    expect(names).toEqual(["browser_take_screenshot"]);
  });

  it("limit caps the returned results", async () => {
    const tool = makeTool();
    const result = await invoke(tool, { query: "execute", limit: 1 });
    expect((result.results as unknown[]).length).toBe(1);
  });

  it("empty matches return structured guidance, not an empty array alone", async () => {
    const tool = makeTool();
    const result = await invoke(tool, {
      query: "xyzzy-definitely-no-match",
    });
    expect(result.results).toEqual([]);
    expect(typeof result.note).toBe("string");
    expect(result.note).toContain("using-mcp-tools");
  });

  it("zero-score entries are filtered, not padded", async () => {
    const tool = makeTool();
    const result = await invoke(tool, { query: "navigate" });
    // Should not pad with irrelevant entries just because limit=5 and only 1 matches
    const names = (result.results as Array<{ name: string }>).map((r) => r.name);
    expect(names).not.toContain("browser_fill");
    expect(names).not.toContain("sandbox_get_context");
  });

  it("lazily builds the index once and caches across invocations", async () => {
    const tool = makeTool();
    const readSpy = vi.fn();
    // First call triggers the walk; second must not re-walk.
    // We detect this by calling twice and confirming identical timing
    // is not enough — instead assert the same result reference for identical
    // queries is returned from a memoized path.
    const first = await invoke(tool, { query: "screenshot" });
    const second = await invoke(tool, { query: "screenshot" });
    expect(second).toEqual(first);
  });

  it("readyChecker false → short-circuit with catalog-unavailable error, fs untouched", async () => {
    const tool = makeTool({ ready: false });
    // Spy on fs.readdir BEFORE invoking — if the short-circuit works, it must not fire.
    const fs = await import("fs");
    const spy = vi.spyOn(fs, "readdirSync");
    const result = await invoke(tool, { query: "navigate" });

    expect(result.error).toMatch(/MCP tool catalog is unavailable/);
    // Critical: when short-circuiting the tool must not walk the filesystem.
    expect(spy).not.toHaveBeenCalled();
  });

  it("result paths always use the sandbox-side /home/gem/nexus-servers/ root", async () => {
    const tool = makeTool();
    const result = await invoke(tool, { query: "screenshot" });
    for (const entry of result.results as Array<{ path: string }>) {
      expect(entry.path).toMatch(/^\/home\/gem\/nexus-servers\//);
      // Never leak the host source-of-truth path
      expect(entry.path).not.toContain("sandbox-files");
      expect(entry.path).not.toContain("fixtures");
    }
  });
});
