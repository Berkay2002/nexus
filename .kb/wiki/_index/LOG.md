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

## [2026-04-13 15:45] lint | Health check — resolved broken wikilinks, connected outliers, bridged clusters
Triggered from user report that the Obsidian graph showed two disconnected clumps and isolated outliers.

**Broken wikilinks (wiki side):**
- `[[agent-protocol]]` (3 refs in [[async-subagents]]) — created stub article `wiki/agent-protocol.md` covering the LangGraph Agent Protocol as the transport layer for async subagents (ASGI and HTTP modes).
- `[[configurable-model]]` (1 ref in [[create-deep-agent]]) — unlinked (below 2-ref stub threshold); kept plain text with a pointer to [[init-chat-model]].
- `[[shadcn-ui]]` (1 ref in [[ai-elements]]) — unlinked (external library without its own article).

**Zero-backlink outliers connected:**
- [[deepagents-typescript-reference]] — now referenced from [[deep-agents-overview]] and [[create-deep-agent]].
- [[langchain-google-api-reference]] — now referenced from [[google-provider]] and [[chat-google-generative-ai]].
- [[perplexity-computer]] — now referenced from [[deep-agents-overview]] as Nexus's primary design inspiration.

**Cross-cluster bridges added** (frontend cluster was weakly joined to the main cluster):
- [[use-stream-hook]] → [[streaming]], [[stream-modes]], [[langchain-messages]]
- [[deepagents-frontend-overview]] → [[deep-agents-overview]], [[streaming]], [[ai-elements-components]]
- [[context-engineering]] → [[context-overview]] (clarifies LangGraph 3-mechanism vs DeepAgents 5-type taxonomies)
- [[tavily-search-api]] → [[exa-search-api]], [[exa-overview]] (strengthened exa/tavily sub-cluster)

**Duplicate audit:** scanned all shared-source article groups (`backends.md` → 7 articles, `overview.md` → 5, `context-engineering.md` → 4, `context.md` → 4, `subagents.md` → 4, `models.md` → 4, `tools.md` → 4, `messages.md` → 4, `ai-elements.md` → 2). No true duplicates — each shared-source pair/group splits the concept cleanly (e.g., `backends`/`backend-protocol`, `memory`/`long-term-memory`, `ai-elements`/`ai-elements-components`). Keeping one-concept-per-article per KB convention.

**Graph scope fix:** updated `.obsidian/graph.json` to filter to `path:wiki/ -path:wiki/_index/` so the global graph view shows only compiled articles, excluding `raw/` source material and the `_index/` admin files. Also enabled `hideUnresolved: true` so dangling `raw/` outlinks don't clutter the graph.

Pages touched: [[agent-protocol]] (new), [[async-subagents]], [[create-deep-agent]], [[ai-elements]], [[deep-agents-overview]], [[google-provider]], [[chat-google-generative-ai]], [[tavily-search-api]], [[use-stream-hook]], [[context-engineering]], [[deepagents-frontend-overview]]. Plus `_index/INDEX.md`, `_index/TAGS.md`, `_index/SOURCES.md`, `_index/RECENT.md`.

No contradictions flagged. No stale `[unverified]` markers processed this run.

