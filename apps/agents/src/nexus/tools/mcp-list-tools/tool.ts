import { tool } from "@langchain/core/tools";
import { z } from "zod/v4";
import {
  encodePathSegment,
  normalizeApiError,
  sandboxGet,
  toRecord,
} from "../sandbox-runtime-api.js";
import { TOOL_DESCRIPTION, TOOL_NAME } from "./prompt.js";

export const sandboxMcpListToolsSchema = z.object({
  server_name: z
    .string()
    .min(1)
    .describe("Name of the MCP server (from sandbox_mcp_list_servers)"),
});

export type SandboxMcpListToolsInput = z.infer<
  typeof sandboxMcpListToolsSchema
>;

function getString(
  record: Record<string, unknown> | null,
  key: string,
): string | null {
  const value = record?.[key];
  return typeof value === "string" ? value : null;
}

export const sandboxMcpListTools = tool(
  async ({ server_name }) => {
    const endpoint = `/v1/mcp/${encodePathSegment(server_name)}/tools`;
    try {
      const result = await sandboxGet(endpoint);
      if (!result.ok) {
        return JSON.stringify({
          endpoint,
          error: normalizeApiError(result),
          kind: "mcp_tools",
          server_name,
          success: false,
        });
      }

      const envelope = toRecord(result.data);
      const data = toRecord(envelope?.data);
      const tools = Array.isArray(data?.tools) ? data.tools : [];
      const success =
        typeof envelope?.success === "boolean" ? envelope.success : true;

      return JSON.stringify({
        kind: "mcp_tools",
        success,
        server_name,
        message: getString(envelope, "message"),
        count: tools.length,
        next_cursor: getString(data, "nextCursor"),
        tools,
      });
    } catch (error) {
      return JSON.stringify({
        endpoint,
        error: error instanceof Error ? error.message : String(error),
        kind: "mcp_tools",
        server_name,
        success: false,
      });
    }
  },
  {
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    schema: sandboxMcpListToolsSchema,
  },
);
