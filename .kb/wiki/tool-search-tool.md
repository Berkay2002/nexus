---
created: 2026-04-13
updated: 2026-04-13
tags: [anthropic, claude, tool-call, mcp, context-engineering, beta]
sources: [raw/anthropic-blogs/mcp-tool-use.md, raw/anthropic/tool-search-tool.md]
---

# Tool Search Tool

A Claude Developer Platform feature that lets the model discover tools on demand instead of having every tool definition loaded into the system prompt upfront. You provide the full catalog, mark long-tail tools with `defer_loading: true`, and Claude searches the catalog when it needs a capability — the API then expands the matching `tool_reference` blocks into full definitions inline. Shipped as beta on **November 24, 2025** under the [[anthropic-advanced-tool-use|`advanced-tool-use-2025-11-20`]] umbrella header; full API docs followed shortly after.

## The problem

MCP tool definitions provide important context, but they're heavy. The docs cite the same worked example as the Nov 4 [[code-execution-with-mcp]] post: a typical five-server setup — GitHub, Slack, Sentry, Grafana, Splunk — consumes **~55K tokens** in definitions before Claude does any actual work. Add a sixth server and the upfront cost crosses 100K tokens on every request.

There's a second, subtler problem on top of token cost: **tool selection accuracy degrades past 30–50 tools**. Claude's ability to pick the right tool falls off noticeably once the catalog is larger than that, even when the context window has room. Tool search keeps the *effective* tool count low by only surfacing a focused set per turn.

The official docs quote a different savings number than the blog — **~85% reduction** in tool-surface tokens, vs. the blog's ~95% figure. Both are in the same order of magnitude; the actual ratio depends on catalog size, hot-set composition, and how often search fires.

## The two variants

The docs introduce a variant the Nov 24 blog didn't mention. There are **two** server-side tool search tools:

| Type | Query format | Use when |
|------|--------------|----------|
| `tool_search_tool_regex_20251119` | **Python `re.search()` regex** — NOT natural language | You want deterministic matches on naming conventions (`github_*`, `slack_*`) |
| `tool_search_tool_bm25_20251119` | **Natural language** queries | You want classical IR ranking over tool names/descriptions/arg metadata |

Both variants search across **tool names, descriptions, argument names, and argument descriptions**. Pick one per request — you use one or the other, not both simultaneously (the docs show one entry in the `tools` array).

> **WARNING — The regex variant is Python regex, not natural language.** The Nov 24 blog post didn't make this distinction and it's easy to miss. When you enable `tool_search_tool_regex_20251119`, Claude constructs **Python `re.search()` patterns**, not free-form search strings. Common patterns:
>
> - `"weather"` — matches tool names/descriptions containing "weather"
> - `"get_.*_data"` — matches `get_user_data`, `get_weather_data`, etc.
> - `"database.*query|query.*database"` — OR patterns for flexibility
> - `"(?i)slack"` — case-insensitive search (**regex is case-sensitive by default**)
>
> **Maximum query length: 200 characters.** Longer patterns return a `pattern_too_long` error. If you want natural-language queries, use the `bm25` variant instead — the two aren't interchangeable.

## How it works

The request-time contract:

1. Include **one** tool search tool in your `tools` list (either variant).
2. Include **all** tool definitions you want Claude to be able to call, marking long-tail tools with `defer_loading: true`.
3. Non-deferred tools plus the tool search tool are loaded into Claude's initial prompt. Deferred tools are **excluded** from the prefix.
4. When Claude needs additional capability, it emits a `server_tool_use` calling the tool search tool with a query.
5. The API returns 3–5 most relevant `tool_reference` blocks in a `tool_search_tool_result`.
6. The API automatically expands those references into full tool definitions inline in the conversation — you don't handle the expansion yourself.
7. Claude invokes the now-visible tools via the normal `tool_use` path.

```json
{
  "tools": [
    {
      "type": "tool_search_tool_regex_20251119",
      "name": "tool_search_tool_regex"
    },
    {
      "name": "get_weather",
      "description": "Get the weather at a specific location",
      "input_schema": { "...": "..." },
      "defer_loading": true
    },
    {
      "name": "search_files",
      "description": "Search through files in the workspace",
      "input_schema": { "...": "..." },
      "defer_loading": true
    }
  ]
}
```

### Response shape

When Claude invokes the tool search tool, the assistant message contains new block types:

