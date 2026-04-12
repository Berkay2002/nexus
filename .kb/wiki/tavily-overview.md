---
created: 2026-04-12
updated: 2026-04-12
tags: [tavily, search, extract, map]
sources: [raw/custom/tavily/search.md]
---

# Tavily Overview

Tavily is a search, extract, and map API suite purpose-built for LLM agents. It returns clean, relevance-ranked results without requiring agents to parse raw HTML, and provides an optional LLM-generated answer field so agents can skip an extra synthesis step for simple lookups.

## What Tavily Provides

Tavily exposes three distinct endpoints under `https://api.tavily.com/`:

- **[[tavily-search-api]]** (`POST /search`) — executes a web search query and returns ranked results with titles, URLs, content snippets, relevance scores, and optionally an LLM-synthesized answer or full page content.
- **[[tavily-extract-api]]** (`POST /extract`) — scrapes and cleans full page content from one or more URLs, optimized for LLM consumption.
- **[[tavily-map-api]]** (`POST /map`) — crawls a domain and returns a structured sitemap as a list of URL strings under the `results` key (not `urls`).

## Authentication

All endpoints use Bearer token authentication. Pass your API key in the `Authorization` header as `Bearer tvly-YOUR_API_KEY`. The key is also available via the `TAVILY_API_KEY` environment variable in the Nexus agents runtime and accessed via `runtime.context`.

## Credits and Pricing

Requests consume API credits. The `/search` endpoint costs 1 credit for `basic`, `fast`, or `ultra-fast` search depths and 2 credits for `advanced` or when `auto_parameters` escalates depth. The `include_answer: "advanced"` option does not add extra cost beyond the search depth charge.

## Comparison with Exa

[[exa-overview]] is an alternative search provider also available for Nexus research agents. Tavily's strength is broad web coverage with LLM-optimized snippets and a built-in answer layer. Exa is designed around semantic/neural search and is better suited for concept-similarity queries rather than keyword or news lookups. Nexus currently uses Tavily exclusively (no Exa integration) per the design spec.

## Related

- [[tavily-search-api]]
- [[tavily-extract-api]]
- [[tavily-map-api]]
- [[exa-overview]]

## Sources

- `raw/custom/tavily/search.md` — OpenAPI spec for `/search`; overview inferred from API description and tags listing Search, Extract, Crawl, Map, Research endpoints
