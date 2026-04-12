---
created: 2026-04-12
updated: 2026-04-12
tags: [perplexity, computer, design-inspiration, agent-platform, multi-agent]
sources: [raw/what-is-computer.txt]
---

# Perplexity Computer

Computer is Perplexity's autonomous digital worker product: a system that takes a user prompt and takes action across apps, the web, and documents rather than merely returning answers. It is one of the primary design inspirations for the [[deep-agents-overview|Nexus]] project, which aims to deliver a similar "one prompt → orchestrated multi-agent deliverable" experience as a local-first platform.

## Core Capabilities

Computer positions itself around eight integrated capability pillars:

- **Search-native intelligence** — cited, accurate answers drawn from the live web and connected data sources.
- **Tool execution** — completing tasks across third-party platforms, not just surfacing information.
- **Rich media generation** — creating visual content such as branded slide decks and images.
- **Document creation** — producing reports, presentations, and structured documents.
- **Authenticated integrations** — first-party connectors to Gmail, Outlook, GitHub, Linear, Slack, Notion, Snowflake, Databricks, and Salesforce, among others.
- **Persistent memory** — context retained across sessions, including user preferences and long conversation history.
- **Scheduling and automation** — recurring jobs, condition-based triggers, morning briefings, and deadline reminders, all running asynchronously without user intervention.
- **Secure cloud sandbox** — an isolated execution environment protecting user data; no local install required. This is analogous to the [[aio-sandbox-overview]] used in Nexus.

## How Computer Works

### Asynchronous Execution

Tasks run in the background. Computer can monitor email, calendars, file changes, and flight status through condition-based triggers. Scheduled jobs and proactive notifications (e.g., morning briefings) do not require the user to be present.

### Wide Research and Parallel Web Search

Computer issues parallel web searches to handle queries that span multiple items simultaneously — competitive analysis, market research, or monitoring multiple news sources. This maps directly to Nexus's parallel sub-agent dispatch pattern.

### Sub-Agent Orchestration

Computer uses domain-specific internal agents for distinct task types:

| Agent type | Responsibility |
|---|---|
| Market research agents | Competitive intelligence gathering |
| Financial analysis agents | Earnings reports, stock monitoring |
| News monitoring agents | Breaking updates and alerts |
| Coordination agents | Orchestrating handoffs between specialists |

This multi-agent structure mirrors the [[deep-agents-overview]] architecture that Nexus builds on, where an orchestrator dispatches specialized sub-agents (research, code, creative) through the [[deepagents-frontend-overview|DeepAgents framework]].

### Multi-Tool Orchestration

Capabilities chain together within a single session. A prompt such as:

> "Research our top 5 competitors, compare their pricing, create a slide deck with the findings, and email it to the team."

produces a pipeline: parallel web searches → comparison table construction → branded PPTX generation → Gmail delivery — without the user intervening between steps. This composition model — where a single natural-language prompt triggers a full research-to-deliverable pipeline — is the core behavior Nexus is designed to replicate.

## Computer vs. Perplexity Search

The product distinguishes itself from Perplexity's core search offering along a single axis:

- **Perplexity** = search + knowledge synthesis. Answers questions.
- **Computer** = agent with tools. Takes action.

The key differentiator is composition: capabilities chain naturally across research, analysis, creation, delivery, and scheduling in one session.

## Relevance to Nexus

Nexus is explicitly described as "Inspired by Perplexity Computer" (see project CLAUDE.md). The design goals map as follows:

| Computer concept | Nexus implementation |
|---|---|
| Sub-agent orchestration | DeepAgents orchestrator + Research/Code/Creative sub-agents |
| Secure cloud sandbox | [[aio-sandbox-overview]] (Docker-based) |
| Parallel web research | `tavily_search` tool with parallel sub-agent dispatch |
| Persistent memory | SQLite StoreBackend via CompositeBackend `/memories/` route |
| One-prompt pipeline | Meta-router → orchestrator → deliverable in `apps/agents/` |

Nexus differs in scope: it is a local-first, self-hosted platform without Perplexity's commercial app integrations, but shares the same architectural philosophy of routing a single prompt through parallel specialized agents to produce a synthesized deliverable.

## Related

- [[deep-agents-overview]]
- [[aio-sandbox-overview]]
- [[deepagents-frontend-overview]]
- [[composite-backend]]
- [[subagents]]

## Sources

- `raw/what-is-computer.txt` — Perplexity's product description of Computer: capabilities, execution model, sub-agent architecture, and the Perplexity-vs-Computer distinction
