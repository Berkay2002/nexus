---
created: 2026-04-12
updated: 2026-04-12
tags: [exa, search]
sources: [raw/custom/exa/search.md]
---

# Exa

Exa is a search API that uses embeddings-based retrieval to find semantically relevant web pages, designed around the idea that queries should read like descriptions of the ideal result rather than keyword strings. It differs from keyword-matching search engines by ranking pages by cosine similarity to the query embedding, making it particularly effective for research, academic papers, and pages that are hard to find via traditional keyword search.

## What Sets Exa Apart

**Embeddings-first.** The `neural` search type encodes the query as an embedding and finds pages with high semantic similarity. This means phrasing like "a paper about applying transformer architectures to protein folding" works better than keyword soup.

**Prompt-engineered queries.** Exa's documentation explicitly recommends writing queries as descriptions of what the ideal source would say — closer to a RAG retrieval prompt than a web search bar query. The `auto` type (default) blends neural search with other methods and selects the best approach automatically.

**Inline content extraction.** The `/search` endpoint can return full page text, LLM-selected highlights, and per-page summaries in a single request via the `contents` block — no separate fetch step needed. See [[exa-search-api]] for the full parameter reference.

**Deep search modes.** The `deep`, `deep-lite`, and `deep-reasoning` types crawl multiple pages and synthesize a structured answer from them, controlled by `outputSchema` and `systemPrompt`. This is closer to an agentic research capability than a standard search result list.

## Search Types at a Glance

| Type | Use case |
|------|----------|
| `auto` (default) | General-purpose; Exa selects the best approach. |
| `neural` | Semantic similarity search, best for research and nuanced queries. |
| `fast` | Lower latency, streamlined neural model. |
| `instant` | Lowest latency, optimized for real-time applications. |
| `deep-lite` | Light synthesis from crawled pages. |
| `deep` | Full deep search with synthesis. |
| `deep-reasoning` | Deep search with reasoning step. |

## When to Use Exa vs Tavily

| | Exa | [[tavily-search-api\|Tavily]] |
|---|-----|--------|
| **Query style** | Natural-language descriptions of the ideal result | Keyword or question queries |
| **Strengths** | Academic papers, semantic similarity, structured synthesis | News, recent events, fast factual Q&A |
| **Content extraction** | Inline in `/search` with deep content options | Separate `extract` endpoint or `search` with `include_raw_content` |
| **Deep research** | Built-in `deep` / `deep-reasoning` modes with `outputSchema` synthesis | Not available |
| **Category filters** | `research paper`, `company`, `news`, `people`, `personal site`, `financial report` | Topic/domain filtering via search params |
| **Pricing model** | Per request + per result beyond 10 | Per request |

In the Nexus stack, Exa is a candidate for the research agent's deep-research queries where semantic relevance and academic sources matter more than recency. Tavily is preferred when the task requires current news or fast factual lookups.

## Authentication

Pass the API key in the `x-api-key` header, or as `Authorization: Bearer <key>`.

## SDK Support

Official SDKs: `exa-py` (Python) and `exa-js` (JavaScript/TypeScript, `npm install exa-js`). Both provide `searchAndContents()` as the primary convenience method.

## Related

- [[exa-search-api]]
- [[tavily-search-api]]

## Sources

- `raw/custom/exa/search.md` — OpenAPI spec and code samples; Exa product context inferred from spec descriptions.
