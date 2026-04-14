export const MCP_TOOL_SEARCH_NAME = "mcp_tool_search";

export const MCP_TOOL_SEARCH_DESCRIPTION =
  "Search the sandbox's 60-tool MCP catalog (browser automation, Chrome DevTools, sandbox introspection) " +
  "for a capability matching your query. Returns a ranked shortlist of absolute file paths inside " +
  "/home/gem/nexus-servers/ — read those files with the filesystem helper to see the arguments and " +
  "example usage, then write a Node script that imports the wrapper and runs via sandbox_nodejs_execute. " +
  "See the `using-mcp-tools` skill for the full pattern. This is a catalog search — it does NOT execute " +
  "anything. Use it when none of the directly-bound tools cover what you need.";
