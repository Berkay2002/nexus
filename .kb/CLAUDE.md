# nexus-kb

This is a wikillm knowledge base for the **Nexus** project — a compiled, cross-referenced wiki maintained by Claude Code that covers AI agent orchestration, LangChain / LangGraph / DeepAgents, AIO Sandbox, Tavily/Exa search APIs, and multi-agent platform architecture for TypeScript.

## Philosophy

This knowledge base is the project's compiled understanding of its third-party stack. Nexus is a local-first AI agent platform built on DeepAgents, AIO Sandbox, and LangGraph — and the reference material for those libraries sprawls across megabytes of upstream docs, blog posts, API specs, and example code. This KB compiles all of that into a single cross-linked wiki so a Claude Code session working on Nexus can ask "how does `CompositeBackend` route `/memories/`?" or "what shape does Tavily's `map` endpoint return?" and get a synthesized answer instead of grepping headers in raw markdown.

The wiki is the knowledge base. Sources in `raw/` are the primary material. Articles in `wiki/` are the synthesis: one concept per page, cross-linked, up to date. The contradictions have already been flagged. The connections are already drawn.

### Domain vocabulary

Write with the precision of someone who has read all the DeepAgents and LangChain source. Preferred tags for the Nexus stack:

- **Frameworks:** `langchain`, `langgraph`, `deepagents`, `langchain-core`, `langgraph-sdk`
- **Agent concepts:** `orchestrator`, `subagent`, `middleware`, `streaming`, `tool-call`, `meta-router`, `context-engineering`
- **Execution:** `aio-sandbox`, `composite-backend`, `store-backend`, `filesystem`, `workspace`
- **Models & providers:** `anthropic`, `google`, `openai`, `zai`, `glm`, `gemini`, `configurable-model`, `tier-routing`
- **Tools & APIs:** `tavily`, `exa`, `search`, `extract`, `map`, `generate-image`
- **Frontend:** `use-stream`, `filter-subagent-messages`, `ai-elements`, `shadcn`, `next-js`
- **Patterns:** `skill`, `memory`, `persistence`, `drizzle`, `sqlite`

Tag articles with 2-5 tags from this list (or add new ones that fit the stack). Avoid generic tags like `api`, `docs`, `reference` — they're too broad to be useful.

**This is not RAG.** There are no embeddings, no vector stores, no retrieval pipelines. Knowledge is compiled once into the wiki and kept current via `/wikillm:ingest`. Queries read the wiki directly.

## Directory Structure

```
.kb/
├── CLAUDE.md              ← this file
├── raw/                   ← immutable source material
│   └── assets/            ← images, PDFs, binary attachments
├── wiki/                  ← compiled articles (LLM-owned)
│   └── _index/
│       ├── INDEX.md       ← content catalog by category
│       ├── TAGS.md        ← tag → articles map
│       ├── SOURCES.md     ← raw/ → wiki/ article map
│       ├── RECENT.md      ← last 20 changed articles
│       └── LOG.md         ← chronological operation log
├── outputs/
│   └── visualizations/    ← generated charts, diagrams, plots
└── .obsidian/             ← Obsidian workspace configuration
```

The parent repository (Nexus) lives one level up. This vault is self-contained — nothing inside `.kb/` is imported or required by the Nexus agents at runtime. It exists purely so Claude Code sessions working on the Nexus codebase can consult reference material quickly.

## Automation

Scheduled tasks run via Claude Desktop and require it to be running:

- **Daily ingestion** — `/wikillm:ingest` runs every day and processes any new files in `raw/`. If no new files, it exits silently.
- **Weekly lint** — `/wikillm:lint` runs weekly to fix broken wikilinks, find orphan pages, flag missing frontmatter, and surface contradictions.

You can also trigger both on demand at any time. Automation is a convenience, not a requirement — ingest and lint are the source of truth for when the wiki gets updated.

## Ingestion

When you add files to `raw/`, run `/wikillm:ingest` to compile them into wiki articles.

The ingest pipeline:

1. Detects unprocessed files by diffing `raw/` against `wiki/_index/SOURCES.md`
2. For each new file: identifies concepts, checks existing coverage, decides whether to create new articles or update existing ones
3. Writes articles following the format below, cross-links them with `[[wikilinks]]`, and updates all four indices
4. Commits one git commit per source file with message `ingest: <source-name> — added N new articles, updated M existing`

For bulk imports (3+ files), ingest dispatches parallel `ingest-worker` subagents and does a reconciliation pass at the end to dedupe and cross-link across workers.

See `/wikillm:ingest` for the full procedure.

## Query

When answering questions against the knowledge base, use `/wikillm:query`. It:

1. Finds the most relevant wiki articles (via Obsidian search if available, Grep otherwise)
2. Reads them and synthesizes an answer
3. Chooses an appropriate output format — inline answer, structured report, slide deck, or visualization
4. Files valuable results back into the wiki

