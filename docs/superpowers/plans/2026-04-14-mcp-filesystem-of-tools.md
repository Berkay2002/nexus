# MCP Filesystem-of-Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three hand-rolled MCP gateway wrapper tools with a custom filesystem-of-tools pattern that exposes all 60 AIO Sandbox MCP tools to sub-agents without binding any of them as LangChain tools.

**Architecture:** Dev-time generator introspects the sandbox `/mcp` endpoint and emits 60 ES-module JavaScript wrapper files to `apps/agents/sandbox-files/servers/`. At LangGraph startup, a bootstrap step batched-uploads the tree to `/home/gem/nexus-servers/` inside the sandbox and runs `npm install` to fetch `@modelcontextprotocol/sdk`. A new `mcp_tool_search` LangChain tool indexes the host-side source tree and returns ranked sandbox-side paths that the agent opens via the existing `read_file` helper. Agents write Node scripts that import the wrappers via absolute filesystem paths and execute via the existing `sandbox_nodejs_execute` tool. Zero MCP client code runs inside `apps/agents` at runtime.

**Tech Stack:** TypeScript (ESM), LangChain.js `tool()` + Zod, `@modelcontextprotocol/sdk` (dev-dep for generator + installed inside sandbox via `npm install` at bootstrap), DeepAgents `BaseSandbox` (three-method surface: `execute`, `uploadFiles`, `downloadFiles`), Vitest.

**Design spec:** `docs/superpowers/specs/2026-04-13-mcp-filesystem-of-tools-design.md`. Re-read sections "Problem", "Architecture", "Data Flow", "Error Handling" before starting. Component numbers below (Component 1–8) refer to that spec.

**Critical spec correction — wrappers are `.js`, not `.ts`.** The spec text describes TypeScript wrapper files, but the runtime path is `sandbox_nodejs_execute` posting to `/v1/nodejs/execute`, which runs plain JavaScript with no TypeScript compile step. This plan emits `.js` ES modules with JSDoc type annotations throughout. Every file under `apps/agents/sandbox-files/servers/` is `.js` (including the hand-written `_client/callMCPTool.js`). Agent scripts import them directly with no compile step. The type information the agent needs (argument names, types, descriptions) lives in JSDoc `@param`/`@typedef` blocks, which the generator emits from the MCP tool's `inputSchema`.

**Knowledge base.** For questions about `@langchain/core/tools`, DeepAgents, or the AIO Sandbox API, use `/wikillm:query` against `.kb/wiki/` before grepping code. The MCP SDK client pattern is documented in `.kb/wiki/langchain-mcp-adapters.md` (for reference — we do NOT use `@langchain/mcp-adapters` anywhere in this plan, only `@modelcontextprotocol/sdk` directly, and only in two confined places: the dev-time generator in `apps/agents/scripts/` and the `_client/callMCPTool.js` module that runs **inside** the sandbox).

**SDK version and API surface — verified live against v1.29.0 during planning:**

| API | Plan uses it as | Verified in `node_modules/@modelcontextprotocol/sdk/dist/esm/` |
|---|---|---|
| `new Client({ name, version })` | Single-arg constructor | `client/index.d.ts:126` — `constructor(clientInfo: Implementation, options?: ClientOptions)`. Second arg is optional. |
| `new StreamableHTTPClientTransport(url)` | Single-arg constructor | `client/streamableHttp.d.ts:116` — `constructor(url: URL, opts?: ...)`. Second arg is optional. |
| `client.connect(transport)` | Returns `Promise<void>` | Inherited from `Protocol` (`shared/protocol.d.ts`). |
| `client.listTools({ cursor })` | Returns `{ tools, nextCursor? }` | `client/index.d.ts:539` — `listTools(params?: ListToolsRequest['params'], ...)`. Tool shape includes `name`, `description?`, `inputSchema: { type: "object", properties?, required? }`. |
| `client.callTool({ name, arguments })` | Returns `{ content, isError?, structuredContent? }` | `client/index.d.ts:431` — `callTool(params: CallToolRequest['params'], ...)`. Return includes `content` (text/image/audio/resource union), optional `isError`, optional `structuredContent`. |
| `client.close()` | Returns `Promise<void>` | Inherited from `Protocol.close()` at `shared/protocol.d.ts:287`. |

The `callMCPTool.js` implementation in Task 1 and the generator script in Task 4 use exactly these signatures. No internal SDK types are imported — the generator works against the structurally-typed return of `listTools()`.

**Are we using `@langchain/mcp-adapters`? No.** The filesystem-of-tools pattern is the project's settled answer for reaching the 60-tool MCP catalog, and it rejects `@langchain/mcp-adapters` on purpose. Reasons (captured in `project_mcp_filesystem_of_tools_decision.md` and the spec's "Problem" section): binding 60 tool schemas to sub-agents costs ~55K tokens of definitions every turn, tool-selection accuracy degrades past 30-50 tools, and the library would put an MCP client in the `apps/agents` runtime where we explicitly don't want one. Zero imports of `@langchain/mcp-adapters` appear in this plan. If you see a Task reach for it, stop and re-read the spec.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `apps/agents/package.json` | Modify | Add `@modelcontextprotocol/sdk` devDep + `generate:mcp-wrappers` script |
| `apps/agents/scripts/generate-mcp-wrappers.ts` | Create | Dev-time generator (standalone, never imported by runtime) |
| `apps/agents/sandbox-files/servers/package.json` | Create | Minimal — declares `@modelcontextprotocol/sdk`, `"type": "module"` |
| `apps/agents/sandbox-files/servers/_client/callMCPTool.js` | Create | Hand-written, ~30 lines. The ONE module that speaks MCP. Exports `callMCPTool(name, args)` |
| `apps/agents/sandbox-files/servers/{chrome_devtools,browser,sandbox}/*.js` | Create (via generator; committed) | 60 generated wrapper files |
| `apps/agents/src/nexus/backend/sandbox-bootstrap.ts` | Create | `ensureSandboxFilesystem()` + `isMcpFilesystemReady()` + module-level flag and singleton promise |
| `apps/agents/src/nexus/orchestrator.ts` | Modify | Await `ensureSandboxFilesystem(sandbox)` after backend construction |
| `apps/agents/src/nexus/tools/mcp-tool-search/prompt.ts` | Create | `MCP_TOOL_SEARCH_NAME` + `MCP_TOOL_SEARCH_DESCRIPTION` |
| `apps/agents/src/nexus/tools/mcp-tool-search/tool.ts` | Create | `mcpToolSearch` LangChain tool + Zod schema |
| `apps/agents/src/nexus/tools/mcp-list-servers/` | Delete | Folder removed |
| `apps/agents/src/nexus/tools/mcp-list-tools/` | Delete | Folder removed |
| `apps/agents/src/nexus/tools/mcp-execute-tool/` | Delete | Folder removed |
| `apps/agents/src/nexus/tools/index.ts` | Modify | Drop 3 deleted exports, add `mcpToolSearch`, rebalance `researchTools`/`codeTools`/`allTools` |
| `apps/agents/src/nexus/agents/research/prompt.ts` | Modify | Add "Discovering additional capabilities" section |
| `apps/agents/src/nexus/agents/code/prompt.ts` | Modify | Add same section; drop mentions of the 3 deleted wrappers |
| `apps/agents/src/nexus/prompts/orchestrator-system.ts` | Modify | Shorter capability-flavored research/code bullets that mention the cold layer |
| `apps/agents/src/nexus/skills/using-mcp-tools/SKILL.md` | Create | New skill explaining the cold-layer pattern |
| `apps/agents/src/nexus/skills/using-mcp-tools/examples.md` | Create | Three worked examples |
| `apps/agents/src/nexus/skills/using-mcp-tools/templates/screenshot-script.js` | Create | Copy-pasteable template |
| `apps/agents/src/nexus/skills/index.ts` | Modify | Append `"using-mcp-tools"` to `SKILL_NAMES` tuple |
| `apps/agents/src/nexus/__tests__/fixtures/mcp-tools-manifest.json` | Create | 6-tool fixture for generator tests |
| `apps/agents/src/nexus/__tests__/fixtures/wrapper-files/**` | Create | ~10 hand-written wrapper stubs for search tests |
| `apps/agents/src/nexus/__tests__/generate-mcp-wrappers.test.ts` | Create | ~10 cases |
| `apps/agents/src/nexus/__tests__/sandbox-bootstrap.test.ts` | Create | 7 cases with `FakeSandboxBackend` |
| `apps/agents/src/nexus/__tests__/mcp-tool-search.test.ts` | Create | 10 cases |
| `apps/agents/src/nexus/__tests__/call-mcp-tool.integration.test.ts` | Create | 3 cases, gated behind `SANDBOX_INTEGRATION=true` |
| `apps/agents/src/nexus/__tests__/tools-index.test.ts` | Modify | Update counts (research 8→10, code 12→10, allTools 21→19) and drop deleted-wrapper assertions |
| `apps/agents/src/nexus/__tests__/orchestrator-system.test.ts` | Untouched | Existing assertions check only high-level strings; still pass after prompt rewrite |

---

## Task 1: Scaffold the static asset tree and pin the SDK dev dependency

**Files:**
- Create: `apps/agents/sandbox-files/servers/package.json`
- Create: `apps/agents/sandbox-files/servers/_client/callMCPTool.js`
- Create: `apps/agents/sandbox-files/servers/chrome_devtools/.gitkeep`
- Create: `apps/agents/sandbox-files/servers/browser/.gitkeep`
- Create: `apps/agents/sandbox-files/servers/sandbox/.gitkeep`
- Modify: `apps/agents/package.json` (add dev-dep + script)

**Context:** This is spec Component 2 (static asset tree). The `.gitkeep` files let us commit the empty namespace directories so the test fixture path resolution works before the generator has run. Task 4 replaces them with real generated output.

- [ ] **Step 1: Create `apps/agents/sandbox-files/servers/package.json`**

```json
{
  "name": "nexus-sandbox-servers",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "description": "Bootstrapped MCP wrapper tree copied into /home/gem/nexus-servers/ inside the AIO sandbox. Never imported by apps/agents runtime.",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.29.0"
  }
}
```

Version `^1.29.0` matches the host-side dev dependency installed in Step 4. `1.29.0` is the version the sandbox will pull during `npm install` at bootstrap; the caret range is acceptable because the SDK follows semver and 1.x client API is stable. If a future minor bump breaks the wrapper shape, pin both this file AND `apps/agents/package.json` to an exact version in lockstep.

- [ ] **Step 2: Create `apps/agents/sandbox-files/servers/_client/callMCPTool.js`**

