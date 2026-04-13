export const TOOL_NAME = "sandbox_mcp_execute_tool";

export const TOOL_DESCRIPTION =
  "Invoke an MCP tool by name via POST /v1/mcp/{server_name}/tools/{tool_name}. " +
  "Pass the tool's arguments as a JSON object matching its inputSchema (use sandbox_mcp_list_tools first to discover it). " +
  "WARNING: a 200 HTTP response can still carry data.isError === true — the tool itself reported a failure even though " +
  "the gateway call succeeded. Always check is_error before treating content blocks as a success.";
