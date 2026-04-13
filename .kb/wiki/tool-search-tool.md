---
created: 2026-04-13
updated: 2026-04-13
tags: [anthropic, claude, tool-call, mcp, context-engineering, beta]
sources: [raw/anthropic-blogs/mcp-tool-use.md]
---

# Tool Search Tool

A Claude Developer Platform beta feature shipped **November 24, 2025** under the [[anthropic-advanced-tool-use|`advanced-tool-use-2025-11-20`]] beta header. The Tool Search Tool lets Claude discover tools on demand instead of having every tool definition loaded into the system prompt upfront — the context-window version of progressive disclosure.

## The problem

MCP tool definitions provide important context, but they're heavy. The blog cites a realistic five-server setup — GitHub, Slack, Sentry, Grafana, Splunk — that consumes **~55K tokens before the conversation even starts**. Add Jira to that set and the number can cross 100K tokens. For agents with dozens of connected MCP servers, the upfront cost of shipping every tool definition on every request dominates the bill.

## How it works

Instead of loading every tool definition into the initial prompt, the request includes the Tool Search Tool itself plus a list of tools marked `defer_loading: true`. Deferred tools are excluded from the initial prompt. When Claude needs a specific capability, it calls the search tool; the search returns references that get expanded into full definitions only when needed.

```json
{
  "tools": [
    {
      "type": "tool_search_tool_regex_20251119",
      "name": "tool_search_tool_regex"
    },
    {
      "name": "github.createPullRequest",
      "description": "Create a pull request",
      "input_schema": { "...": "..." },
      "defer_loading": true
    }
  ]
}
```

Key pieces of the contract:

- **`type: "tool_search_tool_regex_20251119"`** — this is the Anthropic-hosted server tool that performs the search. The `_20251119` suffix is a dated version identifier; use it verbatim.
- **`defer_loading: true`** — per-tool flag that excludes a definition from the upfront prompt. Tools without this flag are loaded as normal, so you can keep a handful of always-on tools visible alongside a long tail of deferred ones.
- **Regex-based search** — implied by the type name; the search tool matches tool names and descriptions against a regex the model provides.

## The token-budget argument

From the blog:

| Approach | Tokens spent on tool surface |
|----------|-------------------------------|
| Traditional: all 50+ definitions loaded upfront | ~72K |
| Tool Search: only the search tool loaded | ~500 |
| Tool Search + definitions discovered during task | ~3K |

The blog claims this **preserves 95% of the context window** for the actual task, at the cost of a search turn whenever the model needs a tool it doesn't already know about.

> **WARNING — Pay attention to the 3–5 "hot" tools.** The blog's best-practices section is explicit: **keep your 3–5 most-used tools always loaded** and only defer the rest. If the tools Claude needs on nearly every turn are deferred, it will burn a search turn per conversation rediscovering them — wiping out most of the savings. `defer_loading: true` is a long-tail optimization, not a default.

## Design guidance from the blog

- **Use clear, descriptive names and descriptions.** Discovery accuracy depends entirely on the model's ability to match a regex against what you wrote. Sparse or ambiguous descriptions produce bad matches and require multiple search rounds.
- **Group by naming convention.** A flat namespace where everything matches `/github_/` or `/salesforce_/` makes targeted regex searches far more reliable than names with inconsistent prefixing.
- **Keep the always-loaded 3–5 tools tight.** These are your hot path; everything else goes behind the search tool.

## Relationship to the code-execution-with-mcp pattern

The Nov 4 Anthropic post on [[code-execution-with-mcp]] describes a DIY version of the same idea: represent MCP tools as files in a `servers/` directory tree and let the agent discover them by listing the tree. The Tool Search Tool is the **API-level productization** of that pattern — you still get progressive disclosure, but you don't need your own sandbox and filesystem to implement it. The trade-off is that it's Anthropic-specific, so it works only on [[chat-anthropic|`ChatAnthropic`]] model tiers.

## Relevance to Nexus

Nexus's current path is [[langchain-mcp-adapters|`MultiServerMCPClient.getTools()`]] against `http://localhost:8080/mcp`, which returns **60 MCP tools** in a flat namespace (`chrome_devtools_*` 27 + `browser_*` 23 + `sandbox_*` 10). Today those 60 tool definitions are bound upfront to whichever sub-agents need them — the worst-case scenario for context window cost.

Adopting the Tool Search Tool would mean, on Anthropic-backed tiers only:

1. Flag the 55+ long-tail tools with `defer_loading: true`.
2. Keep maybe 5 hot tools always loaded (`browser_navigate`, `browser_click`, `sandbox_execute_code`, `chrome_devtools_list_network_requests`, `browser_get_markdown` as likely candidates — subject to actual usage data).
3. Add the `tool_search_tool_regex_20251119` entry to the tool list passed to [[chat-anthropic]].

> **[unverified] — LangChain support.** Whether `@langchain/anthropic` currently surfaces `defer_loading` as a first-class tool option, or whether you'd need to construct raw Anthropic tool blocks, is not documented and not verified against the current package. See [[anthropic-advanced-tool-use]] for the general LangChain caveat.

> **Compare against the filesystem alternative.** [[code-execution-with-mcp]] describes a provider-agnostic version of the same idea built entirely inside [[aio-sandbox-overview|AIO Sandbox]]. For Nexus's multi-provider [[deepagents-models|tier registry]], the filesystem version survives a provider swap; the Tool Search Tool does not.

## Related

- [[anthropic-advanced-tool-use]] — umbrella for the three beta features; covers the beta header and layering guidance
- [[code-execution-with-mcp]] — the provider-agnostic pattern this feature productizes
- [[programmatic-tool-calling]] — companion feature that tackles large tool results rather than large tool surfaces
- [[tool-use-examples]] — companion feature that tackles schema ambiguity
- [[chat-anthropic]] — the LangChain chat model this feature applies to
- [[langchain-mcp-adapters]] — Nexus's current upfront-binding path (the thing this optimizes)
- [[langchain-tools]] — LangChain's tool system

## Sources

- `raw/anthropic-blogs/mcp-tool-use.md` — "Introducing advanced tool use on the Claude Developer Platform" (Anthropic engineering blog, Nov 24 2025), Tool Search Tool section. Includes the 55K-token five-server example, the 72K→500 token savings figure, the `tool_search_tool_regex_20251119` type string, the `defer_loading: true` flag, and the "keep 3–5 tools always loaded" guidance.
