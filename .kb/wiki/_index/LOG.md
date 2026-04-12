# Log

## [2026-04-12 20:20] create | Knowledge base initialized
Created nexus-kb knowledge base (project-solo mode).

## [2026-04-12 22:00] ingest | Initial bulk ingest — 34 sources → 79 articles
Compiled the full Nexus third-party stack into the wiki via parallel ingest-worker dispatch (3 waves of ~10-12 workers). Sources:
- `raw/aio-sandbox/` (2 files → 5 articles)
- `raw/custom/exa/` and `raw/custom/tavily/` (4 files → 6 articles)
- `raw/langchain/deepagents/` (16 files → 42 articles)
- `raw/langchain/langchain/` (3 files → 12 articles)
- `raw/langchain/providers/` (6 files → 6 articles)
- `raw/references/` (2 files → 2 articles)
- `raw/what-is-computer.txt` (1 file → 1 article)

Nexus-specific gotchas explicitly captured:
- `tavily-map-api` returns `results` (URL strings), not `urls`
- `useStream` must come from `@langchain/react`, not `@langchain/langgraph-sdk/react`
- `filterSubagentMessages` requires `as any` due to `AnyStreamOptions` vs `UseStreamOptions` type gap
- `SubagentStreamInterface` has no `model` field — derive from `subagent_type` mapping
- `stream.values?.todos` requires optional chaining
- `FileData` is a V1/V2 union; Nexus skills use V1 (`content: string[]`)
- DeepAgents always adds a general-purpose subagent alongside custom ones

No failures; no duplicate articles detected in reconciliation. Indices (INDEX, TAGS, SOURCES, RECENT) rebuilt from scratch.
