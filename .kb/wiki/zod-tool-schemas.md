---
created: 2026-04-12
updated: 2026-04-12
tags: [langchain, tools, zod, langchain-core]
sources: [raw/langchain/langchain/tools.md]
---

# Zod Tool Schemas

LangChain tools use [Zod](https://zod.dev/) schemas to define and validate input parameters. The schema is the contract between the model and the tool: it tells the model what arguments to provide and how they are typed.

## Content

### Basic Schema

Pass a `z.object({})` to the `schema` field of the [[tool-decorator|`tool()` factory]]. Each field in the object becomes a parameter the model must supply.

```typescript
import * as z from "zod"
import { tool } from "langchain"

const searchDatabase = tool(
  ({ query, limit }) => `Found ${limit} results for '${query}'`,
  {
    name: "search_database",
    description: "Search the customer database.",
    schema: z.object({
      query: z.string().describe("Search terms to look for"),
      limit: z.number().describe("Maximum number of results to return"),
    }),
  }
);
```

### Parameter Descriptions

Every parameter should have a `.describe("...")` annotation. These descriptions are injected into the tool's definition when it is sent to the model. Without them, the model must guess parameter intent from field names alone, which degrades invocation accuracy.

### snake_case Convention

Use `snake_case` for all parameter names (e.g., `user_id`, `max_results`, `base_url`). Two reasons:

1. **Provider compatibility** — some model providers have issues with parameter names containing spaces or special characters.
2. **API alignment** — Nexus tools wrap Tavily and other REST APIs whose own field names are `snake_case`. Matching the upstream names eliminates translation layers and makes tool implementations straightforward to map.

For example, Nexus's `tavily_search` tool mirrors Tavily's own query parameters directly:

```typescript
schema: z.object({
  query: z.string().describe("Search query"),
  max_results: z.number().optional().describe("Max results to return"),
  search_depth: z.enum(["basic", "advanced"]).optional(),
})
```

### Optional and Default Parameters

Use `.optional()` for parameters the model may omit. Zod will parse them as `undefined` if not provided. Add `.default(value)` to supply a fallback:

```typescript
schema: z.object({
  query: z.string(),
  limit: z.number().optional().default(10),
})
```

### Empty Schema

Tools with no inputs use `z.object({})`:

```typescript
schema: z.object({})
```

This is common for tools that read from `config.context` rather than from model-supplied arguments.

### Schema Validation

Zod validation runs automatically before the tool implementation is called. If the model passes arguments that fail validation (wrong type, missing required field), the error is caught by `ToolNode` and returned as an error `ToolMessage`. Configure `handleToolErrors` on `ToolNode` to control this behavior.

## Related

- [[langchain-tools]]
- [[tool-decorator]]
- [[tool-call]]
- [[tavily-search-api]]
- [[tavily-extract-api]]

## Sources

- `raw/langchain/langchain/tools.md` — Zod schema usage, parameter descriptions, snake_case naming, optional parameters
