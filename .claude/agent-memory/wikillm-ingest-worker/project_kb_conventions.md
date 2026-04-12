---
name: KB Vault Conventions
description: Article format, directory layout, index ownership, and cross-linking rules for the Nexus KB at .kb/
type: project
---

Wiki lives at `.kb/wiki/`. Sources are immutable under `.kb/raw/`. Articles use kebab-case filenames with YAML frontmatter: `created`, `updated`, `tags`, `sources`. Required sections: `# Title`, brief summary, `## Content`, `## Related` (2-5 wikilinks), `## Sources`.

**Why:** Ingest workers are assigned concept ownership tables. Only the owning worker creates/updates an article; others use [[wikilinks]] to reference it. The orchestrator updates index files (`_index/`) — workers must not touch those.

**How to apply:** Before creating any article, verify ownership in the task's concept assignment table. Never create articles for LINK-ONLY concepts. Never edit `_index/` files. Use `[[wikilinks]]` for all cross-references, linking only on first mention.

Existing articles as of 2026-04-12: `tavily-extract-api`, `tavily-overview`, `tavily-map-api`, `exa-search-api`, `aio-sandbox-overview`, `aio-sandbox-deepagents-integration`, `tavily-search-api`, `exa-overview`, `deep-agents-overview`, `aio-sandbox-docker`.
