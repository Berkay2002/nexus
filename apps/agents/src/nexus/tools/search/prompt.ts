export const TOOL_NAME = "tavily_search";

export const TOOL_DESCRIPTION =
  "Search the web using Tavily. Returns results with title, URL, content snippet, and relevance score. " +
  "Use for finding current information, researching topics, or gathering sources. " +
  "Supports filtering by topic (general/news/finance), time range, and domains. " +
  "Use 'advanced' search_depth for detailed multi-chunk results, 'basic' for balanced results, " +
  "'fast' for lower latency, or 'ultra-fast' for time-critical searches.";
