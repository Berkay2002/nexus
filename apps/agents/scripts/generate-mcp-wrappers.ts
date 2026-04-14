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
