---
created: 2026-04-12
updated: 2026-04-12
tags: [deepagents, skill, workflow, instructions]
sources: [raw/langchain/deepagents/skills.md]
---

# SKILL.md Format

`SKILL.md` is the required entry-point file for every [[skills|DeepAgents skill]]. It contains YAML frontmatter metadata followed by freeform Markdown instructions. The agent reads only the frontmatter at startup (for skill matching) and loads the full file body only when it decides to apply the skill.

## Frontmatter Fields

```yaml
---
name: langgraph-docs                         # required — unique skill identifier
description: Use this skill for requests…   # required — used for skill matching (max 1024 chars)
license: MIT                                 # optional
compatibility: Requires internet access      # optional — runtime prerequisites
metadata:                                    # optional — arbitrary key/value pairs
  author: langchain
  version: "1.0"
allowed-tools: fetch_url                     # optional — tools this skill may call
---
```

### Critical Constraints

| Field | Limit | Consequence of violation |
|---|---|---|
| `description` | 1024 characters | Truncated silently — skill may not match correctly |
| `SKILL.md` file size | 10 MB | File skipped during skill loading entirely |

Keep `description` concise and specific. The agent uses it as the sole signal for deciding whether to load the skill. Vague descriptions produce missed matches; descriptions over 1024 characters are cut off without warning.

## File Body

After frontmatter, the body is plain Markdown. Structure it to give the agent clear, numbered instructions. Include:

- **Overview** — what this skill does
- **Instructions** — numbered, step-by-step workflow
- **References to supporting files** — scripts, templates, example files in the same directory must be explicitly named with their paths and purpose, or the agent will not discover them

```markdown
---
name: deep-research
description: Use this skill for deep research tasks requiring multi-source synthesis.
---

# deep-research

## Overview
Conducts thorough research by searching multiple sources and synthesizing findings.

## Instructions

### 1. Plan the research
Identify 3-5 search queries covering different angles of the topic.

### 2. Execute searches
Use the tavily_search tool for each query.

### 3. Synthesize
Write a structured report using templates/report-template.md as the format guide.

## Supporting Files
- `templates/report-template.md` — Markdown template for final research reports
- `examples.md` — Example completed reports for reference
```

## One-Workflow-Per-Skill Rule

Each `SKILL.md` should encode a single workflow. Combining multiple distinct workflows into one skill makes descriptions imprecise (hurting matching) and bodies harder for the agent to follow. Create separate skill directories for separate workflows.

## Supporting Files Convention

All supporting files (scripts, templates, reference docs) must be:
1. Located in the same skill directory as `SKILL.md`
2. Referenced by path inside `SKILL.md` with an explanation of their content and when to use them

Without an explicit reference in `SKILL.md`, the agent has no way to know the file exists.

## Nexus Skill Files

Nexus's five skills follow this format:

| Skill | Key workflow |
|---|---|
| `deep-research` | Multi-source research + synthesis report |
| `build-app` | Scaffold, implement, and test applications |
| `generate-image` | Image generation with iterative refinement |
| `data-analysis` | Data loading, analysis, and visualization |
| `write-report` | Structured report writing from gathered content |

All live under `apps/agents/src/nexus/skills/{name}/` with `SKILL.md`, `examples.md`, and a `templates/` subdirectory.

## Related

- [[skills]]
- [[context-engineering]]
- [[memory]]
- [[filesystem-middleware]]

## Sources

- `raw/langchain/deepagents/skills.md` — Full SKILL.md field reference, constraints (1024-char description limit, 10MB file limit), example files, one-workflow-per-skill guidance
