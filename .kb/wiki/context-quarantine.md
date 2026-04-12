---
created: 2026-04-12
updated: 2026-04-12
tags: [context-engineering, subagent, deepagents, orchestration]
sources: [raw/langchain/deepagents/subagents.md]
---

# Context Quarantine

Context quarantine is the practice of isolating detailed, tool-heavy work in a child agent so that the parent agent's context window receives only the final result — not the raw intermediate outputs that produced it.

## The problem: context bloat

Every tool call appends to the agent's context window. Web searches return hundreds of lines of HTML snippets. File reads load entire documents. Database queries return full result sets. After a handful of such calls, the useful signal — the agent's reasoning — is buried in noise, and the window nears its limit.

This degrades quality in two ways:

1. The model's attention is diluted across the accumulated noise.
2. The context fills up, eventually truncating or erroring.

## The solution: delegate and summarize

By delegating a multi-step task to a [[subagents|subagent]], the parent agent sees only the subagent's final summary. The dozens of intermediate tool calls are executed inside the subagent's isolated context, which is discarded when the subagent finishes.

```
Main agent context:
  [system prompt]
  [task description]
  [subagent result: "Here are the 5 key findings: ..."]   ← concise

Subagent context (discarded after):
  [search result 1 - 200 lines]
  [search result 2 - 300 lines]
  [search result 3 - 150 lines]
  ... (never visible to main agent)
```

## Implementation in DeepAgents

[[create-deep-agent]] implements context quarantine via the `subagents` parameter. Each [[subagent-interface|`SubAgent`]] runs with its own isolated message history. The parent invokes `task(name="...", task="...")` and blocks until the subagent returns a single `ToolMessage`.

To maximize quarantine effectiveness, the subagent's `systemPrompt` should explicitly instruct it to return concise output:

```typescript
systemPrompt: `...your instructions...

IMPORTANT: Return only the essential summary.
Do NOT include raw data, intermediate search results, or detailed tool outputs.
Keep response under 500 words.`
```

For very large intermediate data, instruct subagents to write raw data to the [[aio-sandbox-overview|AIO Sandbox filesystem]] and return only the analysis.

## Relationship to context engineering

Context quarantine is one tactic within the broader [[context-engineering]] discipline. Other related tactics include summarization middleware, memory compression, and selective tool result truncation. Quarantine is the highest-leverage approach when a task can be fully delegated — it eliminates the intermediate data from the parent context entirely rather than compressing it.

## When quarantine is not appropriate

- When the parent agent needs to reason over intermediate results (e.g., iterative refinement based on partial outputs).
- When the subagent overhead (latency, cost) is not justified by a simple single-step task.
- When the full intermediate context is itself the deliverable.

## Related

- [[subagents]]
- [[subagent-interface]]
- [[general-purpose-subagent]]
- [[context-engineering]]

## Sources

- `raw/langchain/deepagents/subagents.md` — motivation section ("Why use subagents?"), troubleshooting ("Context still getting bloated"), best practice examples
