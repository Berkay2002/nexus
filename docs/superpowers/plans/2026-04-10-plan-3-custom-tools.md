# Plan 3: Custom Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the 3 Tavily tools (search, extract, map) and 1 Gemini image generation tool that sub-agents will use.

**Architecture:** Each tool lives in its own folder with two files: `prompt.ts` (description + usage guidance for the LLM) and `tool.ts` (Zod schema + implementation). This separation lets prompts be iterated independently from tool logic. Tools use Zod v4 schemas with snake_case parameter names matching the upstream APIs. API keys are read from `process.env` (server-side only). Tools return JSON strings.

**Tech Stack:** `@langchain/core/tools` (tool function), `zod/v4` (schemas), `@langchain/google-genai` (image generation), native `fetch` (Tavily HTTP calls)

---

## File Structure

```
apps/agents/src/nexus/
├── tools/
│   ├── search/
│   │   ├── prompt.ts     — description + usage guidance
│   │   └── tool.ts       — schema + fetch implementation
│   ├── extract/
│   │   ├── prompt.ts
│   │   └── tool.ts
│   ├── map/
│   │   ├── prompt.ts
│   │   └── tool.ts
│   ├── generate-image/
│   │   ├── prompt.ts
│   │   └── tool.ts
│   └── index.ts          — barrel export with grouped arrays
├── __tests__/
│   ├── search.test.ts
│   ├── extract.test.ts
│   ├── map.test.ts
│   ├── generate-image.test.ts
│   ├── tools-index.test.ts
│   └── tools-integration.test.ts
```

## Conventions

- **Tool names**: `snake_case` — `tavily_search`, `tavily_extract`, `tavily_map`, `generate_image`
- **Parameter names**: `snake_case` matching the upstream API (e.g., `search_depth`, `max_results`, `chunks_per_source`)
- **Zod**: Import from `"zod/v4"` (project uses Zod 4.x). Use `z.safeParse(schema, value)` standalone API. Export both schemas and inferred types (`type-export-schemas-and-types`).
- **API keys**: `process.env.TAVILY_API_KEY` and `process.env.GOOGLE_API_KEY` — server-side only, no runtime context needed
- **Return type**: Tools return `string` (JSON-serialized for structured data) — this is what LLMs consume best
- **prompt.ts pattern**: Exports `TOOL_NAME`, `TOOL_DESCRIPTION` constants. The description tells the LLM when and how to use the tool. Kept separate from `tool.ts` so prompt engineering can be iterated without touching implementation.
- **tool.ts pattern**: Exports the Zod schema, inferred type, and the `tool()` definition. Imports description from `prompt.ts`.

---

### Task 1: Tavily Search Tool

**Files:**
- Create: `apps/agents/src/nexus/tools/search/prompt.ts`
- Create: `apps/agents/src/nexus/tools/search/tool.ts`
- Test: `apps/agents/src/nexus/__tests__/search.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/agents/src/nexus/__tests__/search.test.ts
import { describe, it, expect } from "vitest";
import { tavilySearch } from "../tools/search/tool.js";
import { TOOL_NAME, TOOL_DESCRIPTION } from "../tools/search/prompt.js";

describe("search prompt", () => {
  it("should export TOOL_NAME as tavily_search", () => {
    expect(TOOL_NAME).toBe("tavily_search");
  });

  it("should export a detailed TOOL_DESCRIPTION", () => {
    expect(TOOL_DESCRIPTION.length).toBeGreaterThan(50);
  });
});

describe("tavilySearch tool", () => {
  it("should be a LangChain tool with correct name", () => {
    expect(tavilySearch.name).toBe("tavily_search");
  });

  it("should have a description matching the prompt", () => {
    expect(tavilySearch.description).toBe(TOOL_DESCRIPTION);
  });

  it("should have a schema", () => {
    expect(tavilySearch.schema).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/search.test.ts`
Expected: FAIL — cannot resolve `../tools/search/tool.js`

- [ ] **Step 3: Write the prompt file**

```typescript
// apps/agents/src/nexus/tools/search/prompt.ts
export const TOOL_NAME = "tavily_search";

export const TOOL_DESCRIPTION =
  "Search the web using Tavily. Returns results with title, URL, content snippet, and relevance score. " +
  "Use for finding current information, researching topics, or gathering sources. " +
  "Supports filtering by topic (general/news/finance), time range, and domains. " +
  "Use 'advanced' search_depth for detailed multi-chunk results, 'basic' for balanced results, " +
  "'fast' for lower latency, or 'ultra-fast' for time-critical searches.";
```