Query focus for this project-solo KB: architecture questions ("Why is the code like this?"), API shape questions ("What does this endpoint return?"), decision context ("Why did we choose X over Y?"), and integration questions ("How does component A talk to component B?").

Example queries:
- "How does CompositeBackend route `/memories/` vs default paths?"
- "What does Tavily's map API return — `urls` or `results`?"
- "What's the difference between `@langchain/react` and `@langchain/langgraph-sdk/react` for the useStream hook?"
- "How does DeepAgents dispatch custom sub-agents alongside the general-purpose one?"

## Wiki Conventions

- **Filenames:** kebab-case (e.g., `composite-backend.md`, `tavily-map-api.md`)
- **Links:** always use `[[wikilinks]]` for cross-references
- **Frontmatter:** YAML on every page (`created`, `updated`, `tags`, `sources`)
- **One concept per article.** If an article covers two distinct ideas, split it.
- **Update existing articles** over creating near-duplicates.
- **Mark uncertainty** with `[unverified]` inline.

### Article format

```markdown
---
created: YYYY-MM-DD
updated: YYYY-MM-DD
tags: [tag1, tag2]
sources: [raw/source-file.ext]
---

# Article Title

Brief summary (2-3 sentences).

## Content

Main content organized with headers.

## Related

- [[Related Article 1]]
- [[Related Article 2]]

## Sources

- `raw/source-file.ext` — what was drawn from this source
```

### Cross-linking

- Link on **first mention** of a concept in each article, not every mention.
- A concept deserves its own page if it's a distinct entity (library, API, pattern), referenced in 2+ articles, or complex enough to need explanation.
- Every article has a `## Related` section with 2-5 links.
- Don't over-link common words that happen to be titles ("tool", "model", "agent") unless referring to the specific concept.

## Index System

All four indices live in `wiki/_index/` and must be updated after every ingest:

- **INDEX.md** — content catalog: `- [[article-name]] — one-line summary` grouped by category (e.g., "LangChain Core", "DeepAgents", "AIO Sandbox", "APIs", "Providers").
- **TAGS.md** — tag directory: `## tag-name` followed by a list of `[[articles]]` using that tag.
- **SOURCES.md** — provenance map: `- raw/filename.ext → [[summary-page]], [[article-1]], [[article-2]]`. This is also how ingest detects which files are already processed.
- **RECENT.md** — change feed: last 20 changed articles, most recent first: `- [[article]] — YYYY-MM-DD — what changed`.
- **LOG.md** — chronological operation log: `## [YYYY-MM-DD HH:MM] operation | Title` with one entry per ingest/lint run.

## Visualizations

Generated charts, diagrams, and plots live in `outputs/visualizations/`. When a query produces a visual answer (e.g., "show me the request flow between AIO Sandbox, LangGraph, and Next.js as a diagram"), save the artifact here and link it from the relevant wiki article.

Workflow:

1. Generate with matplotlib, mermaid, or inline SVG — whatever fits the data
2. Save as `outputs/visualizations/<kebab-case-name>.{png,svg,md}`
3. Embed in the relevant wiki article: `![[../outputs/visualizations/name.png]]`
4. Reference the source article from the visualization's caption

Keep visualizations regeneratable — either store the generation script alongside the output or document the prompt that produced it.

## Web Clipper Pipeline

When you clip a webpage via Obsidian Web Clipper (or any browser-to-markdown pipeline), drop the resulting file into `raw/`. Ingest will pick it up on the next run — you don't need to do anything special.

Clipped pages should be named descriptively (not `clipped-2026-04-12.md`) so future you can tell them apart at a glance. Good: `langchain-runnable-sequence-blog.md`. Bad: `blog.md`.

Clipped sources count the same as any other `raw/` file — they become wiki articles, they get cross-linked, they get indexed. The clipper is just a fast way to get web content into `raw/`.

## Rules

1. **`raw/` is immutable.** Never delete or edit source files. If a source is wrong, add a correction as a new source; the wiki article synthesis will reconcile them.
2. **The wiki is LLM-owned.** The human reads; the LLM writes. Don't hand-edit `wiki/` articles — if something is wrong, fix it via `/wikillm:ingest` or `/wikillm:lint`.
3. **Always update indices and `LOG.md` after wiki changes.** Out-of-date indices break detection and discovery.
4. **Always `git commit` (and push, if configured) after every operation batch.** One commit per source file on ingest; one commit per lint fix batch.
5. **Use `[[wikilinks]]` for all cross-references.** Never use raw relative paths for article-to-article links — they break Obsidian's graph and backlinks.
6. **`docs/superpowers/` in the parent repo is NOT part of this KB.** Specs, plans, and human process docs stay in `docs/superpowers/` and must not be moved into `raw/`.
