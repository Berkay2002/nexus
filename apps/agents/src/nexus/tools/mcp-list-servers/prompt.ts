export const TOOL_NAME = "sandbox_mcp_list_servers";

export const TOOL_DESCRIPTION =
  "List MCP (Model Context Protocol) servers registered in the sandbox via /v1/mcp/servers. " +
  "Returns the array of server names. Use this to discover which servers you can subsequently " +
  "introspect with sandbox_mcp_list_tools or invoke with sandbox_mcp_execute_tool. " +
  "Servers are configured at sandbox startup — there is no runtime registration endpoint.";
