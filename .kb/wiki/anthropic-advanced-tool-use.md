---
created: 2026-04-13
updated: 2026-04-13
tags: [anthropic, claude, tool-call, mcp, context-engineering, beta]
sources: [raw/anthropic-blogs/mcp-tool-use.md]
---

# Anthropic Advanced Tool Use (Beta)

On **November 24, 2025**, Anthropic shipped three beta features on the Claude Developer Platform — collectively marketed as "advanced tool use" — that address the token-efficiency problems described in [[code-execution-with-mcp]]. All three are gated behind a single beta header and are designed to be layered: start with whichever solves your biggest bottleneck and add the others as you hit new ones.

The three features:

1. **[[tool-search-tool|Tool Search Tool]]** — Let Claude discover tools on demand instead of loading every definition upfront. Tools marked `defer_loading: true` stay out of the initial prompt; Claude searches for them when it needs them.
2. **[[programmatic-tool-calling|Programmatic Tool Calling (PTC)]]** — Let Claude orchestrate tools through Python code in a sandboxed environment instead of one-call-per-turn. Only the final summarized result enters the context window.
3. **[[tool-use-examples|Tool Use Examples]]** — Attach concrete sample calls (`input_examples`) to tool definitions so Claude sees real usage patterns, not just JSON Schema.

## Enabling the beta

All three features are gated behind a single HTTP beta header:

```
anthropic-beta: advanced-tool-use-2025-11-20
```

In the Python SDK:

```python
client.beta.messages.create(
    betas=["advanced-tool-use-2025-11-20"],
    model="claude-sonnet-4-5-20250929",
    tools=[...],
)
```

> **Note — beta ID date drift:** The beta header is `advanced-tool-use-2025-11-20` (Nov 20) but the blog post was published Nov 24 and the Tool Search Tool type string is `tool_search_tool_regex_20251119` (Nov 19). The dates are not a single value — Anthropic stamps beta identifiers independently. Use each exactly as documented.

In [[chat-anthropic|ChatAnthropic]] (`@langchain/anthropic`), the constructor accepts a `betas` array that passes straight through to the underlying SDK, so enabling the header from LangChain looks like:

```typescript
import { ChatAnthropic } from "@langchain/anthropic";

const model = new ChatAnthropic({
  model: "claude-sonnet-4-5-20250929",
  betas: ["advanced-tool-use-2025-11-20"],
});
```

> **[unverified] — LangChain adapter coverage.** The beta header turns the features on at the API layer, but whether `@langchain/anthropic` and [[langchain-tools|LangChain's tool system]] surface the per-feature config (`defer_loading`, `tool_search_tool_regex_20251119`, `code_execution` + `allowed_callers`, `input_examples`) as ergonomic fields on the TypeScript side is not documented in the Anthropic blog and not verified against the current `@langchain/anthropic` source. Expect to either pass raw tool blocks through a low-level path or wait for first-class LangChain support. If you try it, check the `@langchain/anthropic` release notes and the serialized request body.

## The layering guidance

The blog's "best practices" section gives a practical order in which to adopt the features:

1. **Start with your biggest bottleneck.** If the system prompt is ballooning from tool definitions, reach for [[tool-search-tool]] first. If individual tool calls are stuffing large payloads into context, reach for [[programmatic-tool-calling]]. If Claude is formatting fields wrong, reach for [[tool-use-examples]].
2. **Keep your 3–5 most-used tools always loaded.** Defer the long tail with `defer_loading: true`, but the handful of tools Claude uses on nearly every turn should stay in the upfront tool list — searching for them wastes a turn.
3. **For PTC, document return formats clearly.** Claude writes code to parse those returns; vague schemas produce brittle parsing.
4. **For examples, use realistic data.** Focus on usage patterns that aren't obvious from the JSON Schema alone — date formats, nested object shapes, mutually-exclusive fields, enum semantics.

## Relationship to the code-execution-with-mcp pattern

These features are Anthropic's productization of ideas from the Nov 4 post on [[code-execution-with-mcp]]:

| Pattern (blog Nov 4) | Feature (beta Nov 24) |
|----------------------|------------------------|
| Progressive disclosure via file-tree of tools | [[tool-search-tool]] (API-level discovery) |
| Code execution orchestrating MCP tools | [[programmatic-tool-calling]] (API-level sandboxed Python) |
| N/A | [[tool-use-examples]] (new, not in Nov 4 post) |

The earlier blog describes a DIY version that any agent harness with a code sandbox can implement; this one wires the same ideas into the Claude API so you don't have to build the sandbox yourself — Anthropic runs it.

## Relevance to Nexus

Nexus today binds every sandbox MCP tool to sub-agents upfront via [[langchain-mcp-adapters|MultiServerMCPClient + client.getTools()]]. The 60 tools reachable from AIO Sandbox (`chrome_devtools_*` + `browser_*` + `sandbox_*`) all ship in the initial prompt. That's the same pattern the Tool Search Tool is designed to avoid, and the same bottleneck PTC is designed to avoid for large tool results.

Whether to adopt any of these features for Nexus is a **provider-specific** decision — they live inside the Anthropic API surface, so they work only when the model tier resolves to [[chat-anthropic|`ChatAnthropic`]]. Nexus's [[deepagents-models|tier registry]] routes based on environment (`classifier`, `default`, `code`, `deep-research`, `image`) across four providers (Anthropic, Google, OpenAI, Z.AI). On an Anthropic-backed tier, these betas are viable; on a Google- or OpenAI-backed tier, they don't exist. Adopting them would add a provider-conditional code path in the tool wiring — worth it if the token savings matter, but a real complexity trade-off.

The alternative from the Nov 4 post — [[code-execution-with-mcp|standing up a `servers/` filesystem inside AIO Sandbox]] and letting agents write code against it — is **provider-agnostic** and runs anywhere Nexus runs. For a multi-provider project like Nexus, the filesystem pattern is arguably the stronger bet.

## Related

- [[code-execution-with-mcp]] — the pattern these features productize
- [[tool-search-tool]] — feature 1: on-demand tool discovery
- [[programmatic-tool-calling]] — feature 2: sandboxed Python tool orchestration
- [[tool-use-examples]] — feature 3: `input_examples` on tool definitions
- [[chat-anthropic]] — the LangChain chat model to enable the beta header on
- [[anthropic-provider]] — `@langchain/anthropic` package umbrella
- [[langchain-tools]] — LangChain's tool system; where adapter support would land
- [[langchain-mcp-adapters]] — Nexus's current MCP integration path (the direct-call baseline these features optimize away from)

## Sources

- `raw/anthropic-blogs/mcp-tool-use.md` — "Introducing advanced tool use on the Claude Developer Platform" (Anthropic engineering blog, Nov 24 2025). Covers all three features, the `advanced-tool-use-2025-11-20` beta header, the Python SDK example, and the best-practices layering guidance.