```json
{
  "role": "assistant",
  "content": [
    { "type": "text", "text": "I'll search for tools to help with the weather." },
    {
      "type": "server_tool_use",
      "id": "srvtoolu_01ABC123",
      "name": "tool_search_tool_regex",
      "input": { "query": "weather" }
    },
    {
      "type": "tool_search_tool_result",
      "tool_use_id": "srvtoolu_01ABC123",
      "content": {
        "type": "tool_search_tool_search_result",
        "tool_references": [
          { "type": "tool_reference", "tool_name": "get_weather" }
        ]
      }
    },
    { "type": "text", "text": "I found a weather tool. Let me call it." },
    {
      "type": "tool_use",
      "id": "toolu_01XYZ789",
      "name": "get_weather",
      "input": { "location": "San Francisco", "unit": "fahrenheit" }
    }
  ],
  "stop_reason": "tool_use"
}
```

Block taxonomy:

- **`server_tool_use`** — Claude invoking the tool search tool (a server-side tool, not a user tool)
- **`tool_search_tool_result`** — wrapper carrying the search result
- **`tool_search_tool_search_result`** — the inner payload with `tool_references`
- **`tool_reference`** — a pointer to a deferred tool by name; expanded inline to the full schema automatically
- **`tool_use`** — the normal tool-call block, now referencing a tool that was discovered via search

### How deferral works internally

Deferred tools are **not included in the system-prompt prefix**. When Claude discovers a deferred tool via tool search, its definition is appended inline as a `tool_reference` block in the conversation rather than being injected back into the prefix. The prefix stays byte-identical, so **prompt caching is preserved** across tool search events. The strict-mode grammar builds from the full toolset, so `defer_loading` composes with strict mode without grammar recompilation.

This matters: prompt caching works, search events don't invalidate the cache.

## Limits

| Limit | Value |
|-------|-------|
| Maximum tools in catalog | **10,000** |
| Results per search | **3–5** most relevant |
| Regex pattern length | **200** characters |
| Model support | **Sonnet 4.0+**, **Opus 4.0+**, Claude Mythos Preview |

> **WARNING — No Haiku support.** The tool search tool is not available on Haiku models (including Haiku 4.5). For [[deepagents-models|tier-routed stacks]] like Nexus, this means the feature only applies when the model resolves to Sonnet 4.6 or Opus 4.6 — not if a lighter-weight Haiku tier is in play. Plan the tier resolution before wiring the feature in.

## When to use it

The docs give explicit guidance on when tool search pays for itself:

**Good fit:**

