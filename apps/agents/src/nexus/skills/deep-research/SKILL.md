---
name: deep-research
description: Use when the user asks to research a topic, investigate a question, find information, compare options, or gather comprehensive knowledge from multiple sources. Triggers on research requests, fact-finding, competitive analysis, and literature reviews.
---

# Deep Research

## Overview

Decompose broad research questions into focused sub-questions, spawn parallel Research sub-agents for each, and synthesize findings into a comprehensive report with sources.

## When to Use

- User asks to "research", "investigate", "find out about", "compare", or "look into" a topic
- Request requires gathering information from multiple sources
- Topic is broad enough to benefit from decomposition into sub-questions

## When NOT to Use

- User just needs a quick factual answer (orchestrator can answer directly)
- Request is about generating images, writing code, or building something (use build-app, generate-image)
- User already has data and wants analysis (use data-analysis)

## Workflow

### Step 1: Decompose the Question

Break the user's research topic into focused sub-questions. Let the number of sub-questions match the scope naturally — a narrow topic might need 2-3, a broad one might need 6-8. Each sub-question should be independently answerable.

### Step 2: Spawn Research Sub-Agents

Spawn one **research** sub-agent per sub-question using the `task` tool. These run in parallel.

Each task description MUST include:
- The specific sub-question to answer
- Workspace path: `/home/gem/workspace/research/task_{id}/`
- Output instructions: use the findings template at `templates/findings.md` and source format at `templates/sources.json`
- Instruction to search broadly, then extract deeply from the best sources

See `examples.md` for ready-to-use task description templates.

### Step 3: Review and Fill Gaps

After all sub-agents return:
1. Read each agent's `findings.md` from the filesystem
2. Check for gaps — are any sub-questions poorly answered?
3. If gaps exist, spawn follow-up Research sub-agents with more targeted queries
4. Check for contradictions across sources and note them

### Step 4: Synthesize

Combine all findings into a single comprehensive output:
- Write `/home/gem/workspace/shared/findings.md` using the format in `templates/findings.md`
- Write `/home/gem/workspace/shared/sources.json` following the structure in `templates/sources.json`
- Copy relevant raw data to `/home/gem/workspace/shared/raw/` if needed
- Return a concise summary (under 500 words) in the conversation

## Complementary Skills

- **write-report**: If the user wants a formatted report from the research, write-report can use the findings from deep-research as input material. Both skills can load together.
- **data-analysis**: If research findings include datasets that need analysis, data-analysis can process them after deep-research completes.

## Output Format

```
/home/gem/workspace/shared/
├── findings.md        # Synthesized research with all sub-questions addressed
├── sources.json       # [{title, url, relevance}] — all sources, deduplicated
└── raw/               # Raw extracted content from key sources (optional)
```
