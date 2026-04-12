---
created: 2026-04-12
updated: 2026-04-12
tags: [tavily, extract, web-scraping, http-api]
sources: [raw/custom/tavily/extract.md]
---

# Tavily Extract API

POST `/extract` on the Tavily API retrieves raw web page content from one or more URLs. It is optimized for LLM consumption and returns structured text (markdown or plain), optional images, and a favicon per result.

## Content

### Endpoint

```
POST https://api.tavily.com/extract
Authorization: Bearer tvly-YOUR_API_KEY
Content-Type: application/json
```

Authentication uses Bearer token in the `Authorization` header. The API key is the `tvly-...` key issued by Tavily.

### Request Parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `urls` | string or string[] | yes | — | One URL or up to 20 URLs to extract content from. |
| `query` | string | no | — | User intent for reranking extracted chunks. When provided, `raw_content` contains the top-ranked chunks joined by `[...]`. |
| `chunks_per_source` | integer (1–5) | no | 3 | Max chunks returned per source when `query` is provided. Each chunk is up to 500 characters. |
| `extract_depth` | `"basic"` \| `"advanced"` | no | `"basic"` | `basic` fetches standard page text. `advanced` also extracts tables and embedded content; higher success rate, higher latency. |
| `include_images` | boolean | no | `false` | If `true`, include a list of image URLs extracted from each page. |
| `include_favicon` | boolean | no | `false` | If `true`, include the favicon URL for each result. |
| `format` | `"markdown"` \| `"text"` | no | `"markdown"` | Output format for `raw_content`. `text` may increase latency. |
| `timeout` | float (1.0–60.0) | no | depth-based | Max seconds to wait per URL. Defaults: 10 s for `basic`, 30 s for `advanced`. |
| `include_usage` | boolean | no | `false` | Include credit usage in the response. Note: value may be 0 until 5 successful extractions are reached in a billing window. |

### Response Shape (HTTP 200)

```json
{
  "results": [
    {
      "url": "https://example.com/page",
      "raw_content": "Extracted markdown or text content...",
      "images": ["https://example.com/img.png"],
      "favicon": "https://example.com/favicon.ico"
    }
  ],
  "failed_results": [
    {
      "url": "https://example.com/broken",
      "error": "Reason the URL could not be processed"
    }
  ],
  "response_time": 0.82,
  "usage": { "credits": 1 },
  "request_id": "123e4567-e89b-12d3-a456-426614174111"
}
```

Key response fields:

- **`results`** — Array of successfully extracted pages. Always present; may be empty.
- **`results[].raw_content`** — Full page text. When `query` is provided, contains top-ranked chunks separated by `[...]` instead of the full page.
- **`results[].images`** — Only present when `include_images: true`.
- **`results[].favicon`** — Only present when `include_favicon: true`.
- **`failed_results`** — Array of URLs that could not be processed, each with a descriptive `error` string. Always check this — partial failures are silent.
- **`response_time`** — Wall-clock seconds for the full request.
- **`usage.credits`** — Credits consumed. May read `0` before the 5-extraction billing window closes.
- **`request_id`** — Opaque ID for support escalation.

### Credit Costs

- `basic` extraction: 1 credit per 5 successful URL extractions.
- `advanced` extraction: 2 credits per 5 successful URL extractions.
- Credits are tracked in batches of 5; `usage.credits` may lag until the batch closes.

### Error Codes

| Status | Meaning |
|---|---|
| 400 | Bad request — e.g. more than 20 URLs submitted. |
| 401 | Missing or invalid API key. |
| 429 | Rate limit exceeded. |
| 432 | Plan usage limit exceeded. |
| 433 | Pay-as-you-go credit limit exceeded. |
| 500 | Internal server error. |

All error responses share the shape `{ "detail": { "error": "..." } }`.

### Nexus Integration Note

In the Nexus `tavily_extract` tool (`tools/extract/tool.ts`), the API key is read from `runtime.context` — never hardcoded. The tool wraps a single POST to this endpoint and surfaces `results` and `failed_results` to the calling agent. The `raw_content` field is what the research agent quotes in its summaries.

## Related

- [[tavily-search-api]] — keyword/semantic search endpoint; complements extract for discovery + content retrieval workflows
- [[tavily-map-api]] — crawl endpoint that returns URL lists rather than content
- [[tavily-overview]] — high-level overview of the Tavily platform and all endpoints

## Sources

- `raw/custom/tavily/extract.md` — OpenAPI 3.0 spec for POST /extract, including all request parameters, full response schema, credit model, and error codes
