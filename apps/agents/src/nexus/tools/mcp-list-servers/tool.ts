import { tool } from "@langchain/core/tools";
import { z } from "zod/v4";
import {
  normalizeApiError,
  sandboxGet,
  toRecord,
} from "../sandbox-runtime-api.js";
import { TOOL_DESCRIPTION, TOOL_NAME } from "./prompt.js";

export const sandboxMcpListServersSchema = z.object({});

export type SandboxMcpListServersInput = z.infer<
  typeof sandboxMcpListServersSchema
>;

function getString(
  record: Record<string, unknown> | null,
  key: string,
): string | null {
  const value = record?.[key];
  return typeof value === "string" ? value : null;
}

export const sandboxMcpListServers = tool(
  async () => {
    try {
      const result = await sandboxGet("/v1/mcp/servers");
      if (!result.ok) {
        return JSON.stringify({
          endpoint: "/v1/mcp/servers",
          error: normalizeApiError(result),
          kind: "mcp_servers",
          success: false,
        });
      }

      const envelope = toRecord(result.data);
      const data = envelope?.data;
      const servers = Array.isArray(data)
        ? data.filter((item): item is string => typeof item === "string")
        : [];
      const success =
        typeof envelope?.success === "boolean" ? envelope.success : true;

      return JSON.stringify({
        kind: "mcp_servers",
        success,
        message: getString(envelope, "message"),
        count: servers.length,
        servers,
      });
    } catch (error) {
      return JSON.stringify({
        endpoint: "/v1/mcp/servers",
        error: error instanceof Error ? error.message : String(error),
        kind: "mcp_servers",
        success: false,
      });
    }
  },
  {
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    schema: sandboxMcpListServersSchema,
  },
);
