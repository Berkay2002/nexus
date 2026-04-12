---
created: 2026-04-12
updated: 2026-04-12
tags: [deepagents, subagent, task-delegation, context-engineering, orchestration]
sources: [raw/langchain/deepagents/subagents.md]
---

# Subagents

Subagents are child agents that a [[create-deep-agent|DeepAgent]] spawns to delegate work. The supervisor calls a `task()` tool, blocks until the subagent finishes, then receives only the final result — not the dozens of intermediate tool calls that produced it. This synchronous, blocking model is the standard delegation path; long-running or parallel work uses [[async-subagents]] instead.

## Why subagents exist

The primary motivation is [[context-quarantine]]: tool calls with large outputs (web search, file reads, database queries) fill the main agent's context window rapidly. Offloading that work to a subagent means the parent context receives a concise summary rather than megabytes of raw results.

Secondary motivations:

- **Specialization** — each subagent gets its own `system_prompt` and `tools` tailored to one domain.
- **Model routing** — each subagent can use a different model (e.g., a large-context model for document review, a fast model for classification).
- **Context isolation** — the subagent's internal tool calls are never visible to the parent.

## When to use subagents

Use subagents when:

- A task requires multiple sequential tool calls that would clutter the main context.
- A domain needs specialized instructions or a different toolset.
- You want a different model for part of the work.
- High-level coordination should stay separate from low-level execution.

Avoid subagents for:

- Simple, single-step tasks where the overhead outweighs the benefit.
- Cases where you need the parent to reason over intermediate results.

## How synchronous subagents run

1. Main agent calls `task(name="<subagent-name>", task="<description>")`.
2. DeepAgents spawns the subagent with its own isolated message history.
3. Subagent executes (may call tools, loop, etc.) until it produces a final answer.
4. Final answer is returned to the parent as a `ToolMessage` — intermediate steps are discarded from the parent's view.
5. Main agent continues with clean context.

## Configuring subagents

Pass a `subagents` list to [[create-deep-agent]]. Each entry is either a [[subagent-interface|`SubAgent` dict]] or a `CompiledSubAgent` object. See [[subagent-interface]] for the full field reference.

```typescript
const agent = createDeepAgent({
  model: "claude-sonnet-4-6",
  subagents: [researchSubagent, codeSubagent],
});
```

## The general-purpose subagent

DeepAgents **always** adds a `general-purpose` subagent alongside any custom ones. See [[general-purpose-subagent]] for the full details and the common Nexus gotcha this creates.

## Streaming and tracing

Each agent run carries `lc_agent_name` in its LangSmith metadata, allowing traces to be attributed to the correct agent. Tools can also read `runtime.config?.metadata?.lc_agent_name` to branch behavior depending on which subagent called them.

## Context propagation

Runtime context (passed via `agent.invoke(..., { context: {...} })`) flows automatically to all subagents and their tools. For per-subagent config, use namespaced keys (`researcher:maxDepth`) or separate fields on the context schema.

## Best practices

- Write **specific, action-oriented descriptions** — the main agent uses the description to decide which subagent to call.
- Keep **system prompts detailed** with explicit output format and word-count constraints ("return under 500 words").
- Give each subagent a **minimal tool set** — only what it needs.
- Instruct subagents to **write large data to the filesystem** and return only summaries to keep the parent context clean.
- Use `CompiledSubAgent` (wrapping a full LangGraph graph) when the subagent itself needs complex multi-node orchestration.

## Related

- [[subagent-interface]]
- [[general-purpose-subagent]]
- [[context-quarantine]]
- [[async-subagents]]
- [[create-deep-agent]]

## Sources

- `raw/langchain/deepagents/subagents.md` — full synchronous subagents reference including configuration tables, code examples, streaming, context propagation, and troubleshooting
