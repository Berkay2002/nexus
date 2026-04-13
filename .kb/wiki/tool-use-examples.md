---
created: 2026-04-13
updated: 2026-04-13
tags: [anthropic, claude, tool-call, zod, beta]
sources: [raw/anthropic-blogs/mcp-tool-use.md]
---

# Tool Use Examples

A Claude Developer Platform beta feature shipped **November 24, 2025** under the [[anthropic-advanced-tool-use|`advanced-tool-use-2025-11-20`]] beta header. Tool Use Examples let you attach concrete sample invocations to a tool definition via an `input_examples` field, so Claude sees worked usage patterns instead of only a JSON Schema.

## The problem

JSON Schema describes **structure**, not **usage**. It tells the model that a field is a string, but not:

- which **date format** to use (`2024-11-06` vs `Nov 6, 2024` vs `11/06/2024`),
- which **naming conventions** an API expects for tag values (kebab, snake, title case),
- how **optional parameters correlate** with other fields (e.g., priority `critical` implies a label subset),
- how to fill **nested objects** when the schema allows many valid shapes but only some are ergonomic.

The blog's framing: schema defines what's legal, examples define what's idiomatic. For tools whose happy-path usage isn't obvious from the type definitions, showing Claude one or two realistic calls eliminates a class of formatting mistakes that prompts-alone can't reliably catch.

## The shape

Add an `input_examples` array to a tool definition. Each entry is a concrete, realistic invocation — the exact argument object you'd want Claude to produce. The blog's example:

```json
{
  "name": "create_ticket",
  "input_schema": { "...": "..." },
  "input_examples": [
    {
      "title": "Login page returns 500 error",
      "priority": "critical",
      "labels": ["bug", "authentication"],
      "due_date": "2024-11-06"
    }
  ]
}
```

What that one example communicates that the schema alone could not:

- **Date format is ISO `YYYY-MM-DD`**, not a localized string.
- **`priority` uses lowercase enum values** (`critical`, not `Critical` or `CRIT`).
- **Labels are kebab-case-adjacent nouns** (`"authentication"`, not `"auth"` or `"Authentication"`).
- **A realistic title reads like a bug report**, not a fragment — tells Claude how much detail to include.

One example carries all four of those conventions. Writing them out as prose in the tool description would be longer, less precise, and easier to ignore.

## Design guidance from the blog

- **Use realistic data.** Synthetic placeholders (`{title}`, `"example"`) teach nothing; actual plausible titles, real-looking IDs, and realistic date/time values teach the model what "looks right" for your tool.
- **Focus on usage that isn't obvious from the schema.** If the tool has a single required string and obvious semantics, examples add little. If it has nested objects, enums, format-sensitive fields, or correlations between fields, examples pay for themselves.
- **One or two examples is usually enough.** The blog shows a single example in its canonical illustration — Tool Use Examples are a few-shot nudge, not a training corpus.

## Relationship to the other two features

Tool Use Examples are the odd feature in the Nov 24 release. [[tool-search-tool]] and [[programmatic-tool-calling]] both address the token cost of tool use at scale; Tool Use Examples addresses **quality** of tool use at any scale. You'd adopt it even with a single tool if that tool's happy-path call format is non-obvious.

The three features compose cleanly in principle — each targets a different axis:

- **Tool Search Tool** — decides *which* tools Claude sees
- **Programmatic Tool Calling** — decides *how* Claude orchestrates them
- **Tool Use Examples** — decides *how well* Claude fills their arguments

> **WARNING — Tool Use Examples and [[tool-search-tool|Tool Search Tool]] are mutually exclusive.** The Tool Search Tool docs explicitly state: "The tool search tool is not compatible with tool use examples. If you need to provide examples of tool usage, use standard tool calling without tool search." You cannot adopt both features on the same tool set — even though they target different axes, they don't compose. Pick the one that addresses your bigger bottleneck: token bloat → Tool Search Tool; argument-format ambiguity → Tool Use Examples. [[programmatic-tool-calling|Programmatic Tool Calling]] has no documented incompatibility with either.

## Relevance to Nexus

Nexus's [[langchain-tools|custom tools]] are defined with [[zod-tool-schemas|Zod schemas]] via the LangChain [[tool-decorator|`tool()` factory]]. The schema pipeline is well-developed; the examples pipeline does not exist. Several Nexus tools have subtle format requirements that examples would capture well:

- **Tavily `search`** — `search_depth` enum semantics, `max_results` soft caps, the [[tavily-map-api|`map` endpoint's `results`-not-`urls` footgun]].
- **`generate_image`** — dimensions, prompt structure, format specifiers.
- **AIO Sandbox tools via MCP** — many have non-obvious parameter shapes (see the [[aio-sandbox-openapi-overview|OpenAPI overview]] for the gotcha catalog).

Whether adopting Tool Use Examples in Nexus is worthwhile hinges on two unknowns:

1. **[unverified] — LangChain support.** `@langchain/anthropic` and the wider LangChain tool pipeline don't currently document an `input_examples` field on the [[langchain-tools|LangChain tool type]]. Adopting this feature may require dropping to raw Anthropic tool blocks or waiting for first-class support.
2. **Provider-specificity.** Tool Use Examples live inside the Anthropic API surface. On [[deepagents-models|non-Anthropic tiers]], the `input_examples` field is ignored. For a multi-provider stack, examples need either a provider-conditional path or prose-equivalent fallback in the tool descriptions.

In the meantime, the nearest portable equivalent is **writing realistic example call snippets directly into the tool description string** — the model sees the description on every provider, so the examples arrive as prose rather than structured data. That's a worse representation than `input_examples` but it survives a provider swap and requires no beta flag.

## Related

- [[anthropic-advanced-tool-use]] — umbrella for the three beta features; covers the beta header and layering guidance
- [[tool-search-tool]] — companion feature: which tools Claude sees
- [[programmatic-tool-calling]] — companion feature: how Claude orchestrates them
- [[chat-anthropic]] — the LangChain chat model to enable the beta header on
- [[langchain-tools]] — LangChain's tool system; where first-class support would land
- [[tool-decorator]] — the `tool()` factory that builds the tools this feature would decorate
- [[zod-tool-schemas]] — Zod schemas; the structural half of tool definitions, complemented by examples

## Sources

- `raw/anthropic-blogs/mcp-tool-use.md` — "Introducing advanced tool use on the Claude Developer Platform" (Anthropic engineering blog, Nov 24 2025), Tool Use Examples section. Includes the `input_examples` JSON contract, the `create_ticket` worked example (date format, priority enum, labels, title), the schema-vs-usage framing, and the "realistic data" / "focus on non-obvious usage" best practices.