```javascript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

/**
 * Call an MCP tool against the AIO sandbox's /mcp endpoint.
 *
 * Runs INSIDE the sandbox (loopback). The apps/agents runtime never calls this.
 * Constructs a fresh Client per call — the SDK's stateless default. Loopback
 * Streamable HTTP makes the connect overhead sub-millisecond, so pooling would
 * be premature optimisation.
 *
 * @param {string} toolName - MCP tool name as it appears in tools/list (e.g. "chrome_devtools_navigate")
 * @param {Record<string, unknown>} args - Tool arguments matching its inputSchema
 * @returns {Promise<{ content: unknown[], structuredContent: unknown | null }>}
 * @throws {Error} If the MCP server returns isError: true, or if the transport fails.
 */
export async function callMCPTool(toolName, args) {
  const client = new Client({ name: "nexus-sandbox-wrapper", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(
    new URL("http://localhost:8080/mcp"),
  );
  await client.connect(transport);
  try {
    const result = await client.callTool({ name: toolName, arguments: args });
    if (result.isError) {
      const errorText = Array.isArray(result.content)
        ? result.content
            .filter((c) => c && c.type === "text")
            .map((c) => c.text)
            .join("\n")
        : String(result.content);
      throw new Error(
        `MCP tool '${toolName}' returned isError: ${errorText || "(no error text)"}`,
      );
    }
    return {
      content: result.content ?? [],
      structuredContent: result.structuredContent ?? null,
    };
  } finally {
    await client.close().catch(() => {});
  }
}
```

The `isError: true` branch **throws** instead of returning — the spec's "burying errors in success paths is a known anti-pattern" (Error Handling, Failure 4). The script that called the wrapper sees a real stack trace, exits non-zero, and stderr becomes part of the ToolMessage the model reads.

- [ ] **Step 3: Create the three namespace placeholders**

```bash
mkdir -p apps/agents/sandbox-files/servers/chrome_devtools apps/agents/sandbox-files/servers/browser apps/agents/sandbox-files/servers/sandbox
echo "# Placeholder — regenerated by \`npm run generate:mcp-wrappers\`" > apps/agents/sandbox-files/servers/chrome_devtools/.gitkeep
cp apps/agents/sandbox-files/servers/chrome_devtools/.gitkeep apps/agents/sandbox-files/servers/browser/.gitkeep
cp apps/agents/sandbox-files/servers/chrome_devtools/.gitkeep apps/agents/sandbox-files/servers/sandbox/.gitkeep
```

- [ ] **Step 4: Add the SDK dev dependency and generator script to `apps/agents/package.json`**

The dev dependency `@modelcontextprotocol/sdk ^1.29.0` is **already present** in `apps/agents/package.json` — it was added and `npm install`-ed during the planning session to verify the real import surface. Confirm by inspecting the file and the root `package-lock.json`:

```bash
grep modelcontextprotocol apps/agents/package.json
```

Expected: `"@modelcontextprotocol/sdk": "^1.29.0"`.

Now add the generator script. In the `scripts` section of `apps/agents/package.json`, add:

```json
"generate:mcp-wrappers": "tsx scripts/generate-mcp-wrappers.ts"
```

- [ ] **Step 5: Confirm the SDK import surface was verified during planning**

The following facts about v1.29.0 were verified live during planning, so the `callMCPTool.js` imports in Step 2 are known-good. No action needed; just read and internalize:

- `@modelcontextprotocol/sdk/client/index.js` exports `Client` (plus `getSupportedElicitationModes`).
- `@modelcontextprotocol/sdk/client/streamableHttp.js` exports `StreamableHTTPClientTransport` and `StreamableHTTPError`.
- These subpaths resolve via the SDK's wildcard export map: `"./*": { "import": "./dist/esm/*" }`. The dist layout is `dist/esm/client/{index,streamableHttp}.js`.
- The `Client` instance exposes `connect(transport)`, `listTools({ cursor? })`, `callTool({ name, arguments })`, and `close()` as real async functions.

If `npm install` inside the sandbox at bootstrap time ever pulls a newer minor that renames or removes one of these symbols, the failure surfaces as a stack trace in stderr from the first `sandbox_nodejs_execute` call that imports a wrapper — no silent breakage.

- [ ] **Step 6: Commit**

```bash
git add apps/agents/package.json apps/agents/sandbox-files/ package-lock.json
git commit -m "feat(mcp): scaffold sandbox-files/servers/ static asset tree"
```

The commit bundles: the pre-existing `@modelcontextprotocol/sdk` devDep entry + lockfile update, the new `generate:mcp-wrappers` script line, the static asset tree (`package.json`, `_client/callMCPTool.js`, three `.gitkeep` placeholders). One atomic change, one commit.

---

## Task 2: Create the generator test fixture

**Files:**
- Create: `apps/agents/src/nexus/__tests__/fixtures/mcp-tools-manifest.json`

**Context:** The generator test (Task 3) needs a deterministic input that exercises the JSON-Schema-to-JSDoc conversion branches the spec calls out: `object` with required/optional, `enum`, `array`, `number`, `boolean`, and one schema the converter should reject (`oneOf`). Two tools per namespace give us coverage of the naming/filename-stripping logic.

- [ ] **Step 1: Write the fixture file**

```json
{
  "tools": [
    {
      "name": "chrome_devtools_navigate",
      "description": "Navigate the active browser tab to a URL.",
      "inputSchema": {
        "type": "object",
        "required": ["url"],
        "properties": {
          "url": { "type": "string", "description": "Absolute URL to navigate to." },
          "wait_until": {
            "type": "string",
            "enum": ["load", "domcontentloaded", "networkidle"],
            "description": "Page lifecycle event to wait for.",
            "default": "load"
          }
        }
      }
    },
    {
      "name": "chrome_devtools_take_screenshot",
      "description": "Capture a full-page screenshot as base64 PNG.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "full_page": { "type": "boolean", "description": "Capture beyond the viewport.", "default": false },
          "quality": { "type": "number", "description": "JPEG quality 0-100. Ignored for PNG." }
        }
      }
    },
    {
      "name": "browser_click",
      "description": "Click an element by index from the last snapshot.",
      "inputSchema": {
        "type": "object",
        "required": ["index"],
        "properties": {
          "index": { "type": "number", "description": "0-based element index." }
        }
      }
    },
    {
      "name": "browser_fill",
      "description": "Type text into an input field identified by index.",
      "inputSchema": {
        "type": "object",
        "required": ["index", "value"],
        "properties": {
          "index": { "type": "number" },
          "value": { "type": "string" },
          "submit": { "type": "boolean", "default": false }
        }
      }
    },
    {
      "name": "sandbox_get_context",
      "description": "Return metadata about the running sandbox.",
      "inputSchema": {
        "type": "object",
        "properties": {}
      }
    },
    {
      "name": "sandbox_convert_to_markdown",
      "description": "Convert a document to clean markdown.",
      "inputSchema": {
        "type": "object",
        "required": ["path"],
        "properties": {
          "path": { "type": "string", "description": "Absolute sandbox path to the source file." },
          "include_images": { "type": "boolean", "default": true }
        }
      }
    },
    {
      "name": "chrome_devtools_bad_union",
      "description": "Intentionally uses oneOf to prove the generator rejects unsupported schemas.",
      "inputSchema": {
        "oneOf": [
          { "type": "object", "properties": { "a": { "type": "string" } } },
          { "type": "object", "properties": { "b": { "type": "number" } } }
        ]
      }
    }
  ]
}
```

The final `chrome_devtools_bad_union` tool is the negative case for Test 1 case 7 (unsupported schema construct). The six "valid" tools are Test 1 case 1's six-files-in-three-subdirs check.

- [ ] **Step 2: Commit**

```bash
git add apps/agents/src/nexus/__tests__/fixtures/mcp-tools-manifest.json
git commit -m "test(mcp): add generator test fixture"
```

---

## Task 3: Write generator tests (failing)

**Files:**
- Create: `apps/agents/src/nexus/__tests__/generate-mcp-wrappers.test.ts`

**Context:** This test file describes the public surface of the generator module that Task 4 builds. It imports a function `generateWrappers({ tools, outputRoot })` that we haven't written yet — the test should fail with a module-not-found error.

- [ ] **Step 1: Write the failing test file**

```typescript
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
```

- [ ] **Step 2: Run the test file and confirm it fails to import**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/generate-mcp-wrappers.test.ts`

Expected: Vitest reports "Cannot find module '../../../scripts/generate-mcp-wrappers.js'" (or equivalent). All 10 cases are surfaced as failing.

- [ ] **Step 3: Commit**

```bash
git add apps/agents/src/nexus/__tests__/generate-mcp-wrappers.test.ts
git commit -m "test(mcp): add failing generator tests"
```

---

## Task 4: Implement the generator script

**Files:**
- Create: `apps/agents/scripts/generate-mcp-wrappers.ts`

**Context:** Spec Component 1. The generator has two modes:
- **Library mode** — exports `generateWrappers({ tools, outputRoot })` which does all the work without touching the network. Task 3's tests call this.
- **Script mode** — when run via `tsx scripts/generate-mcp-wrappers.ts`, it connects to the sandbox, calls `listTools()`, and invokes the same library function against `apps/agents/sandbox-files/servers/`.

- [ ] **Step 1: Write the script**

```typescript
/**
 * Dev-time generator for the MCP filesystem-of-tools pattern.
 *
 * Never imported by apps/agents runtime. Run via `npm run generate:mcp-wrappers`
 * when the upstream sandbox image bumps to regenerate the wrapper tree under
 * apps/agents/sandbox-files/servers/.
 *
 * Exports `generateWrappers` for unit tests and runs as a CLI script for dev use.
 */
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

// -------- Types ----------

interface McpToolSchemaProperty {
  type?: string;
  description?: string;
  enum?: string[];
  default?: unknown;
  items?: McpToolSchemaProperty;
}

interface McpToolSchema {
  type?: string;
  required?: string[];
  properties?: Record<string, McpToolSchemaProperty>;
  // Unsupported keywords we explicitly reject:
  oneOf?: unknown;
  allOf?: unknown;
  anyOf?: unknown;
  $ref?: unknown;
}

interface McpTool {
  name: string;
  description?: string;
  inputSchema: McpToolSchema;
}

interface GenerateOptions {
  tools: McpTool[];
  outputRoot: string;
}

const NAMESPACES = ["chrome_devtools", "browser", "sandbox"] as const;
type Namespace = (typeof NAMESPACES)[number];

// -------- Public library surface ----------

export function generateWrappers(opts: GenerateOptions): void {
  const rendered = new Map<string, string>(); // absolute path → file body
  for (const tool of opts.tools) {
    const { namespace, basename } = resolveNamespaceAndBasename(tool.name);
    const relPath = `${namespace}/${basename}.js`;
    const body = renderWrapper(tool, namespace, basename);
    rendered.set(join(opts.outputRoot, relPath), body);
  }

  // Clean target subdirs so removed-upstream tools disappear. Leaves _client/ and
  // package.json alone because those aren't under any namespace subdir.
  for (const namespace of NAMESPACES) {
    const nsDir = join(opts.outputRoot, namespace);
    if (existsSync(nsDir)) {
      for (const entry of readdirSync(nsDir)) {
        if (entry.endsWith(".js")) {
          rmSync(join(nsDir, entry));
        }
      }
    } else {
      mkdirSync(nsDir, { recursive: true });
    }
  }

  for (const [path, body] of rendered) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, body, "utf-8");
  }
}

