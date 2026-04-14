import { tool } from "@langchain/core/tools";
import { readdirSync, readFileSync, statSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { z } from "zod/v4";
import { isMcpFilesystemReady } from "../../backend/sandbox-bootstrap.js";
import { MCP_TOOL_SEARCH_NAME, MCP_TOOL_SEARCH_DESCRIPTION } from "./prompt.js";

const SANDBOX_ROOT = "/home/gem/nexus-servers";

export const mcpToolSearchSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe("Keyword or phrase describing the capability you need."),
  namespace: z
    .string()
    .optional()
    .describe(
      "Restrict the search to one MCP namespace directory (e.g. 'browser', 'chrome_devtools'). Unknown namespaces simply return zero matches.",
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
  namespace: string;
  haystack: string; // lowercased name + summary + prop names for ranking
}

interface CreateOptions {
  sourceRoot?: string;
  readyChecker?: () => boolean;
}

function defaultSourceRoot(): string {
  // .../apps/agents/{src|dist}/nexus/tools/mcp-tool-search/tool.{ts|js}
  // Up five levels: mcp-tool-search/ → tools/ → nexus/ → src/ → agents/
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

const EXCLUDED_DIRS = new Set(["_client", "node_modules"]);

function buildCatalog(sourceRoot: string): CatalogEntry[] {
  const entries: CatalogEntry[] = [];
  let rootEntries;
  try {
    rootEntries = readdirSync(sourceRoot, {
      withFileTypes: true,
      encoding: "utf8",
    });
  } catch {
    return [];
  }
  const namespaceDirs = rootEntries.filter(
    (d) =>
      d.isDirectory() &&
      !EXCLUDED_DIRS.has(d.name) &&
      !d.name.startsWith("."),
  );
  for (const nsEntry of namespaceDirs) {
    const namespace = nsEntry.name;
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

function structuredEmptyResult(query: string, catalog: CatalogEntry[]): string {
  const namespaces = Array.from(
    new Set(catalog.map((e) => e.namespace)),
  ).sort();
  const note =
    namespaces.length === 0
      ? `No MCP tools matched '${query}' — the catalog is empty. The sandbox bootstrap may not have populated wrapper files yet.`
      : `No MCP tools matched '${query}'. The catalog currently covers these namespaces: ${namespaces.join(", ")}. See the using-mcp-tools skill for usage patterns.`;
  return JSON.stringify({ results: [], note });
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
        return structuredEmptyResult(input.query, catalog);
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
