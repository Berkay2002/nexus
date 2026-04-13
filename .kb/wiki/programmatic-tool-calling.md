---
created: 2026-04-13
updated: 2026-04-13
tags: [anthropic, claude, tool-call, code-execution, mcp, context-engineering, beta]
sources: [raw/anthropic-blogs/mcp-tool-use.md]
---

# Programmatic Tool Calling (PTC)

A Claude Developer Platform beta feature shipped **November 24, 2025** under the [[anthropic-advanced-tool-use|`advanced-tool-use-2025-11-20`]] beta header. PTC lets Claude orchestrate tools by writing **Python code** that runs in an Anthropic-hosted sandbox, instead of invoking one tool at a time and shuttling results through the context window. Only the final summarized result of the script enters Claude's context.

PTC is the API-level productization of the Nov 4 [[code-execution-with-mcp]] pattern. The earlier blog describes a DIY version any harness with a sandbox can build; PTC bakes the sandbox into the Claude API so you don't have to run one yourself.

## The problem it solves

Traditional direct tool calling has two costs that compound as tool use scales:

1. **Context pollution from intermediate results.** Every tool call's output flows back through the model. A 10MB log file, a 2,000-line spreadsheet, a large JSON response — all of it has to enter the context window for Claude to do anything with it. For large datasets this can exceed the window outright.
2. **Inference overhead from sequential tool calls.** Each tool call is a full model inference pass. A workflow that chains 20 calls pays for 20 round-trips. A loop over N items is N model turns.

The blog's worked example: a **budget compliance check** across a team. The direct-tool-call version fetches team members, fetches budget for each level, fetches every expense line item, filters for violators — 20+ tool calls and 2,000+ expense rows flowing through the context window. The PTC version has Claude write one Python script that does all of that inline and prints the final list of violators. Context consumption: **~200KB → ~1KB**.

## How it works

The model writes Python code. That code calls tools declared as `code_execution`-capable. The tools execute inside an Anthropic-managed sandbox; their outputs stay inside the sandbox; the Python script processes everything and returns a summary the model sees.

The contract has three moving parts:

1. **Mark tools as callable from code.** Add `code_execution` to the tool's capability set and set `allowed_callers` to restrict who can invoke them. The blog shows this as a config on the tool definition — the exact JSON shape is not shown in the post, but the semantic is: tools opt in to being available to the sandboxed Python runtime.
2. **Claude generates Python code.** Instead of emitting one tool call at a time, Claude emits a Python program that orchestrates the whole workflow — loops, conditionals, result filtering, parallel fetches, etc.
3. **Internal execution.** The sandbox runs the script, calls the tools, aggregates results, and hands Claude only what the script explicitly returns or prints. Nothing else crosses the boundary.

## The budget-compliance example

From the blog, abbreviated. The direct-call version walks a team hierarchy, fetches per-level budgets, fetches all expenses, and compares them — each call round-tripping its result through the model. The PTC version writes a script roughly like:

```python
team = fetch_team_members()
budgets = {level: fetch_budget(level) for level in team.levels}
expenses = fetch_all_expenses_parallel(team.members)

totals = aggregate_expenses_by_member(expenses)
violators = [
    m for m in team.members
    if totals[m.id] > budgets[m.level]
]

print([m.name for m in violators])
```

The model sees the final list of names. It does not see the 2,000 expense line items, the budget matrix, the team roster, or any intermediate state. The blog reports the end-to-end consumption at ~1KB vs. the direct-call version's ~200KB.

## Trade-offs

