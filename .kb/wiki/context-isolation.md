---
created: 2026-04-12
updated: 2026-04-12
tags: [deepagents, context-engineering, context-isolation, subagent]
sources: [raw/langchain/deepagents/context-engineering.md]
---

# Context Isolation

Context isolation is the technique of delegating heavy tool work to [[subagents]] so that the main agent's context window stays clean. While [[context-compression]] is a reactive mechanism that fires when context is already filling, isolation is proactive — the main agent never sees the dozens of tool calls that produced a result, only the final report.

## How It Works

1. The main agent calls the `task` tool to delegate work to a subagent.
2. The subagent runs in its own **fresh context** — no conversation history from the parent.
3. The subagent executes autonomously until completion.
4. The subagent returns a single final report to the main agent.
5. The main agent's context is updated only with that report.

This means a research subagent that makes 30 web search calls, reads 10 files, and processes thousands of tokens of intermediate data adds only ~500 words to the main agent's context.

## Configuration

Each subagent is independently configurable: model, tools, system prompt, and skills can all differ from the main agent. Subagents do NOT inherit the main agent's tools or system prompt.

```typescript
const researchSubagent = {
  name: "researcher",
  description: "Conducts research on a topic",
  systemPrompt: `You are a research assistant.
IMPORTANT: Return only the essential summary (under 500 words).
Do NOT include raw search results or detailed tool outputs.`,
  tools: [webSearch],
};
```

## Best Practices

1. **Delegate multi-step, output-heavy tasks** — web research, large file processing, database queries.
2. **Constrain subagent output size** — explicitly instruct subagents to return summaries, not raw data. The "under 500 words" convention is standard in Nexus prompts.
3. **Use the filesystem for large data** — subagents write results to files; the main agent reads only what it needs via `read_file` / `grep`. This pairs isolation with the filesystem-backed offloading of [[context-compression]].
4. **Configure subagent models independently** — a cheaper or faster model for the subagent may be appropriate when the task is well-defined.

## Runtime Context Propagation

[[config-runtime-context|Runtime context]] (user metadata, API keys) automatically propagates from the main agent to all subagents. Per-subagent namespacing is available to scope context keys — see the Subagents docs for detail.

## Difference from Context Compression

| | Context Isolation | Context Compression |
|---|---|---|
| When it activates | Proactively, on delegation | Reactively, at token thresholds |
| What it prevents | Context accumulation before it starts | Context overflow after it has grown |
| Action required | Explicit subagent delegation | Automatic, no code change |

## Related

- [[context-engineering]]
- [[subagents]]
- [[context-compression]]
- [[config-runtime-context]]

## Sources

- `raw/langchain/deepagents/context-engineering.md` — context isolation section: mechanism, best practices, subagent response guidelines
