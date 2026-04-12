---
created: 2026-04-12
updated: 2026-04-12
tags: [exa, search, http-api]
sources: [raw/custom/exa/search.md]
---

# Exa Search API — POST /search

The Exa `/search` endpoint performs internet-scale search using an embeddings-based model, with an optional `contents` block that extracts text, highlights, and LLM-generated summaries in the same request. It also supports deep-search variants that synthesize structured output across multiple crawled pages.

## Endpoint

```
POST https://api.exa.ai/search
Authorization: x-api-key: <YOUR-EXA-API-KEY>
Content-Type: application/json
```

The API key can also be supplied as `Authorization: Bearer <key>`.

## Request Parameters

### Top-level (required)

| Field | Type | Description |
|-------|------|-------------|
| `query` | string | The search query. For neural/auto types, phrase this as a natural-language description of what the ideal result looks like. |

### Top-level (optional)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | enum | `auto` | Search mode. See search types below. |
| `category` | enum | — | Content category filter: `company`, `research paper`, `news`, `personal site`, `financial report`, `people`. |
| `numResults` | integer | 10 | Number of results. Max 100. |
| `includeDomains` | string[] | — | Restrict results to these domains (max 1200). |
| `excludeDomains` | string[] | — | Exclude these domains. Not supported for `company` / `people` categories. |
| `startPublishedDate` | ISO 8601 | — | Only return results published after this date. |
| `endPublishedDate` | ISO 8601 | — | Only return results published before this date. |
| `startCrawlDate` | ISO 8601 | — | Only return results crawled by Exa after this date. |
| `endCrawlDate` | ISO 8601 | — | Only return results crawled by Exa before this date. |
| `includeText` | string[] | — | Strings that must appear in result text. Max 1 entry, up to 5 words. |
| `excludeText` | string[] | — | Strings that must not appear in result text. Max 1 entry, up to 5 words. Checks first 1000 words. |
| `moderation` | boolean | `false` | Filter unsafe content from results. |
| `additionalQueries` | string[] | — | Extra query variations for deep-search variants. |
| `stream` | boolean | `false` | Return response as OpenAI-compatible SSE stream. |
| `outputSchema` | object | — | JSON Schema for synthesized output. Triggers a synthesis pass over crawled content. |
| `systemPrompt` | string | — | Instructions for synthesized output and deep-search planning. |
| `userLocation` | string | — | Two-letter ISO country code for geo-relevance (e.g. `US`). |
| `contents` | object | — | Inline content extraction options (see Contents block below). |

### Search Types

| `type` | Description |
|--------|-------------|
| `neural` | Embeddings-based semantic search (max 100 results). |
| `fast` | Streamlined version of search models — lower latency than neural. |
| `auto` (default) | Intelligently combines neural and other methods. |
| `instant` | Lowest-latency search, optimized for real-time applications. |
| `deep-lite` | Lightweight synthesized output mode. |
| `deep` | Light deep search with synthesis. |
| `deep-reasoning` | Base deep search with reasoning. Max 100 results. |

### Category Restrictions

The `company` and `people` categories have restricted filter support. The following parameters are **not** supported for these categories: `startPublishedDate`, `endPublishedDate`, `startCrawlDate`, `endCrawlDate`, `includeText`, `excludeText`, `excludeDomains`. For `people`, `includeDomains` only accepts LinkedIn domains. Using unsupported parameters returns a `400` error.

### Contents Block

The `contents` object is nested inside the request and controls what is extracted from each result page:

```json
{
  "contents": {
    "text": true,
    "highlights": { "maxCharacters": 4000, "query": "Key advancements" },
    "summary": { "query": "Main developments", "schema": { ... } },
    "subpages": 1,
    "subpageTarget": "sources",
    "maxAgeHours": 24,
    "extras": { "links": 1, "imageLinks": 1 }
  }
}
```

#### `text`

`true` (return full page text), `false` (disable), or an options object:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `maxCharacters` | integer | — | Truncate page text to this many characters. |
| `includeHtmlTags` | boolean | `false` | Include HTML tags (helps LLMs parse structure). |
| `verbosity` | enum | `compact` | `compact` / `standard` / `full`. Requires `maxAgeHours: 0` (livecrawl). |
| `includeSections` | string[] | — | Only include these page sections: `header`, `navigation`, `banner`, `body`, `sidebar`, `footer`, `metadata`. Requires livecrawl. |
| `excludeSections` | string[] | — | Exclude these page sections. Requires livecrawl. |