- [ ] **Step 4: Write the tool file**

```typescript
// apps/agents/src/nexus/tools/search/tool.ts
import { tool } from "@langchain/core/tools";
import { z } from "zod/v4";
import { TOOL_NAME, TOOL_DESCRIPTION } from "./prompt.js";

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
    .union([z.boolean(), z.enum(["basic", "advanced"])])
    .optional()
    .default(false)
    .describe(
      "Include an LLM-generated answer. true or 'basic' for a short answer, 'advanced' for detailed.",
    ),
  include_raw_content: z
    .union([z.boolean(), z.enum(["markdown", "text"])])
    .optional()
    .default(false)
    .describe(
      "Include cleaned page content per result. true or 'markdown' for markdown, 'text' for plain text.",
    ),
  include_images: z
    .boolean()
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
      throw new Error("TAVILY_API_KEY environment variable is not set");
    }

    const response = await fetch("https://api.tavily.com/search", {
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
        `Tavily Search API error (${response.status}): ${errorText}`,
      );
    }

    const data = await response.json();
    return JSON.stringify(data);
  },
  {
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    schema: tavilySearchSchema,
  },
);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/search.test.ts`
Expected: PASS — 5 tests pass

- [ ] **Step 6: Commit**

```bash
git add apps/agents/src/nexus/tools/search/ apps/agents/src/nexus/__tests__/search.test.ts
git commit -m "feat(tools): add tavily_search tool with prompt/tool split"
```

---

### Task 2: Tavily Extract Tool

**Files:**
- Create: `apps/agents/src/nexus/tools/extract/prompt.ts`
- Create: `apps/agents/src/nexus/tools/extract/tool.ts`
- Test: `apps/agents/src/nexus/__tests__/extract.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/agents/src/nexus/__tests__/extract.test.ts
import { describe, it, expect } from "vitest";
import { tavilyExtract } from "../tools/extract/tool.js";
import { TOOL_NAME, TOOL_DESCRIPTION } from "../tools/extract/prompt.js";

describe("extract prompt", () => {
  it("should export TOOL_NAME as tavily_extract", () => {
    expect(TOOL_NAME).toBe("tavily_extract");
  });

  it("should export a detailed TOOL_DESCRIPTION", () => {
    expect(TOOL_DESCRIPTION.length).toBeGreaterThan(50);
  });
});

describe("tavilyExtract tool", () => {
  it("should be a LangChain tool with correct name", () => {
    expect(tavilyExtract.name).toBe("tavily_extract");
  });

  it("should have a description matching the prompt", () => {
    expect(tavilyExtract.description).toBe(TOOL_DESCRIPTION);
  });

  it("should have a schema", () => {
    expect(tavilyExtract.schema).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/extract.test.ts`
Expected: FAIL — cannot resolve `../tools/extract/tool.js`

- [ ] **Step 3: Write the prompt file**

```typescript
// apps/agents/src/nexus/tools/extract/prompt.ts
export const TOOL_NAME = "tavily_extract";

export const TOOL_DESCRIPTION =
  "Extract content from one or more web page URLs using Tavily. " +
  "Returns raw page content, optionally filtered by a query for relevance. " +
  "Use when you have specific URLs and need their content. " +
  "Supports 'advanced' extraction for tables and embedded content. " +
  "Provide a query to rerank extracted chunks by relevance.";
```

- [ ] **Step 4: Write the tool file**

```typescript
// apps/agents/src/nexus/tools/extract/tool.ts
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/extract.test.ts`
Expected: PASS — 5 tests pass

- [ ] **Step 6: Commit**

```bash
git add apps/agents/src/nexus/tools/extract/ apps/agents/src/nexus/__tests__/extract.test.ts
git commit -m "feat(tools): add tavily_extract tool with prompt/tool split"
```

---

### Task 3: Tavily Map Tool