- **Python, not JavaScript.** PTC runs Python. If your tool surface is TypeScript-first (Nexus is), there's a language mismatch: the tools you define in LangChain are TS/JS, but Claude writes Python to invoke them. The interoperation layer between the Anthropic sandbox's Python runtime and an external TS tool server is not described in the blog.
- **Anthropic-hosted sandbox.** The execution environment is Anthropic's. You don't get to point it at [[aio-sandbox-overview|your own sandbox]] and have Claude orchestrate tools that live there. This is both a feature (no sandbox to run) and a limitation (you lose per-agent filesystem isolation and the ability to inspect intermediate state).
- **Document return formats clearly.** The blog's best-practices section is explicit: **clearly document return formats so Claude can write accurate parsing logic**. PTC shifts the burden of parsing from the model's chat loop to generated Python — the model has to predict the shape of every tool's output well enough to write code against it. Fuzzy schemas produce brittle scripts.
- **Loses direct observability of intermediate steps.** The whole premise is that intermediate data doesn't reach the model. That's a token win, but it also means the model can't course-correct on intermediate results mid-workflow. If a tool returns something unexpected, the script either handles it in code or fails — there's no "the model noticed something weird on turn 14" path.

> **WARNING — PTC and the [[code-execution-with-mcp]] filesystem pattern are different locations of the same idea.** PTC puts the sandbox inside the Anthropic API. The Nov 4 pattern puts the sandbox inside your own infrastructure (e.g., [[aio-sandbox-overview|AIO Sandbox]]) and has the model write code against files you expose. Both approaches give you code-driven tool orchestration with result filtering in code; the choice is where the sandbox lives and who pays to run it. PTC is faster to adopt; the filesystem pattern is provider-agnostic and lets you keep using your existing code runtime.

## Relevance to Nexus

Nexus already has everything needed to run the **provider-agnostic** variant of this idea:

- [[aio-sandbox-overview|AIO Sandbox]] with persistent shell, Jupyter kernels, and one-shot code execution
- [[aio-sandbox-code-execution-api|`/v1/code/*` endpoints]] for stateless Python / JavaScript execution
- [[aio-sandbox-jupyter-api|`/v1/jupyter/*`]] for stateful Python kernels
- [[langchain-mcp-adapters|60 MCP tools]] reachable from inside the sandbox via `POST /mcp`

Adopting **PTC itself** on Nexus is a narrower proposition. It would apply only on Anthropic-backed [[deepagents-models|tier resolutions]] and would require a separate Python execution path that coexists with Nexus's TypeScript tool definitions. It's a real option — probably best for [[aio-sandbox-overview|code sub-agent]] workflows where Python is a natural fit — but it's a provider-conditional code path in an otherwise provider-agnostic stack.

For most Nexus workloads, the **filesystem-of-tools pattern inside AIO Sandbox** is a better match: it runs under any provider, reuses the runtime that's already in production, and keeps Python-vs-TypeScript out of the decision. See [[code-execution-with-mcp]] for that version.

> **[unverified] — LangChain support for `code_execution` / `allowed_callers`.** The Python SDK sample in the blog sets betas at the `client.beta.messages.create` level; whether `@langchain/anthropic` exposes `code_execution` and `allowed_callers` as first-class tool-definition fields, or whether you'd need to drop to raw tool blocks, is not documented and not verified.

## Related

- [[anthropic-advanced-tool-use]] — umbrella for the three beta features; covers the beta header and layering guidance
- [[code-execution-with-mcp]] — the provider-agnostic pattern this feature productizes; the canonical cross-reference for this article
- [[tool-search-tool]] — companion feature that tackles large tool surfaces (this one tackles large tool results)
- [[tool-use-examples]] — companion feature that tackles schema ambiguity
- [[chat-anthropic]] — the LangChain chat model to enable the beta header on
- [[aio-sandbox-code-execution-api]] — the sandbox's stateless code execution surface (the self-hosted alternative)
- [[aio-sandbox-jupyter-api]] — stateful Python kernels (the persistent self-hosted alternative)
- [[langchain-mcp-adapters]] — Nexus's current direct-call baseline this feature optimizes

## Sources

- `raw/anthropic-blogs/mcp-tool-use.md` — "Introducing advanced tool use on the Claude Developer Platform" (Anthropic engineering blog, Nov 24 2025), Programmatic Tool Calling section. Includes the budget-compliance worked example, the ~200KB → ~1KB number, the `code_execution` + `allowed_callers` contract, the three-step flow (mark callable / write code / internal execution), and the "document return formats clearly" best practice.
