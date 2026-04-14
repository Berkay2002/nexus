---
name: write-report
description: Use when the user asks to write a report, create a document, draft a summary, compile findings, or produce any formatted written deliverable. Triggers on requests for reports, white papers, competitive analyses, documentation, and structured written output.
---

# Write Report

## Overview

Orchestrate Research, Code, and Creative sub-agents to produce comprehensive, well-structured written documents. Handles the full pipeline from research gathering through formatting and visual assets.

## When to Use

- User asks to "write", "draft", "create", or "compile" a report or document
- Request requires gathering information AND producing a formatted output
- Task involves synthesizing multiple sources into a cohesive document

## When NOT to Use

- User just wants to research a topic without producing a document (use deep-research)
- User wants data analysis with charts (use data-analysis — it produces its own analysis report)
- User wants to build software (use build-app)

## Workflow

### Step 1: Plan the Report

Create a plan using `write_todos`:
- What is the report about? What audience?
- What sections does it need? Use the template at `templates/report.md` as a starting point, adapting structure to the request
- Does it need visual elements? (comparison tables, diagrams, images)

### Step 2: Gather Source Material

Spawn **research** sub-agents to gather information:
- One sub-agent per major section or topic area (parallel)
- If the research topic is complex, consider loading the **deep-research** skill for thorough multi-source decomposition
- Each Research agent writes to `{workspaceRoot}/research/task_{id}/`
- Wait for all research to complete before drafting

See `examples.md` for research task description templates tailored to report writing.

### Step 3: Draft the Report

Spawn a **code** sub-agent to compile the report.

The task description MUST include:
- Report outline (sections and what each should cover)
- Paths to all research findings
- Workspace path: `{workspaceRoot}/code/task_{id}/`
- Output format: Markdown (.md)
- Instruction to synthesize (not copy-paste) and cite sources inline
- Reference to the report template at `templates/report.md`

See `examples.md` for the full Code agent task template.

### Step 4: Visual Assets (When Appropriate)

If the report would benefit from visual elements:
- Spawn a **creative** sub-agent for illustrations, diagrams, or cover images
- See the **generate-image** skill for prompt guidance
- For data-driven charts, use a **code** sub-agent with matplotlib instead (Creative is for artistic/illustrative images)

### Step 5: Assemble and Deliver

After all sub-agents complete:
1. Read the draft report from the Code agent
2. If Creative produced images, reference them in the report markdown
3. Copy final report to `{workspaceRoot}/shared/report.md`
4. If the user requested a different format (PDF, HTML), spawn a Code agent to convert using pandoc
5. Return a concise summary of the report contents (under 500 words)

## Complementary Skills

- **deep-research**: For thorough multi-source research phases. When both skills load, deep-research handles decomposition and research, write-report handles structuring and formatting.
- **data-analysis**: If the report involves data-driven sections (statistics, trends, charts), data-analysis can produce the analysis and visualizations that write-report incorporates.
- **generate-image**: For visual elements like diagrams, illustrations, or cover images in the report.

## Output Format

```
{workspaceRoot}/shared/
├── report.md              # The complete formatted report (see templates/report.md)
├── assets/                # Visual elements (optional)
│   ├── {descriptive-name}.png
│   └── {descriptive-name}.png
└── sources.json           # All sources used, structured
```