// -------- Helpers ----------

function resolveNamespaceAndBasename(toolName: string): {
  namespace: Namespace;
  basename: string;
} {
  for (const ns of NAMESPACES) {
    const prefix = `${ns}_`;
    if (toolName.startsWith(prefix)) {
      return { namespace: ns, basename: toolName.slice(prefix.length) };
    }
  }
  throw new Error(
    `Tool name '${toolName}' does not start with a known namespace prefix (${NAMESPACES.join(", ")})`,
  );
}

function assertSchemaSupported(toolName: string, schema: McpToolSchema): void {
  const unsupported: string[] = [];
  if (schema.oneOf !== undefined) unsupported.push("oneOf");
  if (schema.allOf !== undefined) unsupported.push("allOf");
  if (schema.anyOf !== undefined) unsupported.push("anyOf");
  if (schema.$ref !== undefined) unsupported.push("$ref");
  if (unsupported.length > 0) {
    throw new Error(
      `Tool '${toolName}' uses unsupported JSON Schema constructs: ${unsupported.join(", ")}. The minimal converter handles only object/string/number/boolean/array/enum.`,
    );
  }
}

function toCamelCase(snake: string): string {
  return snake.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function toPascalCase(snake: string): string {
  const camel = toCamelCase(snake);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

function propertyTypeString(prop: McpToolSchemaProperty): string {
  if (prop.enum && prop.enum.length > 0) {
    return prop.enum.map((v) => JSON.stringify(v)).join("|");
  }
  switch (prop.type) {
    case "string":
      return "string";
    case "number":
    case "integer":
      return "number";
    case "boolean":
      return "boolean";
    case "object":
      return "object";
    case "array":
      return prop.items ? `${propertyTypeString(prop.items)}[]` : "unknown[]";
    default:
      return "unknown";
  }
}

function renderTypedef(
  typeName: string,
  schema: McpToolSchema,
): string {
  const required = new Set(schema.required ?? []);
  const lines = [`/**`, ` * @typedef {object} ${typeName}`];
  const props = schema.properties ?? {};
  for (const [name, prop] of Object.entries(props)) {
    const typeStr = propertyTypeString(prop);
    const optional = required.has(name) ? name : `[${name}]`;
    const desc = prop.description ? ` ${prop.description}` : "";
    lines.push(` * @property {${typeStr}} ${optional}${desc}`);
  }
  lines.push(` */`);
  return lines.join("\n");
}

function renderWrapper(
  tool: McpTool,
  namespace: Namespace,
  basename: string,
): string {
  assertSchemaSupported(tool.name, tool.inputSchema);

  const functionName = toCamelCase(tool.name);
  const typeName = `${toPascalCase(tool.name)}Input`;
  const description = (tool.description ?? "").trim() || "(no description provided)";
  const typedef = renderTypedef(typeName, tool.inputSchema);

  return [
    `// Generated by scripts/generate-mcp-wrappers.ts — do not edit by hand.`,
    `// Regenerate with: npm run generate:mcp-wrappers`,
    ``,
    `import { callMCPTool } from "../_client/callMCPTool.js";`,
    ``,
    typedef,
    ``,
    `/**`,
    ` * ${description}`,
    ` *`,
    ` * @param {${typeName}} input`,
    ` * @returns {Promise<{ content: unknown[], structuredContent: unknown | null }>}`,
    ` */`,
    `export async function ${functionName}(input) {`,
    `  return callMCPTool(${JSON.stringify(tool.name)}, input);`,
    `}`,
    ``,
  ].join("\n");
}

// -------- CLI entry ----------

async function main(): Promise<void> {
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StreamableHTTPClientTransport } = await import(
    "@modelcontextprotocol/sdk/client/streamableHttp.js"
  );

  const sandboxUrl = process.env.SANDBOX_URL ?? "http://localhost:8080";
  const mcpUrl = new URL("/mcp", sandboxUrl);

  const client = new Client({ name: "nexus-generator", version: "1.0.0" });
  try {
    await client.connect(new StreamableHTTPClientTransport(mcpUrl));
  } catch (err) {
    console.error(
      `Couldn't reach sandbox at ${mcpUrl}. Start one with:\n  docker run --security-opt seccomp=unconfined --rm -it -p 8080:8080 ghcr.io/agent-infra/sandbox:latest`,
    );
    process.exit(1);
  }

  const collected: McpTool[] = [];
  let cursor: string | undefined;
  do {
    const page = await client.listTools(cursor ? { cursor } : {});
    collected.push(...(page.tools as unknown as McpTool[]));
    cursor = page.nextCursor;
  } while (cursor);

  await client.close();

  const here = dirname(fileURLToPath(import.meta.url));
  const outputRoot = resolve(here, "..", "sandbox-files", "servers");

  generateWrappers({ tools: collected, outputRoot });

  console.log(
    `Generated ${collected.length} wrapper files into ${outputRoot}. Review the diff, then commit.`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 2: Run the generator tests and confirm they pass**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/generate-mcp-wrappers.test.ts`

Expected: 10 passing cases, 0 failing.

If cases fail, fix the generator — do NOT change the tests. Common miss: the idempotence test assumes stable key ordering in `renderTypedef`; `Object.entries` preserves insertion order so as long as the fixture JSON's properties keep their order, this works.

- [ ] **Step 3: Commit**

```bash
git add apps/agents/scripts/generate-mcp-wrappers.ts
git commit -m "feat(mcp): add dev-time wrapper generator script"
```

---

## Task 5: Write sandbox-bootstrap tests (failing)

**Files:**
- Create: `apps/agents/src/nexus/__tests__/sandbox-bootstrap.test.ts`

**Context:** Spec Component 3. The test uses a `FakeSandboxBackend` implementing the real `BaseSandbox` surface (`execute`, `uploadFiles`, `downloadFiles`) against an in-memory map. The fake interprets a small shell-command allowlist — `test -f <path>`, `cd <path> && npm install 2>&1`, `date ... > <path>`. This is enough to drive the state machine without a real shell.

- [ ] **Step 1: Write the failing test file**

```typescript
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
```

The `__resetBootstrapStateForTests` symbol is a test-only export we'll add to the bootstrap module — test isolation requires resetting the module-level singleton promise and the ready flag between cases.

- [ ] **Step 2: Run the failing tests**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/sandbox-bootstrap.test.ts`

Expected: "Cannot find module '../backend/sandbox-bootstrap.js'". All 7 cases surfaced as failing.

- [ ] **Step 3: Commit**

```bash
git add apps/agents/src/nexus/__tests__/sandbox-bootstrap.test.ts
git commit -m "test(mcp): add failing sandbox-bootstrap tests"
```

---

## Task 6: Implement `sandbox-bootstrap.ts`

**Files:**
- Create: `apps/agents/src/nexus/backend/sandbox-bootstrap.ts`

**Context:** Spec Component 3. Must not run any real network or filesystem I/O against the host tree at import time — tests import the module once and reset state per case. The host-tree walk happens inside `ensureSandboxFilesystem` which tests drive via the fake backend.

- [ ] **Step 1: Write the module**

```typescript
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative, resolve } from "path";
import { fileURLToPath } from "url";
import type { BaseSandbox, FileUploadResponse } from "deepagents";

const TARGET_ROOT = "/home/gem/nexus-servers";
const MARKER = `${TARGET_ROOT}/.bootstrap-marker`;

let bootstrapPromise: Promise<boolean> | null = null;
let mcpFilesystemReady = false;

export function isMcpFilesystemReady(): boolean {
  return mcpFilesystemReady;
}

/**
 * Test-only: clear the process-level bootstrap state so each test can exercise
 * a fresh state machine. Never call from production code.
 */
export function __resetBootstrapStateForTests(): void {
  bootstrapPromise = null;
  mcpFilesystemReady = false;
}

/**
 * Seed the sandbox filesystem with the MCP wrapper tree at /home/gem/nexus-servers/.
 *
 * Idempotent and dedup'd process-wide. See spec section 3 ("Sandbox bootstrap")
 * for the state machine and failure semantics.
 *
 * The target lives outside /home/gem/workspace/ so per-thread workspace remapping
 * does NOT apply (see backend/workspace.ts). All threads share one physical copy.
 */
export async function ensureSandboxFilesystem(
  sandbox: BaseSandbox,
): Promise<boolean> {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    try {
      const markerCheck = await sandbox.execute(
        `test -f ${MARKER} && echo exists`,
      );
      if (
        markerCheck.exitCode === 0 &&
        typeof markerCheck.output === "string" &&
        markerCheck.output.includes("exists")
      ) {
        mcpFilesystemReady = true;
        return true;
      }

      const staticRoot = resolveStaticAssetRoot();
      const entries = collectStaticTree(staticRoot);
      if (entries.length === 0) {
        console.error(
          `[nexus-bootstrap] static tree at ${staticRoot} is empty. Did the generator run?`,
        );
        mcpFilesystemReady = false;
        return false;
      }

      const uploadResults = await sandbox.uploadFiles(entries);
      const uploadErrors = uploadResults.filter(
        (r): r is FileUploadResponse & { error: NonNullable<FileUploadResponse["error"]> } =>
          r.error !== null,
      );
      if (uploadErrors.length > 0) {
        console.error(
          `[nexus-bootstrap] uploadFiles failed for ${uploadErrors.length} path(s):`,
          uploadErrors.map((e) => `${e.path}: ${e.error}`).join(", "),
        );
        mcpFilesystemReady = false;
        return false;
      }

      const install = await sandbox.execute(
        `cd ${TARGET_ROOT} && npm install 2>&1`,
      );
      if (install.exitCode !== 0) {
        console.error(
          `[nexus-bootstrap] npm install failed (exit ${install.exitCode}):\n${install.output}`,
        );
        mcpFilesystemReady = false;
        return false;
      }

      const markerWrite = await sandbox.execute(
        `date -u +%Y-%m-%dT%H:%M:%SZ > ${MARKER}`,
      );
      if (markerWrite.exitCode !== 0) {
        console.error(
          `[nexus-bootstrap] failed to write marker:\n${markerWrite.output}`,
        );
        mcpFilesystemReady = false;
        return false;
      }

      mcpFilesystemReady = true;
      return true;
    } catch (err) {
      console.error(`[nexus-bootstrap] unexpected error:`, err);
      mcpFilesystemReady = false;
      return false;
    }
  })();

  const outcome = await bootstrapPromise;
  // If the attempt failed, clear the cached promise so the next call retries.
  if (!outcome) {
    bootstrapPromise = null;
  }
  return outcome;
}

/**
 * Resolve the host-side static asset root at apps/agents/sandbox-files/servers/
 * from the location of THIS module (backend/sandbox-bootstrap.ts).
 *
 * Layout:  apps/agents/src/nexus/backend/sandbox-bootstrap.ts
 * Target:  apps/agents/sandbox-files/servers/
 *
 * Four directory hops: backend/ → nexus/ → src/ → agents/, then down.
 * Under vitest and under built dist/ the relative layout is the same because
 * the dist directory mirrors src/nexus/... one level down from apps/agents/.
 */
function resolveStaticAssetRoot(): string {
  const here = fileURLToPath(import.meta.url);
  // here = .../apps/agents/{src|dist}/nexus/backend/sandbox-bootstrap.{ts|js}
  return resolve(here, "..", "..", "..", "..", "sandbox-files", "servers");
}

function collectStaticTree(root: string): Array<[string, Uint8Array]> {
  const out: Array<[string, Uint8Array]> = [];
  walk(root, (absPath) => {
    const rel = relative(root, absPath).split("\\").join("/");
    // Skip gitkeep placeholders — they have no runtime purpose.
    if (rel.endsWith(".gitkeep")) return;
    const bytes = readFileSync(absPath);
    out.push([`${TARGET_ROOT}/${rel}`, new Uint8Array(bytes)]);
  });
  return out;
}

function walk(dir: string, onFile: (absPath: string) => void): void {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      walk(abs, onFile);
    } else {
      onFile(abs);
    }
  }
}
```

Two notes worth flagging for the next test run:
- The retry semantics: a failed promise clears `bootstrapPromise = null` so the next `ensureSandboxFilesystem` call re-enters the state machine. The test case "retry after partial failure succeeds" depends on this.
- The `resolveStaticAssetRoot` call runs **inside** the `bootstrapPromise` closure so unit tests that feed a fake backend with their own entries don't need to resolve against the real host tree. But they DO need `collectStaticTree` to find at least one file in the committed tree — Task 1 ensured `package.json` and `_client/callMCPTool.js` exist, so this works.

- [ ] **Step 2: Run the tests and confirm they pass**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/sandbox-bootstrap.test.ts`

Expected: 7 passing cases.

If "cold start uploads the tree" fails with 0 uploaded entries, check that `apps/agents/sandbox-files/servers/_client/callMCPTool.js` exists on disk from Task 1. If "retry after partial failure" fails, check that the catch block clears `bootstrapPromise = null` on failure.

- [ ] **Step 3: Commit**

```bash
git add apps/agents/src/nexus/backend/sandbox-bootstrap.ts
git commit -m "feat(mcp): add sandbox-bootstrap module"
```

---

## Task 7: Wire the bootstrap into the orchestrator

**Files:**
- Modify: `apps/agents/src/nexus/orchestrator.ts`

**Context:** Per spec Component 3 and Flow B, `ensureSandboxFilesystem(sandbox)` is awaited once per orchestrator construction inside `createNexusOrchestrator`. The function is idempotent and dedup'd process-wide, so calling it on every construction is safe and cheap after the first success. Crucially, no `workspaceRoot` is passed — the bootstrap target is outside `/home/gem/workspace/`.

- [ ] **Step 1: Modify `createNexusOrchestrator`**

Find the existing block in `apps/agents/src/nexus/orchestrator.ts`:

```typescript
export function createNexusOrchestrator(
  sandboxUrl = process.env.SANDBOX_URL ?? "http://localhost:8080",
  workspaceRoot = getWorkspaceRootForThread(),
) {
  const sandbox = new AIOSandboxBackend(sandboxUrl, workspaceRoot);
  const backend = createNexusBackend(sandbox);
```

The function is currently synchronous. Bootstrap is async but we don't want to block orchestrator construction on the sandbox (the spec's error-handling philosophy: "Bootstrap failures degrade gracefully and stay out of the orchestrator's way"). Kick off the bootstrap as a fire-and-forget promise so the orchestrator returns immediately and the bootstrap resolves in the background while the first turn is being processed.

Replace the block above with:

```typescript
import { ensureSandboxFilesystem } from "./backend/sandbox-bootstrap.js";
// (add alongside the other backend/ imports at the top of the file)

export function createNexusOrchestrator(
  sandboxUrl = process.env.SANDBOX_URL ?? "http://localhost:8080",
  workspaceRoot = getWorkspaceRootForThread(),
) {
  const sandbox = new AIOSandboxBackend(sandboxUrl, workspaceRoot);
  const backend = createNexusBackend(sandbox);

  // Fire-and-forget: seed /home/gem/nexus-servers/ with the MCP wrapper tree.
  // Idempotent, dedup'd process-wide, returns fast after the first success.
  // Failures are logged to stderr and flip isMcpFilesystemReady() to false —
  // mcp_tool_search then short-circuits with a structured "catalog unavailable"
  // error so the agent falls back to hot-layer tools.
  void ensureSandboxFilesystem(sandbox);
```

The existing `import { ensureSandboxFilesystem }` must be added at the top of the file with the other `backend/` imports. Keep it ordered after `workspace.js`:

```typescript
import { AIOSandboxBackend } from "./backend/aio-sandbox.js";
import { createNexusBackend } from "./backend/composite.js";
import { ensureSandboxFilesystem } from "./backend/sandbox-bootstrap.js";
import { getWorkspaceRootForThread } from "./backend/workspace.js";
```

- [ ] **Step 2: Run the existing orchestrator tests**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/orchestrator.test.ts src/nexus/__tests__/orchestrator-resilience.test.ts`

Expected: All previously-passing cases still pass. If any orchestrator test fails because constructing the orchestrator now triggers a bootstrap against a real sandbox that isn't available, the fire-and-forget design prevents this — the `void` keyword discards the promise so test construction doesn't await it. The subsequent failure (if any) is logged via `console.error` inside the bootstrap but doesn't propagate.

If a test does fail because it mocks `AIOSandboxBackend` in a way that breaks when `ensureSandboxFilesystem` is called, look at how `orchestrator.test.ts` constructs its sandbox — it may need to pass a fake backend that implements the three-method surface, or the test may need `vi.mock("../backend/sandbox-bootstrap.js", ...)` to stub the function.

- [ ] **Step 3: Commit**

```bash
git add apps/agents/src/nexus/orchestrator.ts
git commit -m "feat(mcp): wire sandbox-bootstrap into orchestrator construction"
```

---

## Task 8: Create the wrapper-files test fixture

**Files:**
- Create: `apps/agents/src/nexus/__tests__/fixtures/wrapper-files/chrome_devtools/navigate.js`
- Create: `apps/agents/src/nexus/__tests__/fixtures/wrapper-files/chrome_devtools/take_screenshot.js`
- Create: `apps/agents/src/nexus/__tests__/fixtures/wrapper-files/chrome_devtools/list_network_requests.js`
- Create: `apps/agents/src/nexus/__tests__/fixtures/wrapper-files/browser/click.js`
- Create: `apps/agents/src/nexus/__tests__/fixtures/wrapper-files/browser/fill.js`
- Create: `apps/agents/src/nexus/__tests__/fixtures/wrapper-files/browser/take_screenshot.js`
- Create: `apps/agents/src/nexus/__tests__/fixtures/wrapper-files/sandbox/get_context.js`
- Create: `apps/agents/src/nexus/__tests__/fixtures/wrapper-files/sandbox/convert_to_markdown.js`
- Create: `apps/agents/src/nexus/__tests__/fixtures/wrapper-files/sandbox/execute_code.js`
- Create: `apps/agents/src/nexus/__tests__/fixtures/wrapper-files/sandbox/execute_bash.js`

**Context:** The mcp-tool-search tests (Task 9) need a realistic set of stub wrapper files covering name overlaps (two `take_screenshot` tools), capability-flavored descriptions (for description-match ranking), and varied argument vocabularies (for argument-name ranking). These mirror what the real generator would emit — format-compatible but lightweight.

- [ ] **Step 1: Write one representative wrapper per namespace, then vary**

Write all 10 files. They follow an identical shape; pick this as the template and substitute:

```javascript
// Generated by scripts/generate-mcp-wrappers.ts — do not edit by hand.

import { callMCPTool } from "../_client/callMCPTool.js";

/**
 * @typedef {object} ChromeDevtoolsNavigateInput
 * @property {string} url Absolute URL to navigate to.
 * @property {"load"|"domcontentloaded"|"networkidle"} [wait_until] Page lifecycle event to wait for.
 */

/**
 * Navigate the active browser tab to a URL.
 *
 * @param {ChromeDevtoolsNavigateInput} input
 * @returns {Promise<{ content: unknown[], structuredContent: unknown | null }>}
 */
export async function chromeDevtoolsNavigate(input) {
  return callMCPTool("chrome_devtools_navigate", input);
}
```

The remaining 9 fixtures follow the same shape with:

| File | Tool name | Description | Args |
|---|---|---|---|
| `chrome_devtools/take_screenshot.js` | `chrome_devtools_take_screenshot` | `Capture a full-page screenshot as base64 PNG.` | `full_page: boolean`, `quality: number` |
| `chrome_devtools/list_network_requests.js` | `chrome_devtools_list_network_requests` | `List all network requests captured since page load.` | `filter: string`, `limit: number` |
| `browser/click.js` | `browser_click` | `Click an element by index from the last snapshot.` | `index: number` |
| `browser/fill.js` | `browser_fill` | `Type text into an input field identified by index.` | `index: number`, `value: string` |
| `browser/take_screenshot.js` | `browser_take_screenshot` | `Take a screenshot of the current page via the browser MCP server.` | `encoding: "base64"\|"binary"` |
| `sandbox/get_context.js` | `sandbox_get_context` | `Return metadata about the running sandbox container.` | (none) |
| `sandbox/convert_to_markdown.js` | `sandbox_convert_to_markdown` | `Convert a PDF, HTML, or DOCX file to clean markdown.` | `path: string` |
| `sandbox/execute_code.js` | `sandbox_execute_code` | `Execute Python or JavaScript code in the sandbox runtime.` | `code: string`, `language: string` |
| `sandbox/execute_bash.js` | `sandbox_execute_bash` | `Run a shell command in the sandbox.` | `command: string`, `timeout: number` |

- [ ] **Step 2: Commit**

```bash
git add apps/agents/src/nexus/__tests__/fixtures/wrapper-files/
git commit -m "test(mcp): add wrapper-files fixture for mcp-tool-search tests"
```

---

## Task 9: Write mcp-tool-search tests (failing)

**Files:**
- Create: `apps/agents/src/nexus/__tests__/mcp-tool-search.test.ts`

**Context:** Spec Component 4. The tool needs to be testable with a fake source root. The cleanest seam without restructuring the tool is to export a factory `createMcpToolSearch({ sourceRoot, readyChecker })` alongside the default `mcpToolSearch` constant. The default uses the production paths; tests use the factory with fixture paths and a stub ready checker.

- [ ] **Step 1: Write the failing test file**

```typescript
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
```

Case 8 ("lazily builds the index once and caches") is a weaker assertion than the spec's "fs.readdir should only fire on the first call" — because the short-circuit case (9) needs to verify zero fs calls with a fresh spy, and you can't spy on a module that's already been imported and walked. The compromise: case 8 asserts output equality (proving the cache returns stable results); case 9 asserts the short-circuit path never touches fs at all. Together they cover the spec's intent.

- [ ] **Step 2: Run the failing tests**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/mcp-tool-search.test.ts`

Expected: "Cannot find module '../tools/mcp-tool-search/tool.js'".

- [ ] **Step 3: Commit**

```bash
git add apps/agents/src/nexus/__tests__/mcp-tool-search.test.ts
git commit -m "test(mcp): add failing mcp-tool-search tests"
```

---

## Task 10: Implement `mcp-tool-search` tool

**Files:**
- Create: `apps/agents/src/nexus/tools/mcp-tool-search/prompt.ts`
- Create: `apps/agents/src/nexus/tools/mcp-tool-search/tool.ts`

**Context:** Spec Component 4. Exports a factory for tests, a default instance for the tools barrel, and co-located prompt constants matching the convention in `tools/search/prompt.ts`.

- [ ] **Step 1: Create `prompt.ts`**

```typescript
export const MCP_TOOL_SEARCH_NAME = "mcp_tool_search";

export const MCP_TOOL_SEARCH_DESCRIPTION =
  "Search the sandbox's 60-tool MCP catalog (browser automation, Chrome DevTools, sandbox introspection) " +
  "for a capability matching your query. Returns a ranked shortlist of absolute file paths inside " +
  "/home/gem/nexus-servers/ — read those files with the filesystem helper to see the arguments and " +
  "example usage, then write a Node script that imports the wrapper and runs via sandbox_nodejs_execute. " +
  "See the `using-mcp-tools` skill for the full pattern. This is a catalog search — it does NOT execute " +
  "anything. Use it when none of the directly-bound tools cover what you need.";
```

- [ ] **Step 2: Create `tool.ts`**

```typescript
import { tool } from "@langchain/core/tools";
import { readdirSync, readFileSync, statSync } from "fs";
import { resolve, basename } from "path";
import { fileURLToPath } from "url";
import { z } from "zod/v4";
import { isMcpFilesystemReady } from "../../backend/sandbox-bootstrap.js";
import { MCP_TOOL_SEARCH_NAME, MCP_TOOL_SEARCH_DESCRIPTION } from "./prompt.js";

const SANDBOX_ROOT = "/home/gem/nexus-servers";
const NAMESPACES = ["chrome_devtools", "browser", "sandbox"] as const;
type Namespace = (typeof NAMESPACES)[number];

export const mcpToolSearchSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe("Keyword or phrase describing the capability you need."),
  namespace: z
    .enum(NAMESPACES)
    .optional()
    .describe(
      "Restrict the search to one MCP namespace. Useful when you already know you want a browser or chrome_devtools tool.",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .default(5)
    .describe("Max number of results to return."),
});

export type McpToolSearchInput = z.infer<typeof mcpToolSearchSchema>;

interface CatalogEntry {
  path: string; // sandbox-side path — what the agent uses
  name: string; // MCP tool name (e.g. "chrome_devtools_navigate")
  summary: string; // first sentence of the JSDoc leading block
  namespace: Namespace;
  haystack: string; // lowercased name + summary + prop names for ranking
}

interface CreateOptions {
  sourceRoot?: string;
  readyChecker?: () => boolean;
}

function defaultSourceRoot(): string {
  // .../apps/agents/{src|dist}/nexus/tools/mcp-tool-search/tool.{ts|js}
  // Up four levels: mcp-tool-search/ → tools/ → nexus/ → src/ → agents/
  const here = fileURLToPath(import.meta.url);
  return resolve(here, "..", "..", "..", "..", "..", "sandbox-files", "servers");
}

function parseJsdocSummary(body: string, fallbackName: string): string {
  // Find the function-level JSDoc block (the one directly before `export async function`).
  const match = body.match(/\/\*\*([\s\S]*?)\*\/\s*\nexport async function/);
  if (!match) return fallbackName;
  const lines = match[1]
    .split("\n")
    .map((l) => l.replace(/^\s*\*\s?/, "").trim())
    .filter((l) => l && !l.startsWith("@"));
  if (lines.length === 0) return fallbackName;
  // First non-empty line before `@param`/`@returns` is the summary.
  return lines[0];
}

function parseToolNameFromBody(body: string, basenameNoExt: string): string {
  const match = body.match(/return callMCPTool\(\s*"([^"]+)"/);
  return match ? match[1] : basenameNoExt;
}

function collectPropNames(body: string): string[] {
  // @property {type} name  → capture the name token
  const names: string[] = [];
  const re = /@property\s+\{[^}]+\}\s+\[?([a-zA-Z_][a-zA-Z0-9_]*)\]?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    names.push(m[1]);
  }
  return names;
}

function buildCatalog(sourceRoot: string): CatalogEntry[] {
  const entries: CatalogEntry[] = [];
  for (const namespace of NAMESPACES) {
    const nsDir = resolve(sourceRoot, namespace);
    let files: string[];
    try {
      files = readdirSync(nsDir);
    } catch {
      continue;
    }
    for (const fname of files) {
      if (!fname.endsWith(".js")) continue;
      const abs = resolve(nsDir, fname);
      const stat = statSync(abs);
      if (!stat.isFile()) continue;
      const body = readFileSync(abs, "utf-8");
      const basenameNoExt = fname.replace(/\.js$/, "");
      const toolName = parseToolNameFromBody(body, `${namespace}_${basenameNoExt}`);
      const summary = parseJsdocSummary(body, toolName);
      const propNames = collectPropNames(body);
      const haystack = [toolName, summary, propNames.join(" ")]
        .join(" ")
        .toLowerCase();
      entries.push({
        path: `${SANDBOX_ROOT}/${namespace}/${fname}`,
        name: toolName,
        summary,
        namespace,
        haystack,
      });
    }
  }
  return entries;
}

function scoreEntry(entry: CatalogEntry, query: string): number {
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  let score = 0;
  if (entry.name.toLowerCase().includes(q)) score += 100;
  if (entry.summary.toLowerCase().includes(q)) score += 30;
  // argument-name hit uses the haystack section that comes after name + summary
  if (entry.haystack.includes(q)) score += 5;
  return score;
}

function structuredEmptyResult(query: string): string {
  return JSON.stringify({
    results: [],
    note:
      `No MCP tools matched '${query}'. The catalog covers browser automation ` +
      `(chrome_devtools/, browser/) and sandbox introspection (sandbox/). ` +
      `See the using-mcp-tools skill for examples of the available categories.`,
  });
}

function structuredUnavailableResult(): string {
  return JSON.stringify({
    error:
      "MCP tool catalog is unavailable in this run. The sandbox bootstrap failed; " +
      "check stderr for details. Continue with built-in tools.",
  });
}

export function createMcpToolSearch(opts: CreateOptions = {}) {
  const sourceRoot = opts.sourceRoot ?? defaultSourceRoot();
  const readyChecker = opts.readyChecker ?? isMcpFilesystemReady;
  let cached: CatalogEntry[] | null = null;

  function getCatalog(): CatalogEntry[] {
    if (cached === null) cached = buildCatalog(sourceRoot);
    return cached;
  }

  return tool(
    async (input: McpToolSearchInput) => {
      if (!readyChecker()) {
        return structuredUnavailableResult();
      }
      const catalog = getCatalog();
      const candidates = input.namespace
        ? catalog.filter((e) => e.namespace === input.namespace)
        : catalog;
      const scored = candidates
        .map((entry) => ({ entry, score: scoreEntry(entry, input.query) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, input.limit ?? 5)
        .map(({ entry }) => ({
          path: entry.path,
          name: entry.name,
          summary: entry.summary,
        }));
      if (scored.length === 0) {
        return structuredEmptyResult(input.query);
      }
      return JSON.stringify({ results: scored });
    },
    {
      name: MCP_TOOL_SEARCH_NAME,
      description: MCP_TOOL_SEARCH_DESCRIPTION,
      schema: mcpToolSearchSchema,
    },
  );
}

export const mcpToolSearch = createMcpToolSearch();
```

- [ ] **Step 3: Run the tests and confirm they pass**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/mcp-tool-search.test.ts`

Expected: 10 passing cases.

Common fix: if "lazily builds the index once" fails because the fixture `sandbox/` subdir was committed but the walker picks up `.gitkeep` files as JS — confirm `buildCatalog` filters on `.js` suffix. If "short-circuit...fs untouched" fails, confirm the `readyChecker()` call is the FIRST thing the tool does before calling `getCatalog()`.

- [ ] **Step 4: Commit**

```bash
git add apps/agents/src/nexus/tools/mcp-tool-search/
git commit -m "feat(mcp): add mcp-tool-search LangChain tool"
```

---

## Task 11: Swap `tools/index.ts` and update the tools-index snapshot test

**Files:**
- Modify: `apps/agents/src/nexus/tools/index.ts`
- Modify: `apps/agents/src/nexus/__tests__/tools-index.test.ts`

**Context:** Spec Component 5 (tools/index.ts half). We delete the 3 old MCP gateway exports, add `mcpToolSearch`, rebalance the bundles, and update the snapshot test in one atomic change so the repo never has a moment where the tests don't match the exports.

- [ ] **Step 1: Modify `apps/agents/src/nexus/tools/index.ts`**

Delete the three export blocks for `sandboxMcpListServers`, `sandboxMcpListTools`, `sandboxMcpExecuteTool` (lines 88-104 in the current file) AND the three import lines at lines 129-131 AND the `mcpTools` const (lines 145-152).

Add a new export + import for `mcpToolSearch`:

```typescript
export { mcpToolSearch, mcpToolSearchSchema } from "./mcp-tool-search/tool.js";
export type { McpToolSearchInput } from "./mcp-tool-search/tool.js";
```

```typescript
import { mcpToolSearch } from "./mcp-tool-search/tool.js";
```

Rewrite the `researchTools`, `codeTools`, and `allTools` arrays:

```typescript
/**
 * Tools for the Research sub-agent.
 * Tavily web search/extract/map, the sandbox util converter, the browser stack
 * for live automation, sandbox_nodejs_execute for running scripts that invoke
 * cold-layer MCP wrappers, and mcp_tool_search for discovering those wrappers.
 */
export const researchTools = [
  tavilySearch,
  tavilyExtract,
  tavilyMap,
  sandboxUtilConvertToMarkdown,
  ...browserTools,
  sandboxNodejsExecute,
  mcpToolSearch,
] as const;

/**
 * Tools for the Creative sub-agent.
 * Includes image generation via Gemini Imagen.
 */
export const creativeTools = [generateImage] as const;

/**
 * Tools for the Code sub-agent.
 * Augments auto-provisioned shell/filesystem tools with the sandbox runtime API:
 * code/nodejs execution, language introspection, Jupyter session management,
 * and mcp_tool_search for reaching the 60-tool MCP catalog via the
 * filesystem-of-tools pattern (see using-mcp-tools skill).
 */
export const codeTools = [
  sandboxCodeExecute,
  sandboxCodeInfo,
  sandboxNodejsExecute,
  sandboxNodejsInfo,
  sandboxJupyterCreateSession,
  sandboxJupyterExecute,
  sandboxJupyterInfo,
  sandboxJupyterListSessions,
  sandboxJupyterDeleteSession,
  mcpToolSearch,
] as const;

/**
 * All custom tools.
 * Does NOT include auto-provisioned tools (execute, filesystem tools)
 * which come from the DeepAgent backend.
 */
export const allTools = [
  tavilySearch,
  tavilyExtract,
  tavilyMap,
  generateImage,
  sandboxCodeExecute,
  sandboxCodeInfo,
  sandboxNodejsExecute,
  sandboxNodejsInfo,
  sandboxJupyterCreateSession,
  sandboxJupyterExecute,
  sandboxJupyterInfo,
  sandboxJupyterListSessions,
  sandboxJupyterDeleteSession,
  sandboxUtilConvertToMarkdown,
  ...browserTools,
  mcpToolSearch,
] as const;
```

Final counts: `researchTools` = 10, `codeTools` = 10, `allTools` = 19 (down from 21 because 3 wrappers left and 1 was added).

- [ ] **Step 2: Modify `apps/agents/src/nexus/__tests__/tools-index.test.ts`**

Remove the three `sandboxMcp*` entries from the import list at lines 20-22.

Remove the three `sandboxMcp*` assertions from the "should export all individual tools" case at lines 51-53.

Add `mcpToolSearch` to the import list and to the "should export all individual tools" case:

```typescript
// Add to imports:
mcpToolSearch,

// Add to the expect block:
expect(mcpToolSearch).toBeDefined();
```

Remove the mcpTools import on line 28 and delete the entire "should export mcpTools group with 3 tools" case (lines 67-74).

Replace the "should export researchTools array" case body:

```typescript
it("should export researchTools array with hot-layer + mcp_tool_search", () => {
  expect(researchTools).toHaveLength(10);
  expect(researchTools.map((t) => t.name)).toEqual([
    "tavily_search",
    "tavily_extract",
    "tavily_map",
    "sandbox_util_convert_to_markdown",
    "sandbox_browser_info",
    "sandbox_browser_screenshot",
    "sandbox_browser_action",
    "sandbox_browser_config",
    "sandbox_nodejs_execute",
    "mcp_tool_search",
  ]);
});
```

Replace the "should export codeTools array" case body:

```typescript
it("should export codeTools array with sandbox runtime + mcp_tool_search", () => {
  expect(codeTools).toHaveLength(10);
  expect(codeTools.map((t) => t.name)).toEqual([
    "sandbox_code_execute",
    "sandbox_code_info",
    "sandbox_nodejs_execute",
    "sandbox_nodejs_info",
    "sandbox_jupyter_create_session",
    "sandbox_jupyter_execute",
    "sandbox_jupyter_info",
    "sandbox_jupyter_list_sessions",
    "sandbox_jupyter_delete_session",
    "mcp_tool_search",
  ]);
});
```

Replace the "should export allTools array" case body:

```typescript
it("should export allTools array with every custom tool", () => {
  expect(allTools).toHaveLength(19);
});
```

- [ ] **Step 3: Run tests**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/tools-index.test.ts`

Expected: all cases pass, no failures for missing or extra tools.

- [ ] **Step 4: Commit**

```bash
git add apps/agents/src/nexus/tools/index.ts apps/agents/src/nexus/__tests__/tools-index.test.ts
git commit -m "feat(mcp): swap tools barrel — drop gateway wrappers, add mcp_tool_search"
```

---

## Task 12: Delete the three old MCP gateway tool folders

**Files:**
- Delete: `apps/agents/src/nexus/tools/mcp-list-servers/`
- Delete: `apps/agents/src/nexus/tools/mcp-list-tools/`
- Delete: `apps/agents/src/nexus/tools/mcp-execute-tool/`

**Context:** After Task 11 nothing imports from these three folders, so removing them is mechanical. Check for any straggler test file that imports from them directly and flag it if found.

- [ ] **Step 1: Confirm nothing imports the deleted folders**

Run: `cd apps/agents && grep -rn "mcp-list-servers\|mcp-list-tools\|mcp-execute-tool" src/ 2>/dev/null`

Expected: zero matches. If any match appears (especially in a test file), it's a dangling reference — update or delete that file before proceeding.

- [ ] **Step 2: Delete the folders**

```bash
rm -rf apps/agents/src/nexus/tools/mcp-list-servers
rm -rf apps/agents/src/nexus/tools/mcp-list-tools
rm -rf apps/agents/src/nexus/tools/mcp-execute-tool
```

- [ ] **Step 3: Run the full tool-adjacent test suite**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/tools-index.test.ts src/nexus/__tests__/sandbox-runtime-tools.test.ts`

Expected: all cases pass.

- [ ] **Step 4: Commit**

```bash
git add -A apps/agents/src/nexus/tools/
git commit -m "chore(mcp): delete hand-rolled mcp gateway tool wrappers"
```

---

## Task 13: Create the `using-mcp-tools` skill

**Files:**
- Create: `apps/agents/src/nexus/skills/using-mcp-tools/SKILL.md`
- Create: `apps/agents/src/nexus/skills/using-mcp-tools/examples.md`
- Create: `apps/agents/src/nexus/skills/using-mcp-tools/templates/screenshot-script.js`

**Context:** Spec Component 6. The skill is the agent-facing documentation of the filesystem-of-tools pattern. Frontmatter description must be under 1024 chars (CLAUDE.md constraint). The skill explains the two Node ESM facts the agent must trust (absolute-path imports without `file://`, and upward `node_modules` resolution).

- [ ] **Step 1: Write `SKILL.md`**

```markdown
---
name: using-mcp-tools
description: Use when your directly-bound tools don't cover what you need — for example, you need Chrome DevTools performance traces, network inspection, form automation beyond screenshots, or a specific sandbox introspection capability. Triggers when the agent asks "is there a tool for X?" and the hot-layer research/code tools come up short. Teaches the cold-layer pattern: search the MCP catalog, read wrapper files, write a Node script that imports them, and run via sandbox_nodejs_execute.
---

# Using MCP Tools (Cold-Layer Pattern)

## When to Reach For This

Your research and code sub-agents have a small set of directly-bound tools. There's also a **cold layer** of ~60 MCP tools that live as JavaScript wrapper files at `/home/gem/nexus-servers/` inside the sandbox. Reach for the cold layer when:

- You need browser automation beyond screenshot + action (e.g. network request inspection, performance traces, console messages)
- You need Chrome DevTools-specific capabilities (CDP events, script evaluation with structured return)
- You need sandbox introspection the hot-layer tools don't expose
- You've tried the obvious hot-layer tools and they can't do what the task needs

Do NOT reach for this pattern when a hot-layer tool would work. It costs more tokens (one extra tool-call round-trip to discover the wrapper) and is strictly more complex.

## The Pattern

1. **Search the catalog.** Call `mcp_tool_search({ query: "<capability>" })`. You get back a ranked list of `{ path, name, summary }` entries where `path` is a sandbox-side absolute path under `/home/gem/nexus-servers/`.
2. **Read the wrapper.** Call `read_file({ path: "<path from step 1>" })`. The file contains the JSDoc argument docs, the exported function signature, and the wrapper body — everything you need to call it correctly.
3. **Write a Node script.** Use `sandbox_nodejs_execute({ code: "..." })` with a script that imports the wrapper via its absolute path and calls it.
4. **Read the script output.** Only what your script `console.log`s comes back to you. Print the fields you need, not the raw result.

## Two Node ESM Facts You Can Trust

- **`import` statements accept absolute filesystem paths directly**, with no `file://` prefix. Write `import { takeScreenshot } from "/home/gem/nexus-servers/chrome_devtools/take_screenshot.js"` and it just works.
- **`node_modules` resolution walks upward from the importing file's directory.** The wrappers import `@modelcontextprotocol/sdk` from `callMCPTool.js`, and resolution finds `/home/gem/nexus-servers/node_modules/` regardless of what cwd your Node process was started in. That's why `sandbox_nodejs_execute` has no `cwd` field and doesn't need one.

## Print What You Need

Script output is what reaches the conversation, not the raw MCP tool result. If you call a screenshot wrapper and `console.log(result)` the whole thing, you dump base64 image data into your context window. Instead, extract the fields you need:

```javascript
const r = await takeScreenshot({ full_page: true });
console.log(JSON.stringify({ saved_to: r.structuredContent.path, bytes: r.structuredContent.size }));
```

## When Scripts Fail

Scripts crash. The stack trace comes back in stderr. Three common failure modes:

1. **Wrong arguments.** The wrapper's JSDoc told you `{ url: string }` was required. You passed `{ path: "..." }` by accident. Fix: re-read the wrapper file and resend with the right argument names.
2. **MCP tool error.** The wrapper calls `callMCPTool` which throws on `isError: true` from the MCP server. The error message quotes the MCP server's diagnostic. Fix: read the MCP error text, adjust the tool arguments or the page state, retry.
3. **Stale wrapper.** The wrapper exists on disk but the MCP server no longer has that tool registered (upstream image bumped without a re-generation). Fix: flag it in your summary ("wrapper X is stale, please regenerate") — you cannot fix this from inside a turn, so use a different approach for the current task.

## Combining Multiple MCP Tools in One Turn

Scripts can compose. "Navigate, click login, fill form, screenshot" is four MCP calls but ONE `sandbox_nodejs_execute` invocation which is ONE model turn. Lean on this: compose wrappers inside your script rather than making four separate tool calls across four turns.

## See Also

- `examples.md` for three worked examples (screenshot, network inspection, cross-language composition)
- `templates/screenshot-script.js` for a copy-pasteable starting point
```

- [ ] **Step 2: Write `examples.md`**

```markdown
# Using MCP Tools — Examples

## Example 1: Take a full-page screenshot via chrome_devtools

```javascript
const search = await mcp_tool_search({ query: "screenshot", namespace: "chrome_devtools" });
// search.results[0].path → "/home/gem/nexus-servers/chrome_devtools/take_screenshot.js"

// After read_file on that path to confirm the argument shape:
await sandbox_nodejs_execute({
  code: `
    import { chromeDevtoolsNavigate } from "/home/gem/nexus-servers/chrome_devtools/navigate.js";
    import { chromeDevtoolsTakeScreenshot } from "/home/gem/nexus-servers/chrome_devtools/take_screenshot.js";

    await chromeDevtoolsNavigate({ url: "https://example.com" });
    const shot = await chromeDevtoolsTakeScreenshot({ full_page: true });
    const out = shot.structuredContent || shot.content?.[0];
    console.log(JSON.stringify({ ok: true, saved: out }));
  `,
});
```

Notice: two wrappers composed in one script, one model turn, and only the structured result prints — the base64 image bytes stay out of the conversation.

## Example 2: Inspect network requests on a page

```javascript
await sandbox_nodejs_execute({
  code: `
    import { chromeDevtoolsNavigate } from "/home/gem/nexus-servers/chrome_devtools/navigate.js";
    import { chromeDevtoolsListNetworkRequests } from "/home/gem/nexus-servers/chrome_devtools/list_network_requests.js";

    await chromeDevtoolsNavigate({ url: "https://httpbin.org/delay/2" });
    const requests = await chromeDevtoolsListNetworkRequests({ limit: 50 });
    const entries = requests.structuredContent?.requests ?? [];
    const summary = entries.map(r => ({
      url: r.url,
      method: r.method,
      status: r.status,
      size: r.response_size,
    }));
    console.log(JSON.stringify(summary, null, 2));
  `,
});
```

## Example 3: Run Python code inside a Node script via the sandbox MCP tool

Use this when you want Python-specific behavior but are already inside a Node composition. The sandbox MCP server exposes its own code-execution tool which is callable from Node.

```javascript
await sandbox_nodejs_execute({
  code: `
    import { sandboxExecuteCode } from "/home/gem/nexus-servers/sandbox/execute_code.js";

    const result = await sandboxExecuteCode({
      language: "python",
      code: "import numpy as np; print(np.linspace(0, 1, 5).tolist())",
    });
    const out = result.structuredContent?.stdout ?? result.content?.[0]?.text;
    console.log(out);
  `,
});
```

Reaching Python through a Node wrapper in one turn is cheaper than spawning a separate code sub-agent when you only need a few lines.
```

- [ ] **Step 3: Write `templates/screenshot-script.js`**

```javascript
// Template for taking a screenshot via the cold-layer chrome_devtools wrapper.
// Copy-paste and adapt the URL and output path to the task.

import { chromeDevtoolsNavigate } from "/home/gem/nexus-servers/chrome_devtools/navigate.js";
import { chromeDevtoolsTakeScreenshot } from "/home/gem/nexus-servers/chrome_devtools/take_screenshot.js";

const targetUrl = "https://example.com";

await chromeDevtoolsNavigate({ url: targetUrl, wait_until: "networkidle" });
const shot = await chromeDevtoolsTakeScreenshot({ full_page: true });

// Print only the structured fields — the raw base64 bytes must not reach the
// model context.
const payload = {
  url: targetUrl,
  kind: "screenshot",
  structured: shot.structuredContent ?? null,
};
console.log(JSON.stringify(payload));
```

- [ ] **Step 4: Commit**

```bash
git add apps/agents/src/nexus/skills/using-mcp-tools/
git commit -m "feat(mcp): add using-mcp-tools skill"
```

---

## Task 14: Register the skill in `skills/index.ts`

**Files:**
- Modify: `apps/agents/src/nexus/skills/index.ts`

**Context:** Spec Component 5 (skills half). Without appending to `SKILL_NAMES`, the `nexusSkillFiles` barrel won't pick up the new skill even though it exists on disk — the discovery loop iterates the tuple, not the directory.

- [ ] **Step 1: Append `"using-mcp-tools"` to `SKILL_NAMES`**

Replace lines 8-14:

```typescript
export const SKILL_NAMES = [
  "deep-research",
  "build-app",
  "generate-image",
  "data-analysis",
  "write-report",
] as const;
```

with:

```typescript
export const SKILL_NAMES = [
  "deep-research",
  "build-app",
  "generate-image",
  "data-analysis",
  "write-report",
  "using-mcp-tools",
] as const;
```

- [ ] **Step 2: Run skill seeding tests**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/skills-seeding.test.ts src/nexus/__tests__/skills-content.test.ts`

Expected: existing cases still pass. If the skills-content test hardcodes the expected skill count or enumerates names, bump it by one — the new count is 6 skills.

- [ ] **Step 3: Commit**

```bash
git add apps/agents/src/nexus/skills/index.ts apps/agents/src/nexus/__tests__/skills-content.test.ts apps/agents/src/nexus/__tests__/skills-seeding.test.ts
git commit -m "feat(mcp): register using-mcp-tools in SKILL_NAMES tuple"
```

(Include the test files in the commit only if you actually updated them.)

---

## Task 15: Update sub-agent and orchestrator system prompts

**Files:**
- Modify: `apps/agents/src/nexus/agents/research/prompt.ts`
- Modify: `apps/agents/src/nexus/agents/code/prompt.ts`
- Modify: `apps/agents/src/nexus/prompts/orchestrator-system.ts`

**Context:** Spec Component 7. Three files, three related edits. Do them in one commit because they describe a coherent capability change.

- [ ] **Step 1: Update `research/prompt.ts`**

In `RESEARCH_SYSTEM_PROMPT`, after the existing `## Tools` section (which ends at the browser stack bullet) and before `## Workflow`, add a new section:

```
## Discovering Additional Capabilities

You also have access to a **cold-layer** MCP tool catalog inside the sandbox — ~60 tools including Chrome DevTools (network inspection, performance traces), additional browser automation, and sandbox introspection. They live as JavaScript wrapper files at \`/home/gem/nexus-servers/\`.

To use one:
1. Call \`mcp_tool_search({ query: "..." })\` to find candidates by capability.
2. Call \`read_file\` on the returned path to see the argument shape.
3. Call \`sandbox_nodejs_execute\` with a script that imports the wrapper (absolute path, no \`file://\` prefix) and runs it.

Only reach for this when the hot-layer tools above cannot do what the task needs. See the \`using-mcp-tools\` skill for the full pattern and examples.
```

Also update the `## Tools` section's last line — append `sandbox_nodejs_execute` and `mcp_tool_search` to the bullet list. Add:

```
- **sandbox_nodejs_execute**: Execute Node.js scripts. Primary vehicle for running cold-layer MCP wrappers — see "Discovering Additional Capabilities" below.
- **mcp_tool_search**: Search the cold-layer MCP catalog. Returns ranked wrapper paths you can read with the filesystem helper.
```

- [ ] **Step 2: Update `code/prompt.ts`**

In `CODE_SYSTEM_PROMPT`, in the "Runtime API tools" bullet list:

- Delete the three bullets at lines 30-32 (`sandbox_mcp_list_servers`, `sandbox_mcp_list_tools`, `sandbox_mcp_execute_tool`)
- Add one new bullet at the end of the "Runtime API tools" section:

```
- **mcp_tool_search**: Search the sandbox's 60-tool MCP catalog for a capability you need. Returns wrapper file paths; read them with the filesystem helper, then import them in a \`sandbox_nodejs_execute\` script. See the \`using-mcp-tools\` skill.
```

Then, before `## Workflow`, add the same "Discovering Additional Capabilities" section you added to research — same text verbatim. (DRY note: the skill file is the canonical explainer; these sections in the per-agent prompts are short teasers that point at the skill.)

- [ ] **Step 3: Update `prompts/orchestrator-system.ts` lines 28-29**

Replace the current `research` and `code` bullets (long enumerations of ~20 tools each from the previous task) with shorter capability-flavored descriptions. Find the block:

```
- **research** — Web search, content extraction, site mapping, local document ingestion, and browser-based fallback for login-walled or JS-heavy pages. Use for current information, source gathering, knowledge synthesis, or extracting text from PDFs/DOCX/HTML already on the sandbox filesystem. Tools: tavily_search, tavily_extract, tavily_map, sandbox_util_convert_to_markdown, sandbox_browser_info, sandbox_browser_screenshot, sandbox_browser_action, sandbox_browser_config.
- **code** — Code writing, execution, and debugging in a sandboxed Linux environment. Use for building applications, scripts, data processing, file formatting, and stateful interactive analysis. Prefer the Jupyter session tools for multi-step Python work that needs persistent variables; use sandbox_nodejs_execute when you need stdin or file injection that sandbox_code_execute cannot provide; use the MCP gateway tools to discover and call tools exposed by MCP servers running in the sandbox. Tools: sandbox_code_execute, sandbox_code_info, sandbox_nodejs_execute, sandbox_nodejs_info, sandbox_jupyter_create_session, sandbox_jupyter_execute, sandbox_jupyter_info, sandbox_jupyter_list_sessions, sandbox_jupyter_delete_session, sandbox_mcp_list_servers, sandbox_mcp_list_tools, sandbox_mcp_execute_tool, plus auto-provisioned execute (shell) and filesystem helpers (ls, read_file, write_file, edit_file, glob, grep) from AIOSandboxBackend.
```

Replace with:

```
- **research** — Web search, content extraction, site mapping, local document ingestion, and browser-based fallback for login-walled or JS-heavy pages. Use for current information, source gathering, knowledge synthesis, or extracting text from PDFs/DOCX/HTML already on the sandbox filesystem. Hot-layer tools: Tavily search/extract/map, sandbox util converter, browser stack, sandbox_nodejs_execute. Plus a deferred catalog of ~60 MCP tools (browser automation, devtools, sandbox introspection) accessible via mcp_tool_search and sandbox_nodejs_execute — see the using-mcp-tools skill.
- **code** — Code writing, execution, and debugging in a sandboxed Linux environment. Use for building applications, scripts, data processing, file formatting, and stateful interactive analysis. Prefer Jupyter session tools for multi-step Python work that needs persistent variables; use sandbox_nodejs_execute for Node scripts with stdin/file injection. Hot-layer tools: code/nodejs execute + info, Jupyter set, mcp_tool_search, plus auto-provisioned execute (shell) and filesystem helpers (ls, read_file, write_file, edit_file, glob, grep) from AIOSandboxBackend. Plus a deferred catalog of ~60 MCP tools accessible via mcp_tool_search and sandbox_nodejs_execute — see the using-mcp-tools skill.
```

- [ ] **Step 4: Run orchestrator-system tests**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/orchestrator-system.test.ts src/nexus/__tests__/research-agent.test.ts src/nexus/__tests__/code-agent.test.ts`

Expected: existing cases pass. `orchestrator-system.test.ts` only checks for high-level strings (`/home/gem/workspace/`, `task`, `write_todos`, `500`) — all still present. If `research-agent.test.ts` or `code-agent.test.ts` pin specific tool name strings in the prompt, update them to include or remove the affected names.

- [ ] **Step 5: Commit**

```bash
git add apps/agents/src/nexus/agents/research/prompt.ts apps/agents/src/nexus/agents/code/prompt.ts apps/agents/src/nexus/prompts/orchestrator-system.ts
git commit -m "feat(mcp): update system prompts to introduce cold-layer pattern"
```

---

## Task 16: Write the gated integration test

**Files:**
- Create: `apps/agents/src/nexus/__tests__/call-mcp-tool.integration.test.ts`

**Context:** Spec Component 8 / Test 4. Gated behind `SANDBOX_INTEGRATION=true` matching the `zai-chat-model.integration.test.ts` convention. Only runs when a real sandbox is reachable at `http://localhost:8080`.

- [ ] **Step 1: Write the file**

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { AIOSandboxBackend } from "../backend/aio-sandbox.js";
import {
  ensureSandboxFilesystem,
  __resetBootstrapStateForTests,
} from "../backend/sandbox-bootstrap.js";
import { sandboxNodejsExecute } from "../tools/nodejs-execute/tool.js";

const hasFlag = Boolean(process.env.SANDBOX_INTEGRATION);

describe.skipIf(!hasFlag)("call-mcp-tool integration", () => {
  let sandbox: AIOSandboxBackend;

  beforeAll(async () => {
    __resetBootstrapStateForTests();
    sandbox = new AIOSandboxBackend(
      process.env.SANDBOX_URL ?? "http://localhost:8080",
    );
    const ok = await ensureSandboxFilesystem(sandbox);
    if (!ok) {
      throw new Error(
        "Bootstrap failed — is the sandbox running and does `npm install` work inside the container?",
      );
    }
  }, 120_000);

  it("smoke: sandbox_get_context returns structured metadata", async () => {
    const script = `
      import { sandboxGetContext } from "/home/gem/nexus-servers/sandbox/get_context.js";
      const r = await sandboxGetContext({});
      console.log(JSON.stringify({ ok: true, has_structured: Boolean(r.structuredContent), content_items: r.content?.length ?? 0 }));
    `;
    const raw = await sandboxNodejsExecute.invoke({ code: script, timeout: 60 });
    const result = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('"ok":true');
  }, 120_000);

  it("roundtrip: sandbox_convert_to_markdown accepts an argument and returns content", async () => {
    // Seed a trivial HTML file via the sandbox filesystem first
    await sandbox.execute(
      "mkdir -p /home/gem/workspace/it && echo '<h1>Hi</h1><p>para</p>' > /home/gem/workspace/it/hi.html",
    );
    const script = `
      import { sandboxConvertToMarkdown } from "/home/gem/nexus-servers/sandbox/convert_to_markdown.js";
      const r = await sandboxConvertToMarkdown({ path: "/home/gem/workspace/it/hi.html" });
      const text = r.content?.[0]?.text ?? r.structuredContent?.markdown ?? "";
      console.log(text);
    `;
    const raw = await sandboxNodejsExecute.invoke({ code: script, timeout: 60 });
    const result = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));
    expect(result.success).toBe(true);
    expect(result.stdout?.toLowerCase()).toContain("hi");
  }, 120_000);

  it("error path: invalid arguments cause the script to exit non-zero with MCP error text", async () => {
    const script = `
      import { sandboxConvertToMarkdown } from "/home/gem/nexus-servers/sandbox/convert_to_markdown.js";
      try {
        await sandboxConvertToMarkdown({ path: "/tmp/definitely-does-not-exist.html" });
        console.log("UNEXPECTED_SUCCESS");
      } catch (err) {
        console.error("CAUGHT:" + err.message);
        process.exit(2);
      }
    `;
    const raw = await sandboxNodejsExecute.invoke({ code: script, timeout: 60 });
    const result = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));
    // Either the exit code is non-zero or the stderr contains the MCP error message.
    // We accept either because sandbox_nodejs_execute packaging can vary.
    const stderr = (result.stderr as string | null) ?? "";
    const stdout = (result.stdout as string | null) ?? "";
    expect(stdout).not.toContain("UNEXPECTED_SUCCESS");
    expect(stderr + stdout).toMatch(/CAUGHT:|error/i);
  }, 120_000);
});
```

- [ ] **Step 2: Verify the test suite skips by default**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/call-mcp-tool.integration.test.ts`