**Files:**
- Create: `apps/agents/src/nexus/tools/map/prompt.ts`
- Create: `apps/agents/src/nexus/tools/map/tool.ts`
- Test: `apps/agents/src/nexus/__tests__/map.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/agents/src/nexus/__tests__/map.test.ts
import { describe, it, expect } from "vitest";
import { tavilyMap } from "../tools/map/tool.js";
import { TOOL_NAME, TOOL_DESCRIPTION } from "../tools/map/prompt.js";

describe("map prompt", () => {
  it("should export TOOL_NAME as tavily_map", () => {
    expect(TOOL_NAME).toBe("tavily_map");
  });

  it("should export a detailed TOOL_DESCRIPTION", () => {
    expect(TOOL_DESCRIPTION.length).toBeGreaterThan(50);
  });
});

describe("tavilyMap tool", () => {
  it("should be a LangChain tool with correct name", () => {
    expect(tavilyMap.name).toBe("tavily_map");
  });

  it("should have a description matching the prompt", () => {
    expect(tavilyMap.description).toBe(TOOL_DESCRIPTION);
  });

  it("should have a schema", () => {
    expect(tavilyMap.schema).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/map.test.ts`
Expected: FAIL — cannot resolve `../tools/map/tool.js`

- [ ] **Step 3: Write the prompt file**

```typescript
// apps/agents/src/nexus/tools/map/prompt.ts
export const TOOL_NAME = "tavily_map";

export const TOOL_DESCRIPTION =
  "Map a website's structure using Tavily. Traverses from a root URL and discovers linked pages. " +
  "Returns a list of discovered URLs with the base URL and total count. " +
  "Use to understand site structure before deep extraction, or to find specific pages within a site. " +
  "Supports natural language instructions for the crawler and regex path/domain filtering.";
```

- [ ] **Step 4: Write the tool file**

```typescript
// apps/agents/src/nexus/tools/map/tool.ts
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/map.test.ts`
Expected: PASS — 5 tests pass

- [ ] **Step 6: Commit**

```bash
git add apps/agents/src/nexus/tools/map/ apps/agents/src/nexus/__tests__/map.test.ts
git commit -m "feat(tools): add tavily_map tool with prompt/tool split"
```

---

### Task 4: Generate Image Tool

**Files:**
- Create: `apps/agents/src/nexus/tools/generate-image/prompt.ts`
- Create: `apps/agents/src/nexus/tools/generate-image/tool.ts`
- Test: `apps/agents/src/nexus/__tests__/generate-image.test.ts`

The generate_image tool uses Gemini's image generation capability via `ChatGoogleGenerativeAI`. Per the design spec, it uses `gemini-3.1-flash-image-preview`. The tool generates the image and returns base64 data — the agent's built-in `write_file` handles saving to the workspace.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/agents/src/nexus/__tests__/generate-image.test.ts
import { describe, it, expect } from "vitest";
import { generateImage } from "../tools/generate-image/tool.js";
import { TOOL_NAME, TOOL_DESCRIPTION } from "../tools/generate-image/prompt.js";

describe("generate-image prompt", () => {
  it("should export TOOL_NAME as generate_image", () => {
    expect(TOOL_NAME).toBe("generate_image");
  });

  it("should export a detailed TOOL_DESCRIPTION", () => {
    expect(TOOL_DESCRIPTION.length).toBeGreaterThan(50);
  });
});

