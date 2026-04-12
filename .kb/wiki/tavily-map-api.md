---
created: 2026-04-12
updated: 2026-04-12
tags: [tavily, map, http-api, web-crawling]
sources: [raw/custom/tavily/map.md]
---

# Tavily Map API

Tavily Map (`POST /map`) traverses a website like a graph, following links in parallel across multiple depth levels, to generate a comprehensive list of discovered URLs. It is purpose-built for LLM agents that need to enumerate a site's structure before extracting content.

## Request

**Endpoint:** `POST https://api.tavily.com/map`

**Auth:** Bearer token — `Authorization: Bearer tvly-YOUR_API_KEY`

**Required body field:**

| Field | Type | Description |
|---|---|---|
| `url` | string | Root URL to begin crawling from (e.g., `docs.tavily.com`) |

**Optional parameters:**

| Field | Type | Default | Notes |
|---|---|---|---|
| `max_depth` | integer | 1 | How many link-hops from the base URL. Range: 1–5. |
| `max_breadth` | integer | 20 | Max links followed per page at each level. Range: 1–500. |
| `limit` | integer | 50 | Total pages the crawler processes before stopping. |
| `instructions` | string | null | Natural-language instructions for the crawler (e.g., "Find all pages about the Python SDK"). Increases cost to 2 credits per 10 pages instead of 1. |
| `select_paths` | string[] | null | Regex patterns — only include URLs matching these path patterns (e.g., `/docs/.*`). |
| `select_domains` | string[] | null | Regex patterns to restrict crawling to specific domains/subdomains. |
| `exclude_paths` | string[] | null | Regex patterns — exclude URLs with these path patterns (e.g., `/admin/.*`). |
| `exclude_domains` | string[] | null | Regex patterns to exclude specific domains from crawling. |
| `allow_external` | boolean | true | Whether to include links to external domains in the results. |
| `timeout` | float | 150 | Max seconds to wait before timing out. Range: 10–150. |
| `include_usage` | boolean | false | Include credit usage info in the response. May return 0 if fewer than 10 pages have been successfully mapped. |

## Response Shape

**IMPORTANT — `results`, not `urls`:** The response uses `results` for the URL array, not `urls`. This has caused bugs in multiple implementations. Do not assume the field is named `urls`.

```json
{
  "base_url": "docs.tavily.com",
  "results": [
    "https://docs.tavily.com/welcome",
    "https://docs.tavily.com/documentation/api-credits",
    "https://docs.tavily.com/documentation/about"
  ],
  "response_time": 1.23,
  "usage": { "credits": 1 },
  "request_id": "123e4567-e89b-12d3-a456-426614174111"
}
```

- `results` — array of URL **strings** (not objects). Each element is a discovered URL.
- `base_url` — the root URL that was mapped (echoed back from the request).
- `response_time` — seconds the request took.
- `usage` — present only when `include_usage: true`. Credits billed at 1 per 10 pages (2 per 10 with `instructions`).
- `request_id` — share with Tavily support to debug specific requests.

## Error Codes

| Status | Meaning |
|---|---|
| 400 | Bad request (e.g., missing `url`) |
| 401 | Missing or invalid API key |
| 403 | URL is not supported |
| 429 | Rate limit exceeded |
| 432 | Plan usage limit exceeded |
| 433 | Pay-as-you-go limit exceeded |
| 500 | Internal server error |

All error bodies follow: `{ "detail": { "error": "<message>" } }`

## Credits & Pricing

- Default (no `instructions`): 1 credit per 10 successfully mapped pages.
- With `instructions`: 2 credits per 10 successfully mapped pages.
- `usage.credits` may return 0 if the batch of 10 pages has not yet completed.

## Usage in Nexus

The `tavily_map` tool in [[tavily-overview]] lives at `apps/agents/src/nexus/tools/map/tool.ts`. When consuming the response, always access `response.results` (the URL string array) and `response.base_url` — never `response.urls`, which does not exist.

```typescript
// Correct
const urls: string[] = response.results;
const base = response.base_url;

// Wrong — this field does not exist
const urls = response.urls; // undefined
```

## Related

- [[tavily-search-api]]
- [[tavily-extract-api]]
- [[tavily-overview]]

## Sources

- `raw/custom/tavily/map.md` — OpenAPI spec for `POST /map`, full parameter list, response schema, error codes, and code samples