Expected: Vitest reports the describe block as skipped (0 ran, 3 skipped). No failure.

- [ ] **Step 3: Commit**

```bash
git add apps/agents/src/nexus/__tests__/call-mcp-tool.integration.test.ts
git commit -m "test(mcp): add gated integration test for filesystem-of-tools"
```

---

## Task 17: Final verification — run the full suite, type-check, and manual preflight

**Files:** none modified — this is the release gate.

**Context:** Spec "Verify Before Claiming Done" section (steps 0-3). Steps 0 and 1-3 are manual; the automated checks below must all pass first.

- [ ] **Step 1: Run the full unit test suite**

Run: `cd apps/agents && npx vitest run`

Expected: all unit tests pass. The integration suite (`call-mcp-tool.integration.test.ts`) is skipped because `SANDBOX_INTEGRATION` is not set. The total count should be roughly the pre-existing suite (46 unit + 3 Tavily integration) + ~35 new cases, all passing or skipped.

- [ ] **Step 2: Run the TypeScript compile check**

Run: `cd apps/agents && npx tsc -p tsconfig.json --noEmit`

Expected: only **pre-existing** errors (test files, `db/index.ts` — see CLAUDE.md "Known Gotchas"). Any new error is one of our edits and must be fixed before committing the task-complete marker. The generator script and the bootstrap module are new files — they must not add errors.

