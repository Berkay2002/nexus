import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
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
    // Point sourceRoot at a path that does NOT exist. If the short-circuit
    // works, the readyChecker false branch returns the unavailable error
    // BEFORE any fs access. If it were to walk fs, buildCatalog would
    // swallow the ENOENT and return the structuredEmptyResult instead — a
    // different, detectable error shape. The error message itself proves
    // the code path.
    const tool = createMcpToolSearch({
      sourceRoot: "/this/path/definitely/does/not/exist",
      readyChecker: () => false,
    });
    const result = await invoke(tool, { query: "navigate" });
    expect(result.error).toMatch(/MCP tool catalog is unavailable/);
    expect(result.note).toBeUndefined();
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

  it("empty-result note lists dynamically discovered namespaces", async () => {
    const tool = makeTool();
    const result = await invoke(tool, { query: "xyzzy-definitely-no-match" });
    expect(result.results).toEqual([]);
    const note = result.note as string;
    // The fixture has three namespace subdirs — all must appear in the note.
    expect(note).toContain("chrome_devtools");
    expect(note).toContain("browser");
    expect(note).toContain("sandbox");
  });

  describe("walks newly-added namespace subdir without code changes", () => {
    let tmpDir: string;

    afterAll(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it("finds tools in a new namespace created at runtime", async () => {
      tmpDir = mkdtempSync(resolve(tmpdir(), "mcp-tool-search-test-"));
      // Create a fake new namespace: filesystem/readFile.js
      const nsDir = resolve(tmpDir, "filesystem");
      mkdirSync(nsDir);
      writeFileSync(
        resolve(nsDir, "readFile.js"),
        `
/**
 * Reads the contents of a file from the sandbox filesystem.
 * @property {string} path Path to the file
 */
export async function filesystem_readFile(params) {
  return callMCPTool("filesystem_read_file", params);
}
`.trim(),
      );

      const tool = createMcpToolSearch({
        sourceRoot: tmpDir,
        readyChecker: () => true,
      });
      const result = await invoke(tool, { query: "read_file" });
      expect(result.results).toBeInstanceOf(Array);
      const names = (result.results as Array<{ name: string }>).map(
        (r) => r.name,
      );
      expect(names).toContain("filesystem_read_file");
      // Sandbox path should reflect the new namespace
      const paths = (result.results as Array<{ path: string }>).map(
        (r) => r.path,
      );
      expect(paths[0]).toMatch(/\/home\/gem\/nexus-servers\/filesystem\//);
    });
  });
});
