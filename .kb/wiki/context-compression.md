---
created: 2026-04-12
updated: 2026-04-12
tags: [deepagents, context-engineering, context-compression]
sources: [raw/langchain/deepagents/context-engineering.md]
---

# Context Compression

Context compression is the set of built-in mechanisms DeepAgents uses to keep an agent's working memory within the model's context window limit during long-running tasks. It operates automatically — no configuration is required to enable it — but thresholds and fallback behavior are documented below.

## Two Mechanisms

### 1. Offloading

Offloading triggers when individual tool call inputs or results exceed **20,000 tokens**.

**For large tool call inputs** (e.g., file write operations): as the session context crosses **85% of the model's available window**, DeepAgents truncates older tool calls containing full file content, replacing them with a pointer to the file on disk. The content is already persisted to the filesystem and does not need to be in-context.

**For large tool call results**: when a single tool result exceeds 20,000 tokens, the agent offloads it to the configured [[backends|backend]] and replaces it in the conversation with:
- A filesystem path reference
- A preview of the first 10 lines

The agent can re-read or search the full content later using `read_file` or `grep` as needed.

### 2. Summarization

Summarization triggers when context crosses **85% of `max_input_tokens`** from the model's profile AND there is no more content eligible for offloading.

Two things happen simultaneously:

- **In-context summary**: an LLM generates a structured summary of the conversation — session intent, artifacts created, and next steps — which replaces the full message history in working memory.
- **Filesystem preservation**: the original complete conversation is written to the filesystem as a canonical record for later recovery.

This dual approach ensures the agent stays goal-aware (summary) while retaining the ability to recover specific details (filesystem search).

## Configuration Details

| Parameter | Default | Fallback |
|---|---|---|
| Summarization trigger | 85% of model `max_input_tokens` | 170,000 tokens if model profile unavailable |
| Recent context kept | 10% of tokens | 6 most recent messages |
| Offload token threshold | 20,000 tokens per tool call | — |

If any model call raises a `ContextOverflowError`, DeepAgents immediately falls back to summarization and retries with summary + recent preserved messages.

## Relationship to Context Isolation

Compression is a **reactive** mechanism — it fires when the context window is already filling. For proactively preventing context bloat on heavy tool use, prefer [[context-isolation]] via [[subagents]]: subagents run in their own fresh context and return only a final report.

## Related

- [[context-engineering]]
- [[context-isolation]]
- [[input-context]]
- [[backends]]

## Sources

- `raw/langchain/deepagents/context-engineering.md` — offloading thresholds, summarization trigger, dual in-context + filesystem preservation pattern
