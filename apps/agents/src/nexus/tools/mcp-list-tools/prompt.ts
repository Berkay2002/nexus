export const TOOL_NAME = "sandbox_mcp_list_tools";

export const TOOL_DESCRIPTION =
  "List the tool manifest exposed by a single MCP server via /v1/mcp/{server_name}/tools. " +
  "Returns each tool's name, description, and JSON Schema for its inputs. " +
  "Use this AFTER sandbox_mcp_list_servers to discover what arguments sandbox_mcp_execute_tool accepts.";
