# NEXUS — Custom Tool API References

What we need from each API doc for building Nexus's custom tools.

---

## tavily/search.md — Tavily Search API

Full OpenAPI spec for `POST https://api.tavily.com/search`.

**What Nexus needs:**

Key parameters for our `tavily_search` tool:
- `query` (string, required) — the search query
- `search_depth` (enum: `advanced`/`basic`/`fast`/`ultra-fast`, default `basic`) — latency vs relevance tradeoff. `advanced` returns multiple semantic chunks per URL. `basic` returns one NLP summary per URL.
- `chunks_per_source` (int 1-3, default 3) — max chunks per source, only for `advanced` depth
- `max_results` (int 0-20, default 5) — max search results
- `topic` (enum: `general`/`news`/`finance`, default `general`) — search category
- `time_range` (enum: `day`/`week`/`month`/`year`, optional) — filter by recency
- `include_answer` (bool or `basic`/`advanced`, default false) — LLM-generated answer
- `include_raw_content` (bool or `markdown`/`text`, default false) — cleaned HTML content per result
- `include_images` (bool, default false) — include images
- `include_domains` / `exclude_domains` (string[], optional) — domain filtering

Response returns: `query`, `answer` (if requested), `results[]` with `title`, `url`, `content`, `score`, `raw_content` (if requested).

---

## tavily/extract.md — Tavily Extract API

Full OpenAPI spec for `POST https://api.tavily.com/extract`.

**What Nexus needs:**

Key parameters for our `tavily_extract` tool:
- `urls` (string or string[], required) — URL(s) to extract content from
- `query` (string, optional) — user intent for reranking extracted chunks
- `chunks_per_source` (int 1-5, default 3) — max chunks per source, only when `query` provided
- `extract_depth` (enum: `basic`/`advanced`, default `basic`) — `advanced` gets tables and embedded content
- `include_images` (bool, default false) — include extracted images

Response returns: `results[]` with `url`, `raw_content`, `images` (if requested). Also `failed_results[]` for URLs that couldn't be extracted.

---

## tavily/map.md — Tavily Map API

Full OpenAPI spec for `POST https://api.tavily.com/map`.

**What Nexus needs:**

Key parameters for our `tavily_map` tool:
- `url` (string, required) — root URL to begin mapping
- `instructions` (string, optional) — natural language instructions for the crawler (e.g., "Find all pages about the Python SDK")
- `max_depth` (int 1-5, default 1) — how far from base URL to explore
- `max_breadth` (int 1-500, default 20) — max links per level
- `limit` (int, default 50) — total links before stopping
- `select_paths` / `exclude_paths` (string[], optional) — regex patterns to filter URL paths
- `select_domains` / `exclude_domains` (string[], optional) — regex patterns for domain filtering

Response returns: `base_url`, `urls[]` (list of discovered URLs), `total_urls`.

---

## exa/search.md — Exa Search API

Full OpenAPI spec for `POST https://api.exa.ai/search`.

**What Nexus needs:**

Key parameters for our `exa_search` tool:
- `query` (string, required) — the search query
- `type` (enum: `neural`/`fast`/`auto`/`deep-lite`/`deep`/`deep-reasoning`/`instant`, default `auto`) — search type. `neural` uses embeddings, `auto` combines methods, `deep` variants do synthesized search
- `category` (enum: `company`/`research paper`/`news`/`personal site`/`financial report`/`people`, optional) — focus on a data category
- `numResults` (int, default 10) — max results
- `contents` (object, optional) — what to include from results:
  - `text` (bool) — full page text
  - `highlights` — `{ maxCharacters }` for relevant snippets
  - `summary` — `{ query }` for AI-generated summary
  - `subpages` (int) — follow subpage links
  - `extras` — `{ links, imageLinks }` for additional data
- `includeDomains` / `excludeDomains` (string[], optional) — domain filtering
- `startPublishedDate` / `endPublishedDate` (string, optional) — date range filtering
- `additionalQueries` (string[], optional) — query variations for comprehensive results
- `systemPrompt` (string, optional) — instructions for synthesized output (deep search)
- `outputSchema` (object, optional) — JSON schema for structured synthesized output

Response returns: `results[]` with `title`, `url`, `id`, `score`, `publishedDate`, `author`, plus requested content fields. Deep search variants also return `output` with synthesized content.

**Exa JS SDK:** `npm install exa-js` — `new Exa(apiKey)` then `exa.searchAndContents(query, options)`.
