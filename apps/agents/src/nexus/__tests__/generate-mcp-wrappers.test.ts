import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, existsSync, mkdtempSync, rmSync, readdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import fixture from "./fixtures/mcp-tools-manifest.json" with { type: "json" };
import { generateWrappers } from "../../../scripts/generate-mcp-wrappers.js";

function makeTempRoot(): string {
  return mkdtempSync(join(tmpdir(), "nexus-mcp-wrappers-"));
}

// The fixture has 7 tools — one is a deliberately invalid oneOf schema.
const validTools = fixture.tools.filter((t) => !t.name.includes("bad_union"));
const badTool = fixture.tools.find((t) => t.name === "chrome_devtools_bad_union")!;

describe("generate-mcp-wrappers", () => {
  let outputRoot: string;

  beforeEach(() => {
    outputRoot = makeTempRoot();
  });

  it("emits six files across three namespace subdirs", () => {
    generateWrappers({ tools: validTools, outputRoot });

    expect(readdirSync(join(outputRoot, "chrome_devtools")).sort()).toEqual([
      "navigate.js",
      "take_screenshot.js",
    ]);
    expect(readdirSync(join(outputRoot, "browser")).sort()).toEqual([
      "click.js",
      "fill.js",
    ]);
    expect(readdirSync(join(outputRoot, "sandbox")).sort()).toEqual([
      "convert_to_markdown.js",
      "get_context.js",
    ]);
  });

  it("strips the namespace prefix from the filename", () => {
    generateWrappers({ tools: validTools, outputRoot });
    expect(existsSync(join(outputRoot, "chrome_devtools/chrome_devtools_navigate.js"))).toBe(false);
    expect(existsSync(join(outputRoot, "chrome_devtools/navigate.js"))).toBe(true);
  });

  it("emits an exported async function named after the tool", () => {
    generateWrappers({ tools: validTools, outputRoot });
    const body = readFileSync(join(outputRoot, "chrome_devtools/navigate.js"), "utf-8");
    expect(body).toMatch(/export async function chromeDevtoolsNavigate\(/);
    expect(body).toMatch(/return callMCPTool\("chrome_devtools_navigate",/);
  });

  it("emits a JSDoc @typedef with required + optional argument docs", () => {
    generateWrappers({ tools: validTools, outputRoot });
    const body = readFileSync(join(outputRoot, "chrome_devtools/navigate.js"), "utf-8");
    expect(body).toContain("@typedef {object} ChromeDevtoolsNavigateInput");
    expect(body).toContain("@property {string} url");
    expect(body).toContain("@property {\"load\"|\"domcontentloaded\"|\"networkidle\"} [wait_until]");
    expect(body).toContain("Absolute URL to navigate to.");
  });

  it("renders enum properties as union literals", () => {
    generateWrappers({ tools: validTools, outputRoot });
    const body = readFileSync(join(outputRoot, "chrome_devtools/navigate.js"), "utf-8");
    expect(body).toMatch(/\"load\"\|\"domcontentloaded\"\|\"networkidle\"/);
  });

  it("renders the tool description in the leading JSDoc block", () => {
    generateWrappers({ tools: validTools, outputRoot });
    const body = readFileSync(join(outputRoot, "browser/click.js"), "utf-8");
    expect(body).toContain("Click an element by index from the last snapshot.");
  });

  it("is idempotent — running twice produces byte-identical output", () => {
    generateWrappers({ tools: validTools, outputRoot });
    const before = readFileSync(join(outputRoot, "browser/fill.js"), "utf-8");
    generateWrappers({ tools: validTools, outputRoot });
    const after = readFileSync(join(outputRoot, "browser/fill.js"), "utf-8");
    expect(after).toBe(before);
  });

  it("deletes files for tools that no longer exist upstream", () => {
    generateWrappers({ tools: validTools, outputRoot });
    expect(existsSync(join(outputRoot, "browser/click.js"))).toBe(true);

    const withoutClick = validTools.filter((t) => t.name !== "browser_click");
    generateWrappers({ tools: withoutClick, outputRoot });
    expect(existsSync(join(outputRoot, "browser/click.js"))).toBe(false);
    expect(existsSync(join(outputRoot, "browser/fill.js"))).toBe(true);
  });

  it("imports callMCPTool from the shared _client module", () => {
    generateWrappers({ tools: validTools, outputRoot });
    const body = readFileSync(join(outputRoot, "sandbox/get_context.js"), "utf-8");
    expect(body).toContain('import { callMCPTool } from "../_client/callMCPTool.js"');
  });

  it("throws with a useful message when it encounters an unsupported schema", () => {
    expect(() =>
      generateWrappers({ tools: [badTool], outputRoot }),
    ).toThrow(/chrome_devtools_bad_union.*oneOf/);
  });
});
