import { tool } from "@langchain/core/tools";
import { z } from "zod/v4";
import { TOOL_NAME, TOOL_DESCRIPTION } from "./prompt.js";

export const tavilyExtractSchema = z.object({
  urls: z
    .union([z.string(), z.array(z.string())])
    .describe("URL or list of URLs to extract content from"),
  query: z
    .string()
    .optional()
    .describe(
      "User intent for reranking extracted content chunks. When provided, chunks are reranked by relevance to this query.",
    ),
  chunks_per_source: z
    .number()
    .int()
    .min(1)
    .max(5)
    .optional()
    .default(3)
    .describe(
      "Max chunks per source (1-5). Only applies when query is provided.",
    ),
  extract_depth: z
    .enum(["basic", "advanced"])
    .optional()
    .default("basic")
    .describe(
      "'advanced' retrieves tables and embedded content with higher success but more latency.",
    ),
  include_images: z
    .boolean()
    .optional()
    .default(false)
    .describe("Include images extracted from the URLs"),
});

export type TavilyExtractInput = z.infer<typeof tavilyExtractSchema>;

export const tavilyExtract = tool(
  async (input) => {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      throw new Error("TAVILY_API_KEY environment variable is not set");
    }

    const response = await fetch("https://api.tavily.com/extract", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Tavily Extract API error (${response.status}): ${errorText}`,
      );
    }

    const data = await response.json();
    return JSON.stringify(data);
  },
  {
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    schema: tavilyExtractSchema,
  },
);
