import { tool } from "@langchain/core/tools";
import { z } from "zod/v4";
import {
  encodePathSegment,
  normalizeApiError,
  sandboxPostJson,
  toRecord,
} from "../sandbox-runtime-api.js";
import { TOOL_DESCRIPTION, TOOL_NAME } from "./prompt.js";

export const sandboxMcpExecuteToolSchema = z.object({
  server_name: z
    .string()
    .min(1)
    .describe("Name of the MCP server hosting the tool"),
  tool_name: z
    .string()
    .min(1)
    .describe("Name of the MCP tool to invoke"),
  arguments: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      "JSON object with arguments matching the tool's inputSchema. Defaults to {} when omitted.",
    ),
});

export type SandboxMcpExecuteToolInput = z.infer<
  typeof sandboxMcpExecuteToolSchema
>;

function getString(
  record: Record<string, unknown> | null,
  key: string,
): string | null {
  const value = record?.[key];
  return typeof value === "string" ? value : null;
}

function getBoolean(
  record: Record<string, unknown> | null,
  key: string,
): boolean | null {
  const value = record?.[key];
  return typeof value === "boolean" ? value : null;
}

export const sandboxMcpExecuteTool = tool(
  async ({ arguments: toolArgs, server_name, tool_name }) => {
    const endpoint = `/v1/mcp/${encodePathSegment(server_name)}/tools/${encodePathSegment(tool_name)}`;
    try {
      const payload = toolArgs ?? {};
      const result = await sandboxPostJson(endpoint, payload);
      if (!result.ok) {
        return JSON.stringify({
          endpoint,
          error: normalizeApiError(result),
          kind: "mcp_call",
          server_name,
          tool_name,
          success: false,
        });
      }

      const envelope = toRecord(result.data);
      const data = toRecord(envelope?.data);
      const content = Array.isArray(data?.content) ? data.content : [];
      const isError = getBoolean(data, "isError") ?? false;
      const success =
        typeof envelope?.success === "boolean" ? envelope.success : true;

      return JSON.stringify({
        kind: "mcp_call",
        success: success && !isError,
        server_name,
        tool_name,
        message: getString(envelope, "message"),
        is_error: isError,
        structured_content: data?.structuredContent ?? null,
        content,
      });
    } catch (error) {
      return JSON.stringify({
        endpoint,
        error: error instanceof Error ? error.message : String(error),
        kind: "mcp_call",
        server_name,
        tool_name,
        success: false,
      });
    }
  },
  {
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    schema: sandboxMcpExecuteToolSchema,
  },
);
