---
created: 2026-04-12
updated: 2026-04-12
tags: [tavily, search, tool-call]
sources: [raw/custom/tavily/search.md]
---

# Tavily Search API

The Tavily Search API (`POST https://api.tavily.com/search`) is the core search endpoint of [[tavily-overview]]. It executes a web search query and returns ranked results with content snippets, relevance scores, and an optional LLM-generated answer — designed to be consumed directly by LLM agents without additional parsing.

## Authentication

Bearer token. Pass `Authorization: Bearer tvly-YOUR_API_KEY`. Only `query` is required; all other parameters are optional.

## Request Parameters

### Core

| Parameter | Type | Default | Description |
|---|---|---|---|
| `query` | string | **required** | The search query. |
| `search_depth` | enum | `basic` | Latency vs. relevance tradeoff. See below. |
| `max_results` | integer | `5` | Maximum results returned (0–20). |
| `topic` | enum | `general` | `general`, `news`, or `finance`. Use `news` for real-time current events. |

### Search Depth

Four modes control how `results[].content` is generated and how many credits are consumed:

- `basic` (1 credit) — one NLP summary per URL. Balanced latency/relevance.
- `fast` (1 credit) — multiple semantically relevant chunks per URL; lower latency than basic.
- `ultra-fast` (1 credit) — single NLP summary; lowest latency.
- `advanced` (2 credits) — multiple high-precision chunks per URL; highest relevance. Use with `chunks_per_source` (1–3, default 3; each chunk is max 500 characters, rendered as `<chunk 1> [...] <chunk 2>`).

### Filtering

| Parameter | Type | Default | Description |
|---|---|---|---|
| `include_domains` | string[] | `[]` | Whitelist up to 300 domains. |
| `exclude_domains` | string[] | `[]` | Blacklist up to 150 domains. |
| `country` | string | `null` | Boost results from a specific country. Only valid when `topic` is `general`. |
| `time_range` | enum | `null` | Filter by publish/update date: `day`, `week`, `month`, `year` (or `d`, `w`, `m`, `y`). |
| `start_date` / `end_date` | string | `null` | Exact date range filter, format `YYYY-MM-DD`. |
| `exact_match` | boolean | `false` | Return only results containing exact quoted phrase(s) from the query. |

### Response Enrichment

| Parameter | Type | Default | Description |
|---|---|---|---|
| `include_answer` | boolean \| `"basic"` \| `"advanced"` | `false` | Add an LLM-generated answer field. `true`/`"basic"` = quick answer; `"advanced"` = detailed. |
| `include_raw_content` | boolean \| `"markdown"` \| `"text"` | `false` | Include cleaned full-page HTML. `true`/`"markdown"` returns markdown; `"text"` returns plain text (higher latency). |
| `include_images` | boolean | `false` | Add a top-level `images` list and per-result `images` arrays. |
| `include_image_descriptions` | boolean | `false` | Requires `include_images: true`. Adds `description` text to each image object. |
| `include_favicon` | boolean | `false` | Include favicon URL on each result. |
| `include_usage` | boolean | `false` | Include credit usage details in the response. |

### Automation

| Parameter | Type | Default | Description |
|---|---|---|---|
| `auto_parameters` | boolean | `false` | Tavily auto-configures parameters from query intent (costs 2 credits; may escalate `search_depth` to `advanced`). `include_answer`, `include_raw_content`, and `max_results` must always be set manually. |
| `safe_search` | boolean | `false` | Enterprise only. Filters adult/unsafe content. Not supported for `fast` or `ultra-fast`. |

## Response Shape

```json
{
  "query": "string",
  "answer": "string | null",
  "images": [{ "url": "string", "description": "string?" }],
  "results": [
    {
      "title": "string",
      "url": "string",
      "content": "string",
      "score": 0.81,
      "raw_content": "string | null",
      "favicon": "string | null",
      "images": [{ "url": "string", "description": "string?" }]
    }
  ],
  "auto_parameters": { "topic": "general", "search_depth": "basic" },
  "response_time": 1.67,
  "usage": { "credits": 1 },
  "request_id": "uuid"
}
```

Key facts for Nexus tooling:

- `results` is always present (required). `answer` is always present in the schema but `null` unless `include_answer` was set.
- `results[].content` is the primary field agents read — it contains the NLP summary or chunk sequence.
- `results[].score` is a float relevance score; results are pre-sorted descending by score.
- `results[].raw_content` is `null` unless `include_raw_content` is enabled.
- `results[].published_date` is not in this spec version but may appear in practice for `topic: news` results [unverified].
- Top-level `images` comes from image search, distinct from per-result `images` which are extracted from the page.

## Errors

| Code | Meaning |
|---|---|
| 400 | Bad request — invalid parameter value (e.g., unknown topic). |
| 401 | Unauthorized — API key missing or wrong. |
| 429 | Rate limit exceeded. |
| 432 | Plan usage limit exceeded. |
| 433 | Pay-as-you-go limit exceeded. |
| 500 | Internal server error. |

Error bodies always have the shape `{ "detail": { "error": "string" } }`.

## Nexus Usage

In Nexus, the `tavily_search` tool in `apps/agents/src/nexus/tools/search/tool.ts` wraps this endpoint. The API key is accessed via `runtime.context` — never hardcoded. The research sub-agent is the primary consumer.

## Related

- [[tavily-overview]]
- [[tavily-extract-api]]
- [[tavily-map-api]]
- [[exa-search-api]] — alternative search API (semantic/neural ranking) considered for research agent
- [[exa-overview]] — product-level comparison of Exa vs Tavily

## Sources

- `raw/custom/tavily/search.md` — complete OpenAPI 3.0.3 spec for `POST /search`
