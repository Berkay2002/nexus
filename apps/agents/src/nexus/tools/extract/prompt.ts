export const TOOL_NAME = "tavily_extract";

export const TOOL_DESCRIPTION =
  "Extract content from one or more web page URLs using Tavily. " +
  "Returns raw page content, optionally filtered by a query for relevance. " +
  "Use when you have specific URLs and need their content. " +
  "Supports 'advanced' extraction for tables and embedded content. " +
  "Provide a query to rerank extracted chunks by relevance.";