#### `highlights`

`true` (default settings), `false`, or an options object. Returns LLM-selected relevant snippets:

| Field | Type | Description |
|-------|------|-------------|
| `maxCharacters` | integer | Total highlight character budget per URL. |
| `query` | string | Custom query to direct the LLM's highlight selection (overrides the main search query). |
| `numSentences` | integer | Deprecated — use `maxCharacters` instead. |
| `highlightsPerUrl` | integer | Deprecated — ignored. Use `maxCharacters`. |

#### `summary`

LLM-generated per-page summary:

| Field | Type | Description |
|-------|------|-------------|
| `query` | string | Custom summary query. |
| `schema` | object | JSON Schema for structured summary output. |

#### `maxAgeHours` (freshness control)

Replaces the deprecated `livecrawl` field:
- Positive integer (e.g. `24`): Use cache if younger than N hours, otherwise livecrawl.
- `0`: Always livecrawl, never use cache.
- `-1`: Never livecrawl, always use cache.
- Omitted: Livecrawl only as fallback when no cached content exists.

#### `subpages` / `subpageTarget`

`subpages` (integer, default 0): number of subpages to crawl per result. `subpageTarget` (string or string[]): term to find specific subpages, e.g. `"sources"`.

#### `extras`

`links` (integer): number of outbound URLs to return per page. `imageLinks` (integer): number of image URLs per result.

## Response Shape

```json
{
  "requestId": "b5947044c4b78efa9552a7c89b306d95",
  "results": [ ResultWithContent ],
  "searchType": "neural",
  "output": {
    "content": "..." ,
    "grounding": [
      { "field": "leader", "citations": [{ "url": "...", "title": "..." }], "confidence": "high" }
    ]
  },
  "costDollars": { ... }
}
```

### `Result` object (base fields)

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Temporary document ID (often the canonical URL). Usable with the `/contents` endpoint. |
| `url` | string | URL of the result. |
| `title` | string | Page title. |
| `publishedDate` | string \| null | Estimated publish date in `YYYY-MM-DD` format (parsed from HTML). |
| `author` | string \| null | Author if available. |
| `image` | string \| null | URL of associated image, if available. |
| `favicon` | string \| null | Domain favicon URL. |

### `ResultWithContent` (extends `Result`)

| Field | Type | Description |
|-------|------|-------------|
| `text` | string | Full page text (present when `contents.text` requested). |
| `highlights` | string[] | LLM-selected relevant snippets. |
| `highlightScores` | float[] | Cosine similarity scores for each highlight. |
| `summary` | string | LLM-generated summary. |
| `subpages` | ResultWithContent[] | Crawled subpages (when `contents.subpages > 0`). |
| `extras` | object | Contains `links: string[]` when requested. |

### `output` (synthesized output)

Present when `outputSchema` is provided in the request. `content` is a string or structured object matching the schema. `grounding` is an array of field-level citation records with `field`, `citations` (url + title), and `confidence` (`low` / `medium` / `high`).

### `searchType`

For `auto` type requests, indicates which mode was actually selected: `neural`, `deep`, or `deep-reasoning`.

### `costDollars`

Pricing breakdown in USD:

| Operation | Price |
|-----------|-------|
| Neural search, 1–10 results (contents included) | $0.007 |
| Each additional result beyond 10 | $0.001 |
| Deep search per request | $0.012 |
| Deep-reasoning search per request | $0.015 |
| Text content per page | $0.001 |
| Highlights per page | $0.001 |
| Summary per page | $0.001 |

## Streaming Mode

When `stream: true`, the response is returned as `text/event-stream` in OpenAI-compatible chat-completion chunk format. Read synthesized text from `choices[0].delta.content`. Requires `outputSchema` or `systemPrompt` to produce a synthesized response worth streaming.

## Error Cases

- `400` — Invalid parameters (e.g. unsupported filter for `company`/`people` category).
- `401` — Missing or invalid API key.
- `429` — Rate limit exceeded.

## Minimal Example

```bash
curl -X POST 'https://api.exa.ai/search' \
  -H 'x-api-key: YOUR-EXA-API-KEY' \
  -H 'Content-Type: application/json' \
  -d '{"query": "Latest research in LLMs", "contents": {"highlights": {"maxCharacters": 4000}}}'
```

## Related

- [[exa-overview]]
- [[tavily-search-api]]

## Sources

- `raw/custom/exa/search.md` — Full OpenAPI 3.1.0 spec for `POST /search`, including all request parameters, response schemas, and pricing.