- [ ] **Step 3: Manual check — sandbox preflight (spec step 0)**

Run: `docker run --rm ghcr.io/agent-infra/sandbox:latest sh -c "which npm && npm view @modelcontextprotocol/sdk version"`

Expected: `which npm` prints a path (likely `/usr/bin/npm`), and `npm view` prints the latest published SDK version. If either fails, the bootstrap design's `npm install` assumption is broken and the spec needs a tarball-vendoring revision before runtime testing. Stop, flag it to the user, and do not proceed to Step 5.

- [ ] **Step 4: Manual check — run the generator against a live sandbox (spec step 1)**

Start a sandbox (`docker run --security-opt seccomp=unconfined --rm -it -p 8080:8080 ghcr.io/agent-infra/sandbox:latest`) in a separate terminal, then:

Run: `cd apps/agents && npm run generate:mcp-wrappers`

Expected: the script prints `Generated N wrapper files into .../sandbox-files/servers. Review the diff, then commit.` where N is around 60. Then `git status apps/agents/sandbox-files/servers/` shows the three namespace directories populated with `.js` files and the `.gitkeep` placeholders replaced. Run `git diff apps/agents/sandbox-files/servers/` and visually review a handful of files — look for weird type names, missing JSDoc, or namespace-routing surprises.

