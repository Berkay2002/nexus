---
created: 2026-04-12
updated: 2026-04-12
tags: [langchain, langchain-core, chat-models, structured-output, tool-call]
sources: [raw/langchain/langchain/models.md]
---

# withStructuredOutput

`withStructuredOutput(schema, options?)` is a method on [[langchain-models|LangChain chat models]] that returns a new model variant whose output is constrained to match a declared schema. The returned model's `invoke()` / `stream()` calls produce parsed, typed objects instead of raw `AIMessage` instances.

## Content

### Overview

Calling `model.withStructuredOutput(schema)` creates a wrapper that:
1. Encodes the schema as a tool definition or JSON schema directive
2. Sends it to the provider using the best available method
3. Parses and (for Zod/Standard Schema) validates the response before returning

### Schema Types

**Zod (preferred for TypeScript)**

```typescript
import * as z from "zod";

const Movie = z.object({
  title: z.string().describe("The title of the movie"),
  year: z.number().describe("The year released"),
  director: z.string(),
  rating: z.number(),
});

const structuredModel = model.withStructuredOutput(Movie);
const result = await structuredModel.invoke("Describe Inception");
// result is typed as { title: string; year: number; director: string; rating: number }
```

Output is automatically validated against the Zod schema. Nested schemas work by composing Zod objects normally.

**JSON Schema (raw)**

```typescript
const schema = {
  title: "Movie",
  type: "object",
  properties: {
    title: { type: "string" },
    year: { type: "integer" },
  },
  required: ["title", "year"],
};

const structuredModel = model.withStructuredOutput(schema, { method: "jsonSchema" });
```

No automatic validation — you receive a plain object matching the schema shape.

**Standard Schema**

Any schema library implementing the [Standard Schema](https://standardschema.dev/) spec is supported (e.g., Valibot). Validated at runtime via `schema['~standard'].validate()`.

### Method Options

The `method` option controls how the schema is sent to the provider:

| Value | Behavior |
|---|---|
| `"functionCalling"` | Schema encoded as a tool definition; model "calls" it to return structured data |
| `"jsonSchema"` | Native JSON Schema mode (OpenAI, Gemini) |
| `"jsonMode"` | Prompt-level instruction + response parsing (less reliable, no schema enforcement) |

The default is inferred from `model.profile` — providers that support native structured output use `functionCalling` or `jsonSchema` automatically.

### includeRaw Option

Pass `includeRaw: true` to receive both the parsed output and the raw `AIMessage`:

```typescript
const structuredModel = model.withStructuredOutput(Movie, { includeRaw: true });
const response = await structuredModel.invoke("Describe Inception");
// response: { raw: AIMessage { ... }, parsed: { title: "Inception", ... } }
```

Useful for accessing `response_metadata` (token counts, cache hits) alongside the parsed value.

### Nexus Usage

Nexus uses `withStructuredOutput` in the meta-router to constrain the Flash classifier's output to a routing decision schema, and in tools where extraction results must conform to a typed interface. The tier registry resolves the right model first; `withStructuredOutput` is then chained on top.

## Related

- [[langchain-models]]
- [[chat-model-interface]]
- [[bind-tools]]
- [[langchain-messages]]

## Sources

- `raw/langchain/langchain/models.md` — Zod/JSON Schema/Standard Schema examples, method options, includeRaw, validation behavior
