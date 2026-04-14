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