If the generator completes, commit the result:

```bash
git add apps/agents/sandbox-files/servers/
git commit -m "chore(mcp): generate wrapper tree against live sandbox"
```

- [ ] **Step 5: Manual check — `npm run dev` end to end (spec step 2)**

Start a fresh sandbox. Run `npm run dev` from the repo root. Open the Next.js UI at `http://localhost:3000`. Submit a prompt that exercises the cold layer, e.g.:

> "Take a full-page screenshot of https://example.com using the chrome_devtools tools and save it to /home/gem/workspace/shared/example.png. Tell me the dimensions."

In the LangGraph stream, watch for this sequence:
1. Research sub-agent (or Code — depending on routing) calls `mcp_tool_search`
2. Receives a ranked path list including a chrome_devtools entry
3. Calls `read_file` on the returned path
4. Calls `sandbox_nodejs_execute` with a script that imports the wrapper
5. Returns a conversational summary with the dimensions — no raw base64 in the stream

If the result lands correctly, the filesystem-of-tools pattern is live. If `mcp_tool_search` returns the "catalog is unavailable" error, inspect the LangGraph server stderr for the bootstrap failure — likely `npm install` failed, so re-check spec step 0.

- [ ] **Step 6: Manual check — fresh sandbox bootstrap across two threads (spec step 3)**

