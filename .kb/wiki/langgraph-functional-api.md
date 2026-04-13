---
created: 2026-04-13
updated: 2026-04-13
tags: [stub, langgraph, functional-api, determinism]
sources: []
---

# LangGraph Functional API

**Stub** — created by lint because [[durable-execution]] references this concept twice without a canonical article.

## What it is

The LangGraph Functional API is an alternative to `StateGraph` for building LangGraph workflows using decorated Python/TypeScript functions (`@entrypoint`, `task()`) instead of explicit graph construction. Workflows are expressed as imperative async code, and LangGraph wraps the execution in the same [[pregel]] runtime used by `StateGraph`.

The most important primitive is `task()` — it wraps any side-effecting or non-deterministic operation so that [[durable-execution]] can replay workflows without re-executing those operations. Without `task()`, resumed workflows re-run side effects (API calls, file writes, random generation), which breaks the pause/resume contract.

## Why it matters for Nexus

Nexus doesn't currently use the Functional API directly — the DeepAgents orchestrator is built on `createDeepAgent()` which wraps `StateGraph`. This stub exists so that `[[langgraph-functional-api]]` wikilinks from [[durable-execution]] and [[langgraph-runtime]] resolve cleanly and so future code that needs `task()`-style replay guarantees has an anchor to land on.

## To flesh out

When a source covering the Functional API is added to `raw/langchain/langgraph/` (e.g., a `functional-api.md` upstream doc), re-run `/wikillm:ingest` and this stub will be expanded into a full article.

## Related

- [[durable-execution]]
- [[langgraph-runtime]]
- [[pregel]]
- [[checkpointer]]

## Sources

- (none yet — stub)