describe("generateImage tool", () => {
  it("should be a LangChain tool with correct name", () => {
    expect(generateImage.name).toBe("generate_image");
  });

  it("should have a description matching the prompt", () => {
    expect(generateImage.description).toBe(TOOL_DESCRIPTION);
  });

  it("should have a schema", () => {
    expect(generateImage.schema).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/generate-image.test.ts`
Expected: FAIL — cannot resolve `../tools/generate-image/tool.js`

- [ ] **Step 3: Write the prompt file**

```typescript
// apps/agents/src/nexus/tools/generate-image/prompt.ts
export const TOOL_NAME = "generate_image";

export const TOOL_DESCRIPTION =
  "Generate an image using Gemini's image generation capability. " +
  "Provide a detailed prompt describing the desired image including style, content, composition, and mood. " +
  "Returns image data that should be saved to the workspace using write_file. " +
  "Use for creating illustrations, diagrams, banners, logos, and other visual content.";
```

- [ ] **Step 4: Write the tool file**

```typescript
// apps/agents/src/nexus/tools/generate-image/tool.ts
import { tool } from "@langchain/core/tools";
import { z } from "zod/v4";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import { TOOL_NAME, TOOL_DESCRIPTION } from "./prompt.js";

export const generateImageSchema = z.object({
  prompt: z
    .string()
    .describe(
      "Detailed description of the image to generate. Be specific about style, content, composition, and mood.",
    ),
  filename: z
    .string()
    .describe(
      "Filename for the generated image (e.g., 'hero-banner.png'). Will be saved to the agent's workspace.",
    ),
});

export type GenerateImageInput = z.infer<typeof generateImageSchema>;

export const generateImage = tool(
  async ({ prompt, filename }) => {
    const model = new ChatGoogleGenerativeAI({
      model: "gemini-3.1-flash-image-preview",
      temperature: 1,
    });

    const response = await model.invoke([
      new HumanMessage({
        content: [
          {
            type: "text",
            text: `Generate an image: ${prompt}`,
          },
        ],
      }),
    ]);

    // Extract image data from response content blocks
    const content = response.content;
    if (typeof content === "string") {
      return JSON.stringify({
        success: false,
        error: "Model returned text instead of an image",
        text: content,
      });
    }

    // Content is an array of blocks — find image blocks
    const imageBlocks = Array.isArray(content)
      ? content.filter(
          (block): block is { type: "image_url"; image_url: { url: string } } =>
            typeof block === "object" &&
            block !== null &&
            "type" in block &&
            block.type === "image_url",
        )
      : [];

    if (imageBlocks.length === 0) {
      const textContent = Array.isArray(content)
        ? content
            .filter(
              (block): block is { type: "text"; text: string } =>
                typeof block === "object" &&
                block !== null &&
                "type" in block &&
                block.type === "text",
            )
            .map((block) => block.text)
            .join("\n")
        : String(content);

      return JSON.stringify({
        success: false,
        error: "No image was generated",
        text: textContent,
        filename,
      });
    }

    return JSON.stringify({
      success: true,
      filename,
      prompt,
      image_count: imageBlocks.length,
      images: imageBlocks.map((block) => ({
        data_url: block.image_url.url,
      })),
      instruction:
        "Use write_file to save the image data to the workspace. The image data is base64 encoded in the data_url field.",
    });
  },
  {
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    schema: generateImageSchema,
  },
);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/generate-image.test.ts`
Expected: PASS — 5 tests pass

- [ ] **Step 6: Commit**

```bash
git add apps/agents/src/nexus/tools/generate-image/ apps/agents/src/nexus/__tests__/generate-image.test.ts
git commit -m "feat(tools): add generate_image tool with prompt/tool split"
```

---

### Task 5: Tools Barrel Export

**Files:**
- Create: `apps/agents/src/nexus/tools/index.ts`
- Test: `apps/agents/src/nexus/__tests__/tools-index.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/agents/src/nexus/__tests__/tools-index.test.ts
import { describe, it, expect } from "vitest";
import {
  tavilySearch,
  tavilyExtract,
  tavilyMap,
  generateImage,
  researchTools,
  creativeTools,
  allTools,
} from "../tools/index.js";

describe("tools barrel export", () => {
  it("should export all 4 individual tools", () => {
    expect(tavilySearch).toBeDefined();
    expect(tavilyExtract).toBeDefined();
    expect(tavilyMap).toBeDefined();
    expect(generateImage).toBeDefined();
  });

  it("should export researchTools array with 3 Tavily tools", () => {
    expect(researchTools).toHaveLength(3);
    expect(researchTools.map((t) => t.name)).toEqual([
      "tavily_search",
      "tavily_extract",
      "tavily_map",
    ]);
  });

  it("should export creativeTools array with generate_image", () => {
    expect(creativeTools).toHaveLength(1);
    expect(creativeTools[0].name).toBe("generate_image");
  });

  it("should export allTools array with all 4 tools", () => {
    expect(allTools).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/tools-index.test.ts`
Expected: FAIL — cannot resolve `../tools/index.js`

- [ ] **Step 3: Write the implementation**

```typescript
// apps/agents/src/nexus/tools/index.ts
export { tavilySearch, tavilySearchSchema } from "./search/tool.js";
export type { TavilySearchInput } from "./search/tool.js";

export { tavilyExtract, tavilyExtractSchema } from "./extract/tool.js";
export type { TavilyExtractInput } from "./extract/tool.js";

export { tavilyMap, tavilyMapSchema } from "./map/tool.js";
export type { TavilyMapInput } from "./map/tool.js";

export { generateImage, generateImageSchema } from "./generate-image/tool.js";
export type { GenerateImageInput } from "./generate-image/tool.js";

import { tavilySearch } from "./search/tool.js";
import { tavilyExtract } from "./extract/tool.js";
import { tavilyMap } from "./map/tool.js";
import { generateImage } from "./generate-image/tool.js";

/**
 * Tools for the Research sub-agent.
 * Includes all Tavily tools for web search, extraction, and site mapping.
 */
export const researchTools = [tavilySearch, tavilyExtract, tavilyMap] as const;

/**
 * Tools for the Creative sub-agent.
 * Includes image generation via Gemini Imagen.
 */
export const creativeTools = [generateImage] as const;

/**
 * All custom tools.
 * Does NOT include auto-provisioned tools (execute, filesystem tools)
 * which come from the DeepAgent backend.
 */
export const allTools = [...researchTools, ...creativeTools] as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/tools-index.test.ts`
Expected: PASS — 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add apps/agents/src/nexus/tools/index.ts apps/agents/src/nexus/__tests__/tools-index.test.ts
git commit -m "feat(tools): add barrel export with grouped tool arrays"
```

---

### Task 6: Integration Tests

**Files:**
- Create: `apps/agents/src/nexus/__tests__/tools-integration.test.ts`

These tests hit the real Tavily API and require `TAVILY_API_KEY` set. They verify the full round-trip: tool invocation -> HTTP request -> response parsing.

- [ ] **Step 1: Write the integration tests**

```typescript
// apps/agents/src/nexus/__tests__/tools-integration.test.ts
import { describe, it, expect } from "vitest";
import { tavilySearch } from "../tools/search/tool.js";
import { tavilyExtract } from "../tools/extract/tool.js";
import { tavilyMap } from "../tools/map/tool.js";

/**
 * Integration tests that hit the real Tavily API.
 * Requires TAVILY_API_KEY environment variable.
 * Skip with: npx vitest run --exclude "**\/integration*" --exclude "**\/tools-integration*"
 */
describe("Tavily Tools Integration", () => {
  it("tavily_search should return results for a query", async () => {
    const result = await tavilySearch.invoke({
      query: "What is TypeScript?",
      max_results: 3,
    });

    const parsed = JSON.parse(result);
    expect(parsed.results).toBeDefined();
    expect(parsed.results.length).toBeGreaterThan(0);
    expect(parsed.results[0]).toHaveProperty("title");
    expect(parsed.results[0]).toHaveProperty("url");
    expect(parsed.results[0]).toHaveProperty("content");
  }, 30000);

  it("tavily_extract should extract content from a URL", async () => {
    const result = await tavilyExtract.invoke({
      urls: "https://en.wikipedia.org/wiki/TypeScript",
    });

    const parsed = JSON.parse(result);
    expect(parsed.results).toBeDefined();
    expect(parsed.results.length).toBeGreaterThan(0);
    expect(parsed.results[0]).toHaveProperty("url");
    expect(parsed.results[0]).toHaveProperty("raw_content");
  }, 30000);

  it("tavily_map should return URLs from a site", async () => {
    const result = await tavilyMap.invoke({
      url: "https://docs.tavily.com",
      max_depth: 1,
      limit: 10,
    });

    const parsed = JSON.parse(result);
    expect(parsed.urls).toBeDefined();
    expect(parsed.urls.length).toBeGreaterThan(0);
    expect(parsed).toHaveProperty("base_url");
  }, 30000);
});
```

- [ ] **Step 2: Run the unit tests to make sure they still pass**

Run: `cd apps/agents && npx vitest run --exclude "**/integration*" --exclude "**/tools-integration*"`
Expected: All unit tests pass

- [ ] **Step 3: Commit**

```bash
git add apps/agents/src/nexus/__tests__/tools-integration.test.ts
git commit -m "test(tools): add Tavily integration tests"
```

---

### Task 7: Run All Tests and Final Verification

- [ ] **Step 1: Run all unit tests**

Run: `cd apps/agents && npx vitest run --exclude "**/integration*" --exclude "**/tools-integration*"`
Expected: All tests pass (existing Plan 2 tests + new Plan 3 tests)

- [ ] **Step 2: Verify TypeScript compilation**

Run: `cd apps/agents && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Verify lint passes**

Run: `cd apps/agents && npm run lint`
Expected: No lint errors (or only pre-existing ones)