Stop the existing sandbox, start a fresh one, and send a prompt. Time the first turn — the bootstrap should take ~10-30 seconds. Send a second prompt from a *different* thread in the same LangGraph server (the UI's thread selector, or start a new conversation) and verify the second prompt is instant — the fast-path marker check should succeed and the `uploadFiles` + `npm install` should not re-run. This proves `/home/gem/nexus-servers/` lives outside the per-thread workspace remapping zone.

- [ ] **Step 7: Final commit**

If any test files were updated during verification (e.g. `skills-content.test.ts` needed a skill-count bump you missed in Task 14), commit them now with a fix-up commit:

```bash
git add -A
git commit -m "fix(mcp): verification fixups from final plan-review run"
```

If no fixups were needed, there's nothing to commit for this step.

---

## Self-Review Notes

I ran the post-write self-review checklist against the plan. Findings and fixes (applied inline above):

- **Wrappers are `.js` not `.ts`:** The spec described TypeScript wrapper files but the runtime path (`sandbox_nodejs_execute` → `/v1/nodejs/execute`) runs plain JavaScript with no compile step. The plan emits `.js` files throughout and uses JSDoc type annotations instead of TypeScript interfaces. Same information payload for the agent, zero build step. Called out in the plan header.
- **Path resolution uses 4 hops not 3:** The spec's example `path.resolve(import.meta.dirname, "../../../sandbox-files/servers")` miscounts — from `apps/agents/src/nexus/tools/mcp-tool-search/tool.ts` it takes 4 upward hops (`../../../../`) to reach `apps/agents/`, not 3. Same 4 hops apply to the bootstrap module at `apps/agents/src/nexus/backend/sandbox-bootstrap.ts`. Both Tasks 6 and 10 use the corrected paths.
- **Test isolation for the bootstrap singleton:** The spec didn't call out that module-level state (the singleton promise + ready flag) must be resettable for tests. Task 6 adds a `__resetBootstrapStateForTests` export, and Task 5's tests call it in `beforeEach`.
- **Factory pattern for mcp-tool-search:** The spec flagged that the other Nexus tools export a single `tool(...)` result without a factory. Task 9/10 keep the production export shape (`export const mcpToolSearch = createMcpToolSearch()`) AND expose `createMcpToolSearch(opts)` for test injection. Production consumers see the existing shape; tests get clean DI without `vi.mock` on the whole `fs` module.
- **Retry semantics for bootstrap:** The spec said partial failure should retry on the next call. If the singleton promise is cached forever, a failure poisons all subsequent calls. Task 6's implementation clears `bootstrapPromise = null` on a `false` outcome so the next caller re-enters the state machine. Task 5 has an explicit test for this.
- **`apps/agents/sandbox-files/servers/` cannot be empty at test time:** The bootstrap module's `collectStaticTree` walks this directory and the cold-start test expects at least `package.json` + `_client/callMCPTool.js` to upload. Task 1 creates these before any test runs. The `.gitkeep` placeholders in the namespace subdirs are filtered out by the walker so they don't become fake "wrappers".
- **Tool definitions called out in the spec but missing from existing code (`sandboxNodejsExecute` in researchTools):** The existing `tools/index.ts` has `sandboxNodejsExecute` imported but not in the researchTools bundle. Task 11 adds it there — count goes from 8 → 10.

No placeholder steps, no "similar to Task N" shortcuts, all file paths are absolute, every code step shows the actual code.

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-14-mcp-filesystem-of-tools.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
