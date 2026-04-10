import { tool } from "@langchain/core/tools";
import { z } from "zod/v4";
import { TOOL_NAME, TOOL_DESCRIPTION } from "./prompt.js";

export const tavilyMapSchema = z.object({
  url: z.string().describe("The root URL to begin mapping"),
  instructions: z
    .string()
    .optional()
    .describe(
      "Natural language instructions for the crawler (e.g., 'Find all pages about the Python SDK'). Increases cost when provided.",
    ),
  max_depth: z
    .number()
    .int()
    .min(1)
    .max(5)
    .optional()
    .default(1)
    .describe("How far from the base URL the crawler can explore (1-5)"),
  max_breadth: z
    .number()
    .int()
    .min(1)
    .max(500)
    .optional()
    .default(20)
    .describe("Max number of links to follow per page (1-500)"),
  limit: z
    .number()
    .int()
    .optional()
    .default(50)
    .describe("Total links the crawler will process before stopping"),
  select_paths: z
    .array(z.string())
    .optional()
    .describe(
      "Regex patterns to select only URLs with specific path patterns (e.g., '/docs/.*')",
    ),
  exclude_paths: z
    .array(z.string())
    .optional()
    .describe(
      "Regex patterns to exclude URLs with specific path patterns (e.g., '/private/.*')",
    ),
  select_domains: z
    .array(z.string())
    .optional()
    .describe(
      "Regex patterns to restrict crawling to specific domains or subdomains",
    ),
  exclude_domains: z
    .array(z.string())
    .optional()
    .describe(
      "Regex patterns to exclude specific domains or subdomains from crawling",
    ),
});

export type TavilyMapInput = z.infer<typeof tavilyMapSchema>;

export const tavilyMap = tool(
  async (input) => {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      throw new Error("TAVILY_API_KEY environment variable is not set");
    }

    const response = await fetch("https://api.tavily.com/map", {
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
        `Tavily Map API error (${response.status}): ${errorText}`,
      );
    }

    const data = await response.json();
    return JSON.stringify(data);
  },
  {
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    schema: tavilyMapSchema,
  },
);
