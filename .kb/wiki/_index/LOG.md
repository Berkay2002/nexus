# Log

## [2026-04-13 21:15] ingest | raw/langchain/langchain/mcp.md — 1 new article

Single-source sequential ingest of the LangChain docs page on `@langchain/mcp-adapters`. Created [[langchain-mcp-adapters]] covering `MultiServerMCPClient`, the stdio / streamable-http transports, the stateless-by-default session behavior, `client.getTools()` aggregation across servers, and a note on the `@modelcontextprotocol/sdk` path for custom servers.

**Cross-domain integration:** the article's `## Use from Nexus` section braids the source doc together with the user's auto-memory `aio_sandbox_mcp.md` (2026-04-13 AIO Sandbox MCP surface verification). That memory established that `POST /mcp` on the sandbox exposes 60 tools (`chrome_devtools_*` 27 + `browser_*` 23 + `sandbox_*` 10) while the `/v1/mcp/*` JSON gateway is half-broken for stdio-backed servers. The new article documents `MultiServerMCPClient` with `transport: "http"` pointed at `http://localhost:8080/mcp` as the canonical Nexus integration path and contrasts it with [[aio-sandbox-mcp-api]] (the gateway article) via an explicit warning callout. This turns an implicit "don't use the JSON gateway" rule into a searchable wiki article the next session will hit on a skim.

**Warning callouts emitted:**
- Stateless-by-default session behavior (source explicitly flags this via a `<Note>`; lifted into a WARNING).
- Do-not-use-the-JSON-gateway guidance (lifted from user memory + contrasts with [[aio-sandbox-mcp-api]]).
- `"sse"` vs `"http"` transport-value discrepancy in the source doc marked `[unverified]`.
- Historical-context note retiring the hand-rolled `mcp-list-servers` / `mcp-list-tools` / `mcp-execute-tool` tools in `apps/agents/src/nexus/tools/`.

**Indices updated:** SOURCES.md (new row under langchain), INDEX.md (added under "LangChain Core"), TAGS.md (extended `mcp`, `tool-call`, `langchain`, `aio-sandbox` tags), RECENT.md (prepended).

## [2026-04-13 20:30] lint | Post-ingest health check (grep-based fallback) — 1 broken link unlinked, hub placement verified

Ran after the AIO Sandbox OpenAPI ingest. Obsidian CLI was unavailable in the Bash sub-shell PATH on this run, so the lint used a Python/grep fallback (read all wiki/ articles, strip code blocks + inline code, regex-extract `[[wikilinks]]`, cross-reference against article filenames and `_index/` references).

