export const TOOL_NAME = "tavily_map";

export const TOOL_DESCRIPTION =
  "Map a website's structure using Tavily. Traverses from a root URL and discovers linked pages. " +
  "Returns a list of discovered URLs with the base URL and total count. " +
  "Use to understand site structure before deep extraction, or to find specific pages within a site. " +
  "Supports natural language instructions for the crawler and regex path/domain filtering.";
