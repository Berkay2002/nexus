import { tool } from "@langchain/core/tools";
import { z } from "zod/v4";
import { TOOL_NAME, TOOL_DESCRIPTION } from "./prompt.js";

const booleanLike = () =>
  z.union([z.boolean(), z.enum(["true", "false"])]);

function coerceBool<T>(v: T): T | boolean {
  if (v === "true") return true;
  if (v === "false") return false;
  return v;
}

export const tavilySearchSchema = z.object({
  query: z.string().describe("The search query to execute"),
  search_depth: z
    .enum(["advanced", "basic", "fast", "ultra-fast"])
    .optional()
    .default("basic")
    .describe(
      "Controls latency vs relevance. 'advanced' returns multiple semantic chunks per URL. " +
        "'basic' returns one NLP summary per URL. 'fast' is lower latency with chunks. " +
        "'ultra-fast' minimizes latency.",
    ),
  max_results: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .default(5)
    .describe("Maximum number of search results to return (1-20)"),
  topic: z
    .enum(["general", "news", "finance"])
    .optional()
    .default("general")
    .describe("Search category"),
  time_range: z
    .enum(["day", "week", "month", "year"])
    .optional()
    .describe("Filter results by recency"),
  include_answer: z
    .union([z.boolean(), z.enum(["basic", "advanced", "true", "false"])])
    .optional()
    .default(false)
    .describe(
      "Include an LLM-generated answer. true or 'basic' for a short answer, 'advanced' for detailed.",
    ),
  include_raw_content: z
    .union([z.boolean(), z.enum(["markdown", "text", "true", "false"])])
    .optional()
    .default(false)
    .describe(
      "Include cleaned page content per result. true or 'markdown' for markdown, 'text' for plain text.",
    ),
  include_images: booleanLike()
    .optional()
    .default(false)
    .describe("Include images in results"),
  chunks_per_source: z
    .number()
    .int()
    .min(1)
    .max(3)
    .optional()
    .describe(
      "Max chunks per source (1-3). Only applies when search_depth is 'advanced' or 'fast'.",
    ),
  include_domains: z
    .array(z.string())
    .optional()
    .describe("Only include results from these domains"),
  exclude_domains: z
    .array(z.string())
    .optional()
    .describe("Exclude results from these domains"),
});

export type TavilySearchInput = z.infer<typeof tavilySearchSchema>;

export const tavilySearch = tool(
  async (input) => {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return "Error: TAVILY_API_KEY is not set. Add it to .env and restart the LangGraph server.";
    }

    try {
      const normalized = {
        ...input,
        include_answer: coerceBool(input.include_answer),
        include_raw_content: coerceBool(input.include_raw_content),
        include_images: coerceBool(input.include_images),
      };

      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(normalized),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return `Error: Tavily Search API returned ${response.status}: ${errorText}`;
      }

      const data = await response.json();
      return JSON.stringify(data);
    } catch (e) {
      return `Error: Tavily Search request failed: ${e instanceof Error ? e.message : String(e)}`;
    }
  },
  {
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    schema: tavilySearchSchema,
  },
);