- **10+ tools available** in your system
- **Tool definitions consuming >10K tokens**
- Experiencing **tool selection accuracy issues** with large tool sets (past the 30–50 threshold)
- Building **MCP-powered systems** with multiple servers (200+ tools)
- Tool library **growing over time** (you don't want to pay token tax for unused tools)

**Stick with traditional tool calling when:**

- Less than 10 tools total
- All tools are frequently used on every request
- Very small tool definitions (<100 tokens total)

## Optimization guidance

- **Keep your 3–5 most frequently used tools as non-deferred.** This is the most-repeated tip in both the blog and the docs. If the hot path is deferred, every conversation spends a search turn re-discovering tools it always uses, which wipes out the savings.
- **Use consistent namespacing in tool names.** Prefix by service or resource (`github_`, `slack_`, `sandbox_`, `browser_`). Makes regex patterns natural and BM25 ranking tighter.
- **Write clear, descriptive names and descriptions.** Search matches against both fields *and* argument names/descriptions — every piece of metadata is a hit surface.
- **Seed a system-prompt hint** describing available tool categories: `"You can search for tools to interact with Slack, GitHub, and Jira"`. Helps Claude form effective queries.
- **Use semantic keywords in descriptions** that match how users describe tasks.
- **Monitor which tools Claude discovers** to refine descriptions of the ones it misses.

## Error handling

### 400 errors (request rejected)

**All tools deferred:**

```json
{
  "type": "error",
  "error": {
    "type": "invalid_request_error",
    "message": "All tools have defer_loading set. At least one tool must be non-deferred."
  }
}
```

At least one tool must be non-deferred. Typically that's the tool search tool itself plus your 3–5 hot tools.

**Missing tool definition:**

```json
{
  "type": "error",
  "error": {
    "type": "invalid_request_error",
    "message": "Tool reference 'unknown_tool' has no corresponding tool definition"
  }
}
```

Every tool that could be discovered via search must have a full definition in the top-level `tools` array.

### 200 errors (tool result with error)

Errors during search execution return a 200 response with an error body:

```json
{
  "type": "tool_result",
  "tool_use_id": "srvtoolu_01ABC123",
  "content": {
    "type": "tool_search_tool_result_error",
    "error_code": "invalid_pattern"
  }
}
```

Error codes:

- `too_many_requests` — rate limit exceeded for tool search operations
- `invalid_pattern` — malformed regex pattern (regex variant only)
- `pattern_too_long` — pattern exceeds 200 character limit
- `unavailable` — tool search service temporarily unavailable

### Common mistakes

1. **All tools deferred (including the search tool).** The tool search tool itself should **never** have `defer_loading: true`. Remove the flag from the search tool entry.
2. **`tool_reference` pointing at an undefined tool.** Every discoverable tool needs a complete definition in the `tools` array — name, description, and `input_schema`.
3. **Claude not finding expected tools** (regex variant). Check: does the pattern actually match? Test with `import re; re.search(r"your_pattern", "tool_name")` in Python. Is the search case-sensitive by default? (Yes — add `(?i)` for case-insensitive.) Does the description include the keyword Claude is likely to query with? Claude uses broad patterns like `".*weather.*"`, not exact matches.

## Compatibility gotchas

> **WARNING — NOT compatible with [[tool-use-examples|Tool Use Examples]].** The docs explicitly state: "The tool search tool is not compatible with tool use examples. If you need to provide examples of tool usage, use standard tool calling without tool search." You cannot adopt both features simultaneously on the same tool set. If both matter, pick the one that addresses your bigger bottleneck (token bloat → tool search; arg-format ambiguity → examples). The other beta feature in the Nov 24 release, [[programmatic-tool-calling]], has no documented incompatibility with tool search.

> **WARNING — Bedrock: invoke API only.** On Amazon Bedrock, server-side tool search is available **only via the invoke API**, not the converse API. If you deploy Claude through Bedrock's converse API path, the feature is unreachable — you'd need a custom client-side implementation (see below).

## Custom client-side tool search

The server-side tool search tool is one path. You can also implement your own tool search logic — using embeddings, semantic search, or any ranking you like — by returning `tool_reference` blocks from a custom standard tool:

```json
{
  "type": "tool_result",
  "tool_use_id": "toolu_your_tool_id",
  "content": [
    { "type": "tool_reference", "tool_name": "discovered_tool_name" }
  ]
}
```

Every tool referenced must have a corresponding definition in the top-level `tools` parameter with `defer_loading: true`. The API automatically expands the references into full definitions the same way it does for server-side search. This path lets you plug in embedding-based retrieval, a BM25 index you control, or any other discovery strategy — while still getting the context-window savings of deferred loading.

> **Note — Use `tool_result` format, not `tool_search_tool_result`.** The `tool_search_tool_result` / `tool_search_tool_search_result` block types are Anthropic's *internal* server-side format. For client-side implementations, return a standard `tool_result` with `tool_reference` blocks in the `content` array — don't try to mimic the server-side envelope.

> **Note — ZDR / data retention trade-off.** Server-side tool search **indexes and stores tool catalog data** (names, descriptions, argument metadata) beyond the immediate API response — the catalog is retained per Anthropic's standard retention policy, so the server-side variant is **not fully ZDR-eligible**. Custom client-side tool search using the standard Messages API **is fully ZDR-eligible**. If Zero Data Retention matters for your deployment, build the client-side path.

## MCP integration

The docs reference an `mcp_toolset` with `defer_loading` configuration but defer the details to the MCP connector doc (not ingested). The upshot for now: when you configure an MCP toolset via the Anthropic MCP connector, individual tools in the toolset can be marked deferred at the toolset level — rather than flagging every tool in a large MCP server one by one. The exact shape is not in this source; check the MCP connector docs when wiring it up. [unverified — not in this source]

## Streaming

Tool search events are part of the normal SSE stream. The sequence for a single search call:

```text
event: content_block_start
data: {"type": "content_block_start", "index": 1, "content_block": {"type": "server_tool_use", "id": "srvtoolu_xyz789", "name": "tool_search_tool_regex"}}

event: content_block_delta
data: {"type": "content_block_delta", "index": 1, "delta": {"type": "input_json_delta", "partial_json": "{\"query\":\"weather\"}"}}

// Pause while search executes server-side

event: content_block_start
data: {"type": "content_block_start", "index": 2, "content_block": {"type": "tool_search_tool_result", "tool_use_id": "srvtoolu_xyz789", "content": {"type": "tool_search_tool_search_result", "tool_references": [{"type": "tool_reference", "tool_name": "get_weather"}]}}}
```

The search query is streamed as an `input_json_delta`, there's a pause while the index executes, then the result block arrives. Normal `content_block_stop` / `message_delta` events wrap around as usual.

## Batch requests

Compatible with the [Messages Batches API](https://docs.anthropic.com/en/api/messages-batches). Tool search operations inside batch requests are priced the same as those in regular Messages API requests.

## Usage tracking

Tool search invocations show up in the response usage object under `server_tool_use`:

```json
{
  "usage": {
    "input_tokens": 1024,
    "output_tokens": 256,
    "server_tool_use": {
      "tool_search_requests": 2
    }
  }
}
```

This is the metric to watch when deciding whether your hot-set is sized right. High `tool_search_requests` counts on typical conversations mean you're deferring too much of the hot path.

## Relationship to the code-execution-with-mcp pattern

The Nov 4 Anthropic post on [[code-execution-with-mcp]] describes a DIY version of the same idea: represent MCP tools as files in a `servers/` directory tree and let the agent discover them by listing the tree. The Tool Search Tool is the **API-level productization** of that pattern — you still get progressive disclosure, but you don't need your own sandbox and filesystem to implement it. The trade-off is that it's Anthropic-specific and server-side, so it works only on [[chat-anthropic|`ChatAnthropic`]] model tiers and carries the catalog-retention caveat above.

## Relevance to Nexus

Nexus's current path is [[langchain-mcp-adapters|`MultiServerMCPClient.getTools()`]] against `http://localhost:8080/mcp`, which returns **60 MCP tools** in a flat namespace (`chrome_devtools_*` 27 + `browser_*` 23 + `sandbox_*` 10). Today those 60 definitions are bound upfront to whichever sub-agents need them — which crosses both the 30–50 tool selection-accuracy threshold and the >10K tool-definition-tokens threshold that the docs cite as good use cases for tool search.

If the feature were adopted, on Anthropic-backed [[deepagents-models|tier resolutions]] only:

1. Flag the 55+ long-tail tools with `defer_loading: true` (keep maybe `browser_navigate`, `browser_click`, `sandbox_execute_code`, `chrome_devtools_list_network_requests`, `browser_get_markdown` as the hot 5 — subject to actual usage telemetry).
2. Add one `tool_search_tool_regex_20251119` entry to the tools passed to [[chat-anthropic]]. The regex variant is a good fit because the sandbox tools already use consistent prefixes (`browser_*`, `sandbox_*`, `chrome_devtools_*`).
3. Verify the [[deepagents-models|tier resolution]] — on Nexus, `default` is typically Sonnet 4.6 and `code` is Sonnet 4.6, both of which support tool search. If a Haiku tier is in use anywhere (classifier?), tool search won't work there and the request will need to fall back to upfront loading.
4. Make the change **provider-conditional**. On Google or OpenAI tiers this feature doesn't exist; the tool wiring needs a branch for "Anthropic tier → tool search, else → upfront binding."

> **[unverified] — LangChain support for `defer_loading`.** Whether `@langchain/anthropic` currently surfaces `defer_loading` as a first-class LangChain tool option is not documented in this source. You may need to construct raw Anthropic tool blocks and bypass the LangChain tool abstraction, or wait for first-class support. See [[anthropic-advanced-tool-use]] for the general LangChain caveat.

> **Compare against the filesystem alternative.** [[code-execution-with-mcp]] describes a provider-agnostic version of the same idea built entirely inside [[aio-sandbox-overview|AIO Sandbox]]. For Nexus's multi-provider tier registry, the filesystem version survives a provider swap and Haiku tiers; tool search does not. The filesystem pattern is arguably the stronger bet for a multi-provider stack, even though tool search has less implementation overhead on a single-provider path.

## Related

- [[anthropic-advanced-tool-use]] — umbrella for the three Nov 24 beta features; covers the beta header and layering guidance
- [[code-execution-with-mcp]] — the provider-agnostic pattern this feature productizes
- [[programmatic-tool-calling]] — companion feature that tackles large tool results (this one tackles large tool surfaces)
- [[tool-use-examples]] — companion feature that tackles schema ambiguity (**NOT compatible with this feature**)
- [[chat-anthropic]] — the LangChain chat model this feature applies to
- [[deepagents-models]] — Nexus's tier registry that determines when this feature is reachable
- [[langchain-mcp-adapters]] — Nexus's current upfront-binding path (the thing this optimizes)
- [[aio-sandbox-mcp-api]] — the sandbox-side MCP gateway that feeds Nexus's 60-tool catalog
- [[langchain-tools]] — LangChain's tool system

## Sources

- `raw/anthropic/tool-search-tool.md` — Official Anthropic Tool Search Tool documentation. Authoritative source for the two variants (`tool_search_tool_regex_20251119` + `tool_search_tool_bm25_20251119`), the Python-regex-vs-natural-language split, the 10,000-tool / 200-char / Sonnet+Opus-only limits, the response format (`server_tool_use` / `tool_search_tool_result` / `tool_reference`), the custom client-side path, the `tool-use-examples` incompatibility, the Bedrock-invoke-only caveat, the ZDR / data retention trade-off, error codes, streaming SSE events, and the `server_tool_use.tool_search_requests` usage metric.
- `raw/anthropic-blogs/mcp-tool-use.md` — "Introducing advanced tool use on the Claude Developer Platform" (Nov 24 2025). The initial launch announcement; covers the 55K-token five-server example, the 95% savings figure (the docs quote ~85% instead), the layering guidance, and the Python SDK example with the `advanced-tool-use-2025-11-20` beta header.