**Counts:**
- 117 wiki articles total (was 107; +10 from this morning's ingest).
- 0 articles missing frontmatter.
- 0 missing required frontmatter fields.
- 0 orphan articles (every wiki article has at least one inbound link from another article or an index file).

**Unresolved wikilinks (wiki side):**
- `[[orchestrator-system-prompt]]` — single reference in [[aio-sandbox-sandbox-context-api]] (introduced by the new ingest). Below 2-ref stub threshold, and "orchestrator-system-prompt" is a Nexus internal file (`apps/agents/src/nexus/prompts/orchestrator-system.ts`), not a third-party concept that belongs in the KB. Unlinked — replaced with a plain-text reference to the file path.
- `[[vitest]]`, `[[shadcn-ui]]`, `[[configurable-model]]` — pre-existing, already addressed in earlier lint runs. Left as-is.
- `[[subagents\]]`, `[[config-runtime-context\]]`, `[[memory\]]`, `[[subagent-interface\]]`, `[[tavily-search-api\]]` — false positives. These are Markdown-escaped wikilink examples inside articles documenting how the wiki link syntax works (e.g., in [[deepagents-typescript-reference]] and [[exa-overview]]). The grep regex caught them despite the leading backslash; an Obsidian-side scan would correctly skip them. No action needed.

**Hub detection (backlink counts on this morning's 10 new articles):**
- [[aio-sandbox-shell-api]] — 11 backlinks (load-bearing hub)
- [[aio-sandbox-openapi-overview]] — 10 backlinks (load-bearing hub; pinned at the top of its INDEX category)
- [[aio-sandbox-file-api]] — 8 backlinks
- [[aio-sandbox-jupyter-api]] — 8 backlinks
- [[aio-sandbox-code-execution-api]] — 8 backlinks
- [[aio-sandbox-sandbox-context-api]] — 8 backlinks
- [[aio-sandbox-browser-api]] — 6 backlinks
- [[aio-sandbox-mcp-api]] — 6 backlinks
- [[aio-sandbox-skills-api]] — 6 backlinks
- [[aio-sandbox-util-api]] — 6 backlinks

All 10 are above the 3-backlink hub threshold from their first appearance — the openapi-overview hub-and-spoke pattern is working as intended. No reorder needed: the new "AIO Sandbox — OpenAPI Surface" INDEX category lists the overview first, then the per-tag articles. Existing top-15 vault hubs ([[create-deep-agent]] 24, [[composite-backend]] 23, [[deep-agents-overview]] 21, [[aio-sandbox-overview]] 21, [[subagents]] 20, [[langchain-models]] 20, [[backends]] 19, [[langgraph-persistence]] 18, [[langchain-messages]] 18, [[deepagents-sandboxes]] 17, [[store-backend]] 17, [[context-engineering]] 17, [[use-stream-hook]] 16, [[langchain-tools]] 15, [[checkpointer]] 15) all still surface at the top of their categories.

**No contradictions detected. No new stubs needed. 50-fix cap not reached.** Pages touched: [[aio-sandbox-sandbox-context-api]] only.

## [2026-04-13 20:00] ingest | AIO Sandbox OpenAPI spec — 1 source → 10 new articles

Decomposed `raw/aio-sandbox/openapi.json` (6,947 lines, 41 endpoints, 133 schemas) into per-tag wiki articles. Single source, decomposed via 8 parallel `ingest-worker` subagents (one per substantive tag), with the orchestrator pre-extracting per-tag JSON slices into `C:\tmp\aio\<tag>.json` so workers wouldn't have to re-parse the 7000-line file. Sandbox-context-api and openapi-overview written by the orchestrator directly.

**Articles created:**
- [[aio-sandbox-openapi-overview]] — top-level catalog: tag table, 3 execution surfaces (shell/jupyter/code), universal `Response<T>` envelope, auth/transport notes
- [[aio-sandbox-sandbox-context-api]] — `/v1/sandbox/*` (3 endpoints: env, python pkgs, nodejs pkgs)
- [[aio-sandbox-shell-api]] — `/v1/shell/*` (10 endpoints: persistent sessions, exec/view/wait/write/kill, SSE)
- [[aio-sandbox-file-api]] — `/v1/file/*` (9 endpoints: read/write/replace/search/find/upload/download/list/str_replace_editor)
- [[aio-sandbox-browser-api]] — `/v1/browser/*` (4 endpoints + 15 action schemas: Click/Drag/Hotkey/Press/Scroll/Typing/Wait/etc.)
- [[aio-sandbox-jupyter-api]] — `/v1/jupyter/*` (6 endpoints: stateful kernel sessions)
- [[aio-sandbox-code-execution-api]] — `/v1/code/*` + `/v1/nodejs/*` (4 endpoints: one-shot stateless execution)
- [[aio-sandbox-mcp-api]] — `/v1/mcp/*` (3 endpoints: list servers, list tools, exec tool)
- [[aio-sandbox-skills-api]] — `/v1/skills/*` (5 endpoints: HTTP skills registry)
- [[aio-sandbox-util-api]] — `/v1/util/convert_to_markdown` (1 endpoint: URI-only document conversion)

**Key gotchas surfaced as warning callouts (~35 across all articles):**
- **SSE switch via Accept header** — `/v1/shell/exec` and `/v1/shell/view` silently switch to SSE if `Accept: text/event-stream` is sent. Body shape unchanged.
- **Session auto-creation** — `exec` without `id` creates a fresh unnamed session that needs separate cleanup.
- **`success: true` is not the whole story** — HTTP 200 + `success: true` can still wrap a tool-level failure. MCP `CallToolResultModel.isError` and shell `ShellCommandResult` carry their own error flags. Always inspect `data`.
- **Three execution surfaces, three lifetimes** — `/v1/shell/exec` (session-persistent) vs `/v1/jupyter/execute` (kernel-persistent) vs `/v1/code/execute` (stateless). Picking the wrong one is the easiest mistake.
- **`find` vs `search`** — find = filename glob; search = content grep. Easy to swap silently with no error.
- **`str_replace_editor`** is a multi-mode stateful editor (5 commands), not a plain replace.
- **`file/write` vs `file/upload`** — agents should use `write` (JSON, base64); multipart upload is for clients.
- **`show_hidden` defaults to `true`** — opposite of `ls`.
- **`MoveTo` vs `MoveRel` / `DragTo` vs `DragRel`** — absolute vs relative coordinates; field name confusion causes 422.
- **`Hotkey` vs `Press` vs `KeyDown/KeyUp`** — three distinct keyboard primitives for different use cases.
- **`Browser` is CDP, not Playwright** — coordinate-driven, one action per call (no batching).
- **Jupyter `cleanup_all_sessions`** wipes ALL agents' kernels (shared sandbox concern).
- **Stateless ≠ shellless** — `/v1/code/execute` shares `/home/gem/workspace/` with shells; statelessness is in-process only.
- **`Language` enum is currently 2 values** (python/javascript) — call `/v1/code/info` at runtime for authoritative list.
- **MCP `isError: true` on HTTP 200** — tool-level failure distinct from HTTP status.
- **MCP server registration is config-time only** — no runtime registration endpoint.
- **`/mcp` and `/v1/mcp` (Streamable HTTP transport)** are NOT the same as the JSON gateway at `/v1/mcp/*`.
- **`/jupyter` (UI route)** is NOT the same as `/v1/jupyter/*` (JSON API).
- **AIO Sandbox skills API ≠ DeepAgents `/skills/` pattern** — Nexus uses the in-state DeepAgents pattern today, not this HTTP registry.
- **`DELETE /v1/skills` wipes the entire shared registry** — destructive on multi-agent containers.
- **`/v1/util/convert_to_markdown` accepts `uri` only, no upload** — host files must be pushed into the container via the file API first.
- **No auth at protocol layer** — the spec defines no `securitySchemes`. Container must live behind a trust boundary.
- **`home_dir = /home/gem`** — duplicated at both top-level and `detail.system.home_dir` on `SandboxResponse`. Top-level is authoritative.

**Reconciliation:** No duplicate articles created. No filename collisions. All 10 articles cross-link to each other via the openapi-overview hub and pairwise via the Related sections. Indices (INDEX, TAGS, SOURCES, RECENT) updated. Single batch commit.

## [2026-04-13 18:30] lint | Post-ingest health check — 1 stub created, 1 broken link unlinked

Ran after the LangGraph/LangChain testing ingest batch.

**Unresolved wikilinks (wiki side, ignoring raw/):**
- `[[langgraph-functional-api]]` — referenced 2x from [[durable-execution]] (`task()` + Related). Met 2+ threshold; created stub article linking to [[durable-execution]], [[langgraph-runtime]], [[pregel]], [[checkpointer]]. Indexed under LangGraph — Core & Runtime.
- `[[vitest]]` — single reference in [[langgraph-testing]]. Unlinked to plain `` `vitest` `` — vitest is a tool name, not a concept that deserves its own article.

**Orphan pages:** none on the wiki side. All 26 new articles from the ingest batch have inbound wikilinks (verified via `obsidian orphans`). Orphans list contained only raw/ source files (expected — raw/ is immutable input) and `wiki/_index/` files (expected — indices are meta).

**Hub detection (backlink counts on new articles):**
- [[checkpointer]] — 25 backlinks (load-bearing hub)
- [[langgraph-persistence]] — 26 backlinks (load-bearing hub)
- [[human-in-the-loop]] — 10 backlinks
- [[langgraph-runtime]] — 13 backlinks
- [[deepagents-human-in-the-loop]] — 12 backlinks
- [[fake-model]] — 13 backlinks
All new articles already surfaced at the top of their INDEX.md categories — no reorder needed.

**No contradictions detected.** **No missing frontmatter.** **50-fix cap not reached.**

## [2026-04-13 18:00] ingest | LangGraph core + LangChain testing + LangSmith Studio — 13 sources → 26 new articles, 5 updated

Parallel ingest dispatch with 13 `ingest-worker` subagents (Sonnet 4.6), one per source, with a concept assignment table to prevent duplicate article creation.

**Sources processed:**
- `raw/langchain/deepagents/customize.md` → 1 new + 4 existing articles updated
- `raw/langchain/langchain/langsmith-studio.md` → [[langsmith-studio]]
- `raw/langchain/langchain/test/overview.md` → [[langchain-testing-overview]]
- `raw/langchain/langchain/test/unit-testing.md` → [[langchain-unit-testing]], [[fake-model]]
- `raw/langchain/langchain/test/integration-testing.md` → [[langchain-integration-testing]]
- `raw/langchain/langchain/test/agent-evals.md` → [[agent-evals]], [[trajectory-match-evaluator]], [[llm-as-judge-evaluator]]
- `raw/langchain/langgraph/application-structure.md` → [[langgraph-application-structure]], [[langgraph-config-file]]
- `raw/langchain/langgraph/local-server.md` → [[langgraph-local-server]], [[langgraph-cli]]
- `raw/langchain/langgraph/persistence.md` → [[langgraph-persistence]], [[checkpointer]], [[threads]], [[checkpoints]], [[langgraph-store]] (+ update to [[cross-conversation-context]])
- `raw/langchain/langgraph/durable-execution.md` → [[durable-execution]], [[durability-modes]]
- `raw/langchain/langgraph/interrupts.md` → [[langgraph-interrupts]], [[human-in-the-loop]], [[command-resume]]
- `raw/langchain/langgraph/runtime.md` → [[langgraph-runtime]], [[pregel]], [[actors-and-channels]]
- `raw/langchain/langgraph/test.md` → [[langgraph-testing]]

**Updated existing articles (from customize.md):**
- [[create-deep-agent]] — parameter table rewrite; `interrupt_on` → `interruptOn` fix; middleware list expanded 4→9; WARNING callouts added
- [[deepagents-models]] — added Connection Resilience section (`maxRetries`, `timeout`); WARNING about default=6
- [[harness-capabilities]] — fixed HITL section (`interruptOn`, `allowedDecisions`, checkpointer requirement)
- [[subagent-interface]] — fixed `interrupt_on` → `interruptOn` in SubAgent field table
- [[cross-conversation-context]] — linked into new persistence cluster

**Key gotchas surfaced:**
- `interruptOn` (TypeScript) — two existing articles had the Python-style `interrupt_on`; corrected. Checkpointer is REQUIRED for HITL to function.
- `maxRetries` defaults to **6**, not unlimited — important for long-running Nexus agents.
- `thread_id` silently stateless if omitted — state will not persist, no error raised.
- `fakeModel` throws (does not hang) if invoked more times than responses queued.
- AgentEvals `subset` mode passes on **zero** tool calls (empty set is subset of any set).
- LangGraph `test.md` is for custom StateGraph structures; `createAgent` users need [[langchain-unit-testing]].
- Safari blocks LangSmith Studio `localhost` connections — use `--tunnel` flag.
- Vitest does not reliably auto-load `.env` — use `source .env && export VAR_NAME` before integration runs.
- Pregel runtime writes are invisible during the Execute phase; only visible after Update.
- DeepAgents HITL (`interruptOn` / `HumanInTheLoopMiddleware`) is distinct from LangGraph `interrupt()` — cross-linked.

**Reconciliation:** No duplicate articles detected. All 26 new files present in `wiki/`. Indices rebuilt (INDEX, TAGS, SOURCES, RECENT). Single batch commit.

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

