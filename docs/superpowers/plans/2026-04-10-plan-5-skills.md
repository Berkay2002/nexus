# Plan 5: Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create 5 orchestrator skills (deep-research, build-app, generate-image, data-analysis, write-report) with SKILL.md files, task description examples, and output templates. Add a `/skills/` StoreBackend route to the CompositeBackend for serving them, seed skill content at orchestrator startup, and verify the orchestrator loads skills on demand.

**Architecture:** Each skill is a directory containing SKILL.md (orchestration workflow), examples.md (ready-to-use task description templates), and templates/ (output format templates for sub-agents). Skills are stored in the repo at `src/nexus/skills/{name}/`. A `/skills/` route is added to the CompositeBackend pointing to a StoreBackend. A seeding module reads all skill files and populates the store on invocation. DeepAgents' progressive disclosure loads only frontmatter initially, reading full SKILL.md (which references examples.md and templates/) when the orchestrator determines a match. Skills teach the orchestrator **sub-agent delegation patterns** and complement each other: write-report references deep-research for thorough research phases, data-analysis leverages deep-research for data gathering, build-app references generate-image for visual assets.

**Tech Stack:** DeepAgents skills system (SKILL.md frontmatter + progressive disclosure), CompositeBackend, StoreBackend, `FileData` type from `deepagents`, Vitest.

---

## File Structure

```
apps/agents/src/nexus/
├── skills/                              ← NEW: Skill definitions
│   ├── deep-research/
│   │   ├── SKILL.md                     ← Orchestration workflow
│   │   ├── examples.md                  ← Task description templates for Research agents
│   │   └── templates/
│   ��       ├── findings.md              ← Template for synthesized findings
│   │       └── sources.json             ← Template for structured source list
│   ├── build-app/
│   │   ├── SKILL.md                     ← Orchestration workflow
│   │   ├── examples.md                  ← Task description templates for Code/Research/Creative
│   │   └── templates/
│   │       └── build-log.md             ← Template for build log output
│   ├── generate-image/
│   │   ├── SKILL.md                     ← Orchestration workflow
│   │   ├── examples.md                  ← Task description templates with prompt patterns
│   │   └── templates/
│   │       └── prompt-log.md            ← Template for documenting prompts used
│   ├── data-analysis/
│   │   ├── SKILL.md                     ← Orchestration workflow
│   │   ├── examples.md                  ← Task description templates for Code/Research
│   │   └���─ templates/
│   │       └── analysis-report.md       ← Template for analysis report
│   ├── write-report/
│   │   ├── SKILL.md                     ← Orchestration workflow
│   │   ├── examples.md                  ← Task description templates for multi-agent pipeline
│   ���   └── templates/
│   │       └── report.md                ← Flexible report template with section suggestions
│   └── index.ts                         ← Barrel: reads all skill files, exports as FileData map
├── backend/
│   ├── composite.ts                     ← MODIFY: Add /skills/ route to StoreBackend
│   └── store.ts                         ← MODIFY: Add createSkillsStore() factory
├── orchestrator.ts                      ← MODIFY: Seed skills into store on invocation
└── __tests__/
    ├─��� skills-content.test.ts           ← NEW: Validates all SKILL.md files + supporting files
    ���── skills-seeding.test.ts           ← NEW: Tests skill seeding into StoreBackend
    └��─ skills-backend.test.ts           ← NEW: Tests /skills/ CompositeBackend route
```

---

### Task 1: Create deep-research skill (SKILL.md + examples + templates)

**Files:**
- Create: `apps/agents/src/nexus/skills/deep-research/SKILL.md`
- Create: `apps/agents/src/nexus/skills/deep-research/examples.md`
- Create: `apps/agents/src/nexus/skills/deep-research/templates/findings.md`
- Create: `apps/agents/src/nexus/skills/deep-research/templates/sources.json`
- Test: `apps/agents/src/nexus/__tests__/skills-content.test.ts`

- [ ] **Step 1: Write the failing test for skill content validation**

Create the test file that validates SKILL.md files, supporting files, and frontmatter:

```typescript
// apps/agents/src/nexus/__tests__/skills-content.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillsDir = resolve(__dirname, "../skills");

function readSkill(name: string): string {
  return readFileSync(resolve(skillsDir, name, "SKILL.md"), "utf-8");
}

function readFile(name: string, file: string): string {
  return readFileSync(resolve(skillsDir, name, file), "utf-8");
}

function fileExists(name: string, file: string): boolean {
  return existsSync(resolve(skillsDir, name, file));
}

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      fm[line.slice(0, colonIdx).trim()] = line.slice(colonIdx + 1).trim();
    }
  }
  return fm;
}

const SKILL_NAMES = [
  "deep-research",
  "build-app",
  "generate-image",
  "data-analysis",
  "write-report",
];

describe("Skills content validation", () => {
  for (const name of SKILL_NAMES) {
    describe(name, () => {
      it("should exist as a SKILL.md file", () => {
        expect(() => readSkill(name)).not.toThrow();
      });

      it("should have valid YAML frontmatter with name and description", () => {
        const content = readSkill(name);
        const fm = parseFrontmatter(content);
        expect(fm.name).toBe(name);
        expect(fm.description).toBeDefined();
        expect(fm.description!.length).toBeGreaterThan(0);
      });

      it("should have description under 1024 characters", () => {
        const content = readSkill(name);
        const fm = parseFrontmatter(content);
        expect(fm.description!.length).toBeLessThanOrEqual(1024);
      });

      it("should have content under 10 MB", () => {
        const content = readSkill(name);
        const bytes = new TextEncoder().encode(content).length;
        expect(bytes).toBeLessThan(10 * 1024 * 1024);
      });

      it("should have a body after frontmatter", () => {
        const content = readSkill(name);
        const body = content.replace(/^---\n[\s\S]*?\n---\n*/, "");
        expect(body.trim().length).toBeGreaterThan(100);
      });

      it("should have examples.md with task description templates", () => {
        expect(fileExists(name, "examples.md")).toBe(true);
        const content = readFile(name, "examples.md");
        expect(content.length).toBeGreaterThan(50);
      });

      it("should reference examples.md from SKILL.md", () => {
        const content = readSkill(name);
        expect(content).toContain("examples.md");
      });

      it("should have at least one template file", () => {
        const skill = readSkill(name);
        expect(skill).toContain("templates/");
      });
    });
  }
});

describe("Skill description differentiation", () => {
  it("deep-research and write-report should have clearly different descriptions", () => {
    const drFm = parseFrontmatter(readSkill("deep-research"));
    const wrFm = parseFrontmatter(readSkill("write-report"));
    expect(drFm.description).not.toContain(wrFm.description);
    expect(wrFm.description).not.toContain(drFm.description);
    expect(drFm.description).toBeDefined();
    expect(wrFm.description).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/skills-content.test.ts`
Expected: FAIL — SKILL.md files do not exist yet.

- [ ] **Step 3: Create deep-research SKILL.md**

```markdown
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
```

- [ ] **Step 4: Create deep-research examples.md**

```markdown
# Deep Research — Task Description Examples

These are ready-to-use templates for spawning Research sub-agents. Copy and adapt for your specific sub-questions.

## Single Sub-Question Research

```
Research: {sub-question}

Write outputs to /home/gem/workspace/research/task_{id}/
Create findings.md with your synthesis of what you found.
Create sources.json as an array: [{"title": "...", "url": "...", "relevance": "..."}]
Store any raw extracted content in raw/ subdirectory.

Strategy:
1. Use tavily_search with search_depth "advanced" to find comprehensive results
2. Use tavily_map on any documentation sites to understand their structure
3. Use tavily_extract on the 3-5 most relevant URLs for detailed content
4. Synthesize into findings.md with inline source citations
```

## Comparative Research

```
Research: Compare {option A} vs {option B} on the following dimensions: {dim1}, {dim2}, {dim3}.

Write outputs to /home/gem/workspace/research/task_{id}/
Create findings.md with a comparison table and prose analysis.
Create sources.json with all sources used.

Strategy:
1. Search for each option separately to get unbiased results
2. Search for direct comparisons (e.g., "{A} vs {B}")
3. Extract detailed specs/features from official sources
4. Structure findings as: overview of each, comparison matrix, recommendation
```

## News/Current Events Research

```
Research: What are the latest developments in {topic} from the past {timeframe}?

Write outputs to /home/gem/workspace/research/task_{id}/
Create findings.md with chronological findings.
Create sources.json with all sources, including publication dates.

Strategy:
1. Use tavily_search with topic "news" and appropriate time_range
2. Cross-reference across multiple news sources
3. Distinguish between confirmed facts and speculation
4. Note the dates of all findings for timeline accuracy
```
```

- [ ] **Step 5: Create deep-research templates**

`templates/findings.md`:

```markdown
# Research Findings: {Topic}

## Executive Summary

{2-3 sentence overview of key findings}

## Findings

### {Sub-question 1}

{Detailed findings with inline citations [Source Title](url)}

### {Sub-question 2}

{Detailed findings}

## Cross-References and Contradictions

{Any contradictions between sources or cross-cutting themes}

## Sources

See sources.json for the complete structured source list.
```

`templates/sources.json`:

```json
[
  {
    "title": "Source page title",
    "url": "https://example.com/page",
    "relevance": "Brief note on why this source is relevant"
  }
]
```

- [ ] **Step 6: Run test to verify deep-research passes**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/skills-content.test.ts`
Expected: deep-research tests PASS, other skills still FAIL.

- [ ] **Step 7: Commit**

```bash
git add src/nexus/skills/deep-research/ src/nexus/__tests__/skills-content.test.ts
git commit -m "feat(skills): add deep-research skill with examples and templates"
```

---

### Task 2: Create build-app skill (SKILL.md + examples + templates)

**Files:**
- Create: `apps/agents/src/nexus/skills/build-app/SKILL.md`
- Create: `apps/agents/src/nexus/skills/build-app/examples.md`
- Create: `apps/agents/src/nexus/skills/build-app/templates/build-log.md`

- [ ] **Step 1: Create build-app SKILL.md**

```markdown
---
name: build-app
description: Use when the user asks to build an application, create a website, write a program, make a tool, write a script, or develop software. Triggers on requests to scaffold, implement, or code any kind of software project.
---

# Build App

## Overview

Plan, scaffold, implement, and verify software projects by delegating to the Code sub-agent. Optionally involve Research for API/library discovery and Creative for visual assets.

## When to Use

- User asks to "build", "create", "make", "write", or "develop" software
- Request involves scaffolding a project, implementing features, or writing scripts
- Task requires code execution in the sandbox

## When NOT to Use

- User wants data analysis (use data-analysis)
- User only wants images (use generate-image)
- User wants research without building anything (use deep-research)

## Workflow

### Step 1: Plan the Application

Before spawning any sub-agents, plan the application using `write_todos`:
- What is being built? (type, framework, features)
- What tech stack? (use what the user specifies, or pick sensible defaults)
- Does it need API discovery? (spawn Research first if the user references unfamiliar APIs)
- Does it need visual assets? (plan a Creative step if it's a web app with images)

### Step 2: Research (Only If Needed)

If the user doesn't specify the tech stack or references APIs/libraries you're unsure about:
- Spawn a **research** sub-agent to find API documentation, example code, or library comparisons
- For thorough API discovery, consider loading the **deep-research** skill
- Wait for research results before spawning the Code agent

Skip this step if the task is self-contained with a clear tech stack.

### Step 3: Scaffold and Implement

Spawn a **code** sub-agent with a detailed task description.

Each task description MUST include:
- What to build (specific features, not vague goals)
- Tech stack to use
- Workspace path: `/home/gem/workspace/code/task_{id}/`
- If Research ran first: path to research findings
- Output: working code + `build-log.md` using the template at `templates/build-log.md`
- Instruction to verify the app runs (smoke test) before reporting completion

See `examples.md` for ready-to-use task description templates.

### Step 4: Visual Assets (Only If Needed)

If the application needs visual assets (hero images, icons, illustrations):
- Spawn a **creative** sub-agent referencing the built app for context
- See the **generate-image** skill for prompt guidance on effective image generation

### Step 5: Assemble and Deliver

After all sub-agents complete:
1. Read the Code agent's `build-log.md` to verify success
2. Copy final deliverable to `/home/gem/workspace/shared/`
3. If Creative produced assets, integrate them into the app directory
4. Return a summary with: what was built, how to run it, key features

## Complementary Skills

- **deep-research**: When the user references unfamiliar APIs or asks "build something that uses X", deep-research can provide thorough API documentation first.
- **generate-image**: For web apps needing visual assets, generate-image guides the Creative agent to produce icons, illustrations, and hero images.
- **data-analysis**: If the app involves data processing (dashboards, analytics tools), data-analysis can guide the data pipeline portion.

## Output Format

```
/home/gem/workspace/shared/
├── [project files]    # The complete application
├── build-log.md       # What was built, how to run, dependencies (see templates/build-log.md)
└── assets/            # Visual assets if Creative agent was used (optional)
```
```

- [ ] **Step 2: Create build-app examples.md**

```markdown
# Build App — Task Description Examples

These are ready-to-use templates for spawning sub-agents. Copy and adapt for your specific project.

## Web Application (Code Agent)

```
Build a {framework} application that {description of features}.

Tech stack: {framework} + {language} + {key libraries}
Write to /home/gem/workspace/code/task_{id}/

Requirements:
1. {Feature 1}
2. {Feature 2}
3. {Feature 3}

Create build-log.md documenting:
- What was built and key features
- How to run: exact commands to start the app
- Dependencies installed
- Any known limitations

Verify the app starts successfully before reporting completion.
```

## Script / CLI Tool (Code Agent)

```
Write a {language} script that {what it does}.

Input: {what it reads / accepts}
Output: {what it produces}
Write to /home/gem/workspace/code/task_{id}/

Make the script executable and test it with sample data.
Create build-log.md with usage instructions and examples.
```

## API Discovery (Research Agent — use before Code)

```
Research the {API/library name} API:
- Authentication method and required keys
- Key endpoints/methods for {specific use case}
- Rate limits and pricing
- Code examples in {language}

Write findings to /home/gem/workspace/research/task_{id}/
Create findings.md with API documentation summary and code snippets.
```

## Visual Assets (Creative Agent — use after Code)

```
The app at /home/gem/workspace/code/task_{id}/ needs visual assets:
1. {Image 1 description}
2. {Image 2 description}

Style: {style guidance matching the app's theme}
Write to /home/gem/workspace/creative/task_{id}/
Use descriptive filenames. Document prompts in prompt-log.md.
```
```

- [ ] **Step 3: Create build-app templates/build-log.md**

```markdown
# Build Log: {Project Name}

## What Was Built

{Brief description of the project and its purpose}

## Features

- {Feature 1}
- {Feature 2}
- {Feature 3}

## How to Run

```bash
# Install dependencies
{install command}

# Start the application
{run command}
```

The app will be available at {URL or output location}.

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| {name} | {ver} | {why} |

## Known Limitations

- {Any issues or incomplete features}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/skills-content.test.ts`
Expected: deep-research and build-app tests PASS, others still FAIL.

- [ ] **Step 5: Commit**

```bash
git add src/nexus/skills/build-app/
git commit -m "feat(skills): add build-app skill with examples and templates"
```

---

### Task 3: Create generate-image skill (SKILL.md + examples + templates)

**Files:**
- Create: `apps/agents/src/nexus/skills/generate-image/SKILL.md`
- Create: `apps/agents/src/nexus/skills/generate-image/examples.md`
- Create: `apps/agents/src/nexus/skills/generate-image/templates/prompt-log.md`

- [ ] **Step 1: Create generate-image SKILL.md**

```markdown
---
name: generate-image
description: Use when the user asks to create images, generate illustrations, design graphics, make visual assets, create icons, or produce any kind of image content. Triggers on requests for visual creation, image generation, and graphic design.
---

# Generate Image

## Overview

Guide the Creative sub-agent to generate high-quality images using the generate_image tool (Gemini Imagen). Translate user requests into detailed prompts and deliver organized visual assets.

## When to Use

- User asks to "create", "generate", "design", or "make" images or visual content
- Request involves illustrations, icons, hero images, diagrams, or graphics
- Another skill needs visual assets as part of a larger workflow

## When NOT to Use

- User wants charts or data visualizations (use data-analysis — Code agent generates those with matplotlib)
- User wants to edit or modify existing images (not supported by generate_image)
- User wants text-heavy graphics like presentations (use Code agent with appropriate libraries)

## Workflow

### Step 1: Plan the Visual Assets

Before spawning Creative agents, plan what images to create:
- How many distinct images does the user need?
- What style should they share? (pick sensible defaults: clean, modern, professional)
- What filenames describe the content?

### Step 2: Spawn Creative Sub-Agent

Spawn a **creative** sub-agent for each batch of related images.

Each task description MUST include:
- Exactly what images to generate (subject, purpose, context)
- Style guidance: mood, color palette, composition style
- Workspace path: `/home/gem/workspace/creative/task_{id}/`
- Naming convention: descriptive filenames (e.g., `hero-banner-dark.png`, not `image1.png`)
- Instruction to document prompts in `prompt-log.md` using the template at `templates/prompt-log.md`

See `examples.md` for ready-to-use task description templates with prompt engineering patterns.

### Step 3: Prompt Engineering Guidelines

When crafting task descriptions, help the Creative agent write effective Imagen prompts by including:

- **Subject**: What is in the image (specific, not vague)
- **Style**: Art style (digital illustration, photograph, minimalist, watercolor, etc.)
- **Composition**: Layout, perspective, framing
- **Colors**: Dominant palette, mood (warm, cool, muted, vibrant)
- **Context**: Where will this image be used (hero banner, app icon, blog post)

### Step 4: Deliver

After the Creative agent completes:
1. Read the output directory to verify images were generated
2. Copy to `/home/gem/workspace/shared/` or integrate into an app directory if part of build-app
3. Return a summary listing each image with its filename and brief description

## Complementary Skills

- **build-app**: When building a web app, generate-image can produce hero images, icons, and illustrations. Build-app references this skill for the visual assets step.
- **write-report**: Reports can include generated images as figures or illustrations.

## Output Format

```
/home/gem/workspace/shared/
├── [descriptive-name].png    # Generated images with clear filenames
├── [descriptive-name].png
└── prompt-log.md             # Exact prompts used (see templates/prompt-log.md)
```
```

- [ ] **Step 2: Create generate-image examples.md**

```markdown
# Generate Image — Task Description Examples

These are ready-to-use templates for spawning Creative sub-agents. Copy and adapt.

## Icon Set

```
Generate a set of icons for {project/app name}:
1. {Icon 1} — {brief description}, {style}, {color guidance}
2. {Icon 2} — same style as above, {specific details}
3. {Icon 3} — same style, {specific details}

Style: minimalist line art / flat design / 3D rendered (pick one)
Color palette: {primary color} with {accent color}, {background}
Write to /home/gem/workspace/creative/task_{id}/
Filenames: {name-1}.png, {name-2}.png, {name-3}.png
Document all prompts in prompt-log.md.
```

## Hero Banner / Header Image

```
Generate a hero banner image for {project/website}:
Subject: {what should be depicted}
Style: {digital illustration / photograph / abstract}
Mood: {professional / playful / dramatic / serene}
Colors: {palette description, e.g., "dark background with blue and purple accents"}
Composition: {landscape, centered subject, with space for text overlay on the left}
Dimensions: suitable for a wide banner (16:9 aspect ratio)

Write to /home/gem/workspace/creative/task_{id}/hero-banner.png
Document prompt in prompt-log.md.
```

## Illustration for Content

```
Generate an illustration for a {blog post / report / presentation} about {topic}:
Subject: {what the illustration should show}
Style: {clean digital illustration, consistent with modern tech blog aesthetic}
Colors: {match the content's theme}

Write to /home/gem/workspace/creative/task_{id}/
Use a descriptive filename: {topic-illustration}.png
Document prompt in prompt-log.md.
```
```

- [ ] **Step 3: Create generate-image templates/prompt-log.md**

```markdown
# Image Generation Prompt Log

## {Image Filename}

**Prompt used:**
```
{The exact prompt passed to generate_image}
```

**Settings:** {Any non-default settings}
**Result:** {Brief note on quality — acceptable / regenerated / etc.}

---

## {Next Image Filename}

**Prompt used:**
```
{prompt}
```

**Settings:** {settings}
**Result:** {note}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/skills-content.test.ts`
Expected: deep-research, build-app, and generate-image tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/nexus/skills/generate-image/
git commit -m "feat(skills): add generate-image skill with examples and templates"
```

---

### Task 4: Create data-analysis skill (SKILL.md + examples + templates)

**Files:**
- Create: `apps/agents/src/nexus/skills/data-analysis/SKILL.md`
- Create: `apps/agents/src/nexus/skills/data-analysis/examples.md`
- Create: `apps/agents/src/nexus/skills/data-analysis/templates/analysis-report.md`

- [ ] **Step 1: Create data-analysis SKILL.md**

```markdown
---
name: data-analysis
description: Use when the user asks to analyze data, process a dataset, create visualizations, find patterns, run statistics, explore a CSV or spreadsheet, or perform any kind of data processing and insight extraction.
---

# Data Analysis

## Overview

Guide the orchestrator to analyze data using Python in the sandbox. Optionally gather data from the web first via Research agents, then process with Code agents using pandas/matplotlib/seaborn.

## When to Use

- User asks to "analyze", "process", "visualize", or "explore" data
- Request involves CSV, JSON, spreadsheet, or database data
- User wants charts, statistics, trends, or patterns extracted
- User says "find data about X and analyze it" (combines gathering + analysis)

## When NOT to Use

- User just wants to research a topic without data processing (use deep-research)
- User wants to build a full application (use build-app)
- User wants to create artistic images (use generate-image)

## Workflow

### Step 1: Assess Data Availability

Determine if data needs to be gathered or is already available:

**Data already available:** User uploaded a file or it's already in the sandbox → skip to Step 3.

**Data needs gathering:** User says "find data about X" or references a topic without providing data → proceed to Step 2.

### Step 2: Gather Data (Only If Needed)

Spawn a **research** sub-agent to find relevant datasets or data sources:
- Task description: what data to find, format preferences (CSV, JSON, API)
- Research agent uses tavily_search and tavily_extract to find public datasets or data tables
- For complex multi-source data gathering, consider loading the **deep-research** skill
- Wait for research results before spawning Code agent

See `examples.md` for data gathering task templates.

### Step 3: Analyze with Code Agent

Spawn a **code** sub-agent with a Python-first analysis task.

Each task description MUST include:
- What data to analyze (file path or description)
- What questions to answer / what insights to extract
- If Research gathered data: path to research outputs
- Workspace path: `/home/gem/workspace/code/task_{id}/`
- Python-first instruction: use pandas, matplotlib, seaborn
- Instruction to install libraries as needed (`pip install pandas matplotlib seaborn`)
- Output: `analysis-report.md` using the template at `templates/analysis-report.md` + visualizations when relevant

See `examples.md` for ready-to-use analysis task templates.

### Step 4: Produce Visualizations

The Code agent should generate charts when the data lends itself to visual representation:
- Time series → line charts
- Comparisons → bar charts
- Distributions → histograms
- Correlations → scatter plots
- Proportions → pie/donut charts

Skip visualizations for purely numerical, text, or categorical analysis where charts wouldn't add value.

### Step 5: Deliver

After the Code agent completes:
1. Read `analysis-report.md` to verify quality
2. Copy results and charts to `/home/gem/workspace/shared/`
3. Return a concise summary of key findings (under 500 words) with references to charts

## Complementary Skills

- **deep-research**: For complex data gathering from multiple sources, deep-research provides thorough multi-source research. Data-analysis can consume its findings.
- **write-report**: If the user wants a polished report from the analysis (not just raw findings), write-report can format the analysis results into a structured document.
- **build-app**: If the user wants an interactive dashboard from the data, build-app can create a web app using the analysis results.

## Output Format

```
/home/gem/workspace/shared/
├── analysis-report.md         # Findings and methodology (see templates/analysis-report.md)
├── charts/                    # Generated visualizations (when relevant)
│   ├── {descriptive-name}.png
│   └── {descriptive-name}.png
└── processed-data/            # Cleaned/transformed data (optional)
    └── {cleaned-data}.csv
```
```

- [ ] **Step 2: Create data-analysis examples.md**

```markdown
# Data Analysis — Task Description Examples

These are ready-to-use templates for spawning sub-agents. Copy and adapt.

## Analyze Existing Data (Code Agent)

```
Analyze the data at /home/gem/workspace/{path-to-data}

Questions to answer:
1. {Question 1 — e.g., "What are the monthly revenue trends?"}
2. {Question 2 — e.g., "Which categories show the highest growth?"}
3. {Question 3 — e.g., "Are there seasonal patterns?"}

Write to /home/gem/workspace/code/task_{id}/
Use Python with pandas and matplotlib. Install with: pip install pandas matplotlib seaborn
Generate a visualization for each finding (save as .png in charts/).
Create analysis-report.md summarizing all findings with references to charts.
```

## Gather and Analyze (Research Agent first, then Code Agent)

Research task:
```
Find publicly available data about {topic}. Look for:
- CSV or JSON datasets from government, academic, or reputable sources
- Data tables on web pages that can be extracted
- API endpoints that provide the data

Write to /home/gem/workspace/research/task_{id}/
Save any found datasets as files. Create findings.md listing data sources and their formats.
```

Code task (after research):
```
Analyze the data gathered by the research agent at /home/gem/workspace/research/task_{id}/

{Same pattern as "Analyze Existing Data" above}
Research findings are at /home/gem/workspace/research/task_{id}/findings.md
```

## Statistical Analysis (Code Agent)

```
Perform statistical analysis on the data at /home/gem/workspace/{path}

Analysis required:
- Descriptive statistics (mean, median, std dev, quartiles)
- {Specific test — e.g., "Correlation between columns X and Y"}
- {Specific test — e.g., "Trend analysis with linear regression"}

Write to /home/gem/workspace/code/task_{id}/
Use Python with pandas, scipy, and matplotlib.
Create analysis-report.md with statistical results, p-values where applicable, and interpretations.
Generate charts for visual representation of key findings.
```
```

- [ ] **Step 3: Create data-analysis templates/analysis-report.md**

```markdown
# Analysis Report: {Topic}

## Summary

{2-3 sentence overview of the key findings}

## Data Source

- **File(s):** {path to data}
- **Records:** {row count}
- **Columns:** {key columns used}
- **Time period:** {if applicable}

## Methodology

{Brief description of analysis approach, libraries used, any data cleaning performed}

## Findings

### {Finding 1 Title}

{Description of finding with supporting numbers}

![{Chart description}](charts/{chart-filename}.png)

### {Finding 2 Title}

{Description with numbers}

![{Chart description}](charts/{chart-filename}.png)

## Conclusions

{Key takeaways and actionable insights}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/skills-content.test.ts`
Expected: deep-research, build-app, generate-image, and data-analysis tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/nexus/skills/data-analysis/
git commit -m "feat(skills): add data-analysis skill with examples and templates"
```

---

### Task 5: Create write-report skill (SKILL.md + examples + templates)

**Files:**
- Create: `apps/agents/src/nexus/skills/write-report/SKILL.md`
- Create: `apps/agents/src/nexus/skills/write-report/examples.md`
- Create: `apps/agents/src/nexus/skills/write-report/templates/report.md`

- [ ] **Step 1: Create write-report SKILL.md**

```markdown
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
- Each Research agent writes to `/home/gem/workspace/research/task_{id}/`
- Wait for all research to complete before drafting

See `examples.md` for research task description templates tailored to report writing.

### Step 3: Draft the Report

Spawn a **code** sub-agent to compile the report.

The task description MUST include:
- Report outline (sections and what each should cover)
- Paths to all research findings
- Workspace path: `/home/gem/workspace/code/task_{id}/`
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
3. Copy final report to `/home/gem/workspace/shared/report.md`
4. If the user requested a different format (PDF, HTML), spawn a Code agent to convert using pandoc
5. Return a concise summary of the report contents (under 500 words)

## Complementary Skills

- **deep-research**: For thorough multi-source research phases. When both skills load, deep-research handles decomposition and research, write-report handles structuring and formatting.
- **data-analysis**: If the report involves data-driven sections (statistics, trends, charts), data-analysis can produce the analysis and visualizations that write-report incorporates.
- **generate-image**: For visual elements like diagrams, illustrations, or cover images in the report.

## Output Format

```
/home/gem/workspace/shared/
├── report.md              # The complete formatted report (see templates/report.md)
├── assets/                # Visual elements (optional)
│   ├── {descriptive-name}.png
│   └── {descriptive-name}.png
└── sources.json           # All sources used, structured
```
```

- [ ] **Step 2: Create write-report examples.md**

```markdown
# Write Report — Task Description Examples

These are ready-to-use templates for the multi-agent report pipeline. Copy and adapt.

## Research Phase (Research Agents — one per topic)

```
Research {topic area} for a report on {overall topic}:
Focus areas:
- {Specific aspect 1}
- {Specific aspect 2}
- {Specific aspect 3}

Write to /home/gem/workspace/research/task_{id}/
Create findings.md with detailed findings and inline citations.
Create sources.json as [{"title": "...", "url": "...", "relevance": "..."}]
Prioritize authoritative sources (official docs, peer-reviewed, reputable publications).
```

## Drafting Phase (Code Agent)

```
Write a report on {topic} using the research gathered by the research agents.

Report structure:
1. Executive Summary
2. {Section 1 title} — covers {what}
3. {Section 2 title} — covers {what}
4. {Section 3 title} — covers {what}
5. Conclusions and Recommendations
6. Sources

Research inputs:
- {Topic A}: /home/gem/workspace/research/task_{id1}/findings.md
- {Topic B}: /home/gem/workspace/research/task_{id2}/findings.md
- {Topic C}: /home/gem/workspace/research/task_{id3}/findings.md

Write to /home/gem/workspace/code/task_{id}/
Output: report.md

Instructions:
- Read ALL research findings before writing
- Synthesize across sources — don't just concatenate findings
- Cite sources inline as [Source Title](url)
- Keep tone {professional / conversational / technical} for {audience}
- Target length: {approximate word count}
```

## Visual Assets Phase (Creative Agent — optional)

```
Create visual assets for a report on {topic}:
1. Cover image — {style description}
2. {Diagram/illustration} — {what it shows}

The report is at /home/gem/workspace/code/task_{id}/report.md — read it for context.
Write to /home/gem/workspace/creative/task_{id}/
Use descriptive filenames. Document prompts in prompt-log.md.
```

## Format Conversion (Code Agent — only if requested)

```
Convert the markdown report at /home/gem/workspace/shared/report.md to {PDF/HTML}.

Use pandoc: pip install pandoc (or apt-get install pandoc)
Command: pandoc report.md -o report.{pdf/html} --standalone

If images are referenced, ensure they're in the correct relative paths.
Write output to /home/gem/workspace/shared/
```
```

- [ ] **Step 3: Create write-report templates/report.md**

```markdown
# {Report Title}

> {One-line subtitle or scope description}

## Executive Summary

{3-5 sentences capturing the key findings, conclusions, and recommendations. A reader who only reads this section should understand the main takeaways.}

## {Body Section 1}

{Content with inline citations as [Source Title](url)}

## {Body Section 2}

{Content}

### {Subsection if needed}

{More detailed content}

## {Body Section 3}

{Content}

## Conclusions

{Summary of key findings across all sections}

## Recommendations

{Actionable next steps based on the findings, if applicable}

## Sources

{List of all sources cited, or reference sources.json}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/skills-content.test.ts`
Expected: ALL 5 skills pass + differentiation test passes.

- [ ] **Step 5: Commit**

```bash
git add src/nexus/skills/write-report/
git commit -m "feat(skills): add write-report skill with examples and templates"
```

---

### Task 6: Skills barrel export and seeding module

**Files:**
- Create: `apps/agents/src/nexus/skills/index.ts`
- Test: `apps/agents/src/nexus/__tests__/skills-seeding.test.ts`

- [ ] **Step 1: Write the failing test for skills barrel export**

```typescript
// apps/agents/src/nexus/__tests__/skills-seeding.test.ts
import { describe, it, expect } from "vitest";
import { nexusSkillFiles, SKILL_NAMES } from "../skills/index.js";

describe("Skills barrel export", () => {
  it("should export a FileData map with all skill files", () => {
    // 5 skills × (SKILL.md + examples.md + at least 1 template) = at least 15 files
    expect(Object.keys(nexusSkillFiles).length).toBeGreaterThanOrEqual(15);
  });

  it("should include SKILL.md for each skill", () => {
    for (const name of SKILL_NAMES) {
      const key = `/skills/${name}/SKILL.md`;
      expect(nexusSkillFiles).toHaveProperty(key);
    }
  });

  it("should include examples.md for each skill", () => {
    for (const name of SKILL_NAMES) {
      const key = `/skills/${name}/examples.md`;
      expect(nexusSkillFiles).toHaveProperty(key);
    }
  });

  it("should have FileData shape with content array, created_at, modified_at", () => {
    for (const name of SKILL_NAMES) {
      const key = `/skills/${name}/SKILL.md`;
      const fileData = nexusSkillFiles[key];
      expect(Array.isArray(fileData.content)).toBe(true);
      expect(fileData.content.length).toBeGreaterThan(0);
      expect(fileData.created_at).toBeDefined();
      expect(fileData.modified_at).toBeDefined();
    }
  });

  it("should export SKILL_NAMES constant with all 5 names", () => {
    expect(SKILL_NAMES).toEqual([
      "deep-research",
      "build-app",
      "generate-image",
      "data-analysis",
      "write-report",
    ]);
  });

  it("should have frontmatter in each SKILL.md content", () => {
    for (const name of SKILL_NAMES) {
      const key = `/skills/${name}/SKILL.md`;
      const content = nexusSkillFiles[key].content.join("\n");
      expect(content).toMatch(/^---\n/);
      expect(content).toContain(`name: ${name}`);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/skills-seeding.test.ts`
Expected: FAIL — `../skills/index.js` does not exist.

- [ ] **Step 3: Create skills barrel export**

```typescript
// apps/agents/src/nexus/skills/index.ts
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { resolve, dirname, relative, posix } from "path";
import { fileURLToPath } from "url";
import type { FileData } from "deepagents";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const SKILL_NAMES = [
  "deep-research",
  "build-app",
  "generate-image",
  "data-analysis",
  "write-report",
] as const;

function createFileData(content: string): FileData {
  const now = new Date().toISOString();
  return {
    content: content.split("\n"),
    created_at: now,
    modified_at: now,
  };
}

/**
 * Recursively collect all files in a skill directory and return
 * them as a map of virtual POSIX paths to FileData.
 */
function collectSkillFiles(
  skillName: string,
): Record<string, FileData> {
  const skillDir = resolve(__dirname, skillName);
  const files: Record<string, FileData> = {};

  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const fullPath = resolve(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else {
        const relPath = relative(skillDir, fullPath).split("\\").join("/");
        const virtualPath = `/skills/${skillName}/${relPath}`;
        const content = readFileSync(fullPath, "utf-8");
        files[virtualPath] = createFileData(content);
      }
    }
  }

  if (existsSync(skillDir)) {
    walk(skillDir);
  }
  return files;
}

/**
 * All Nexus skill files as a FileData map keyed by virtual POSIX path.
 * Ready to seed into a StoreBackend or pass via invoke({ files }).
 *
 * Includes SKILL.md, examples.md, and all template files for each skill.
 * Virtual paths match what the orchestrator expects under /skills/.
 */
export const nexusSkillFiles: Record<string, FileData> = Object.assign(
  {},
  ...SKILL_NAMES.map((name) => collectSkillFiles(name)),
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/skills-seeding.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/nexus/skills/index.ts src/nexus/__tests__/skills-seeding.test.ts
git commit -m "feat(skills): add barrel export with recursive FileData collection"
```

---

### Task 7: Wire skills into CompositeBackend and orchestrator

**Files:**
- Modify: `apps/agents/src/nexus/backend/store.ts`
- Modify: `apps/agents/src/nexus/backend/composite.ts`
- Modify: `apps/agents/src/nexus/orchestrator.ts`
- Test: `apps/agents/src/nexus/__tests__/skills-backend.test.ts`

- [ ] **Step 1: Write the failing test for skills backend route**

```typescript
// apps/agents/src/nexus/__tests__/skills-backend.test.ts
import { describe, it, expect, vi } from "vitest";

// Mock deepagents
vi.mock("deepagents", () => ({
  CompositeBackend: class {
    defaultBackend: unknown;
    routes: Record<string, unknown>;
    constructor(defaultBackend: unknown, routes: Record<string, unknown>) {
      this.defaultBackend = defaultBackend;
      this.routes = routes;
    }
  },
  StoreBackend: class {
    config: unknown;
    constructor(config?: unknown) {
      this.config = config;
    }
  },
  BaseSandbox: class {
    constructor() {}
  },
}));

vi.mock("@agent-infra/sandbox", () => ({
  SandboxClient: class {
    constructor() {}
  },
}));

const { createNexusBackend } = await import("../backend/composite.js");
const { AIOSandboxBackend } = await import("../backend/aio-sandbox.js");

describe("Skills backend route", () => {
  it("should include /skills/ route in CompositeBackend", () => {
    const sandbox = new AIOSandboxBackend();
    const backend = createNexusBackend(sandbox) as unknown as {
      routes: Record<string, unknown>;
    };
    expect(backend.routes).toHaveProperty("/skills/");
  });

  it("should include /memories/ route in CompositeBackend", () => {
    const sandbox = new AIOSandboxBackend();
    const backend = createNexusBackend(sandbox) as unknown as {
      routes: Record<string, unknown>;
    };
    expect(backend.routes).toHaveProperty("/memories/");
  });

  it("should have sandbox as default backend", () => {
    const sandbox = new AIOSandboxBackend();
    const backend = createNexusBackend(sandbox) as unknown as {
      defaultBackend: unknown;
    };
    expect(backend.defaultBackend).toBe(sandbox);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/skills-backend.test.ts`
Expected: FAIL — no `/skills/` route exists yet.

- [ ] **Step 3: Add createSkillsStore to store.ts**

Modify `apps/agents/src/nexus/backend/store.ts` — add after the existing `createNexusStore`:

```typescript
/**
 * Creates a StoreBackend for the /skills/ route.
 *
 * Skills are read-only content seeded at startup from SKILL.md files
 * bundled in the repo. Uses a separate ["nexus-skills"] namespace
 * to isolate from memory data.
 */
export function createSkillsStore(): StoreBackend {
  return new StoreBackend({
    namespace: ["nexus-skills"],
  });
}
```

- [ ] **Step 4: Add /skills/ route to composite.ts**

Replace `apps/agents/src/nexus/backend/composite.ts`:

```typescript
import { CompositeBackend } from "deepagents";
import { AIOSandboxBackend } from "./aio-sandbox.js";
import { createNexusStore, createSkillsStore } from "./store.js";

/**
 * Creates the Nexus CompositeBackend:
 *
 * - Default route (/) → AIOSandboxBackend (ephemeral workspace in Docker)
 * - /memories/ route → StoreBackend (SQLite-persisted memory)
 * - /skills/ route → StoreBackend (skill files seeded from repo)
 *
 * The sandbox as default route means the agent gets the `execute` tool
 * auto-provisioned (BaseSandbox implements SandboxBackendProtocolV2).
 */
export function createNexusBackend(
  sandbox: AIOSandboxBackend,
): CompositeBackend {
  return new CompositeBackend(sandbox, {
    "/memories/": createNexusStore(),
    "/skills/": createSkillsStore(),
  });
}
```

- [ ] **Step 5: Seed skills in orchestrator.ts**

Update `apps/agents/src/nexus/orchestrator.ts` — add the `nexusSkillFiles` import and pass `files` in the invoke call:

Add import:
```typescript
import { nexusSkillFiles } from "./skills/index.js";
```

Modify `orchestratorNode` to seed skills via the `files` parameter:

```typescript
export async function orchestratorNode(
  state: NexusState,
): Promise<Partial<NexusState>> {
  const orchestrator = getOrchestrator();

  const selectedModel = state.routerResult?.model;
  const modelWithProvider = selectedModel
    ? `google-genai:${selectedModel}`
    : undefined;

  const result = await orchestrator.invoke(
    {
      messages: state.messages,
      files: nexusSkillFiles,
    },
    {
      context: { model: modelWithProvider },
    },
  );

  return { messages: result.messages };
}
```

- [ ] **Step 6: Run all tests**

Run: `cd apps/agents && npx vitest run`
Expected: ALL tests pass (no regressions).

- [ ] **Step 7: Commit**

```bash
git add src/nexus/backend/store.ts src/nexus/backend/composite.ts src/nexus/orchestrator.ts src/nexus/__tests__/skills-backend.test.ts
git commit -m "feat(skills): wire /skills/ StoreBackend route and seed skills in orchestrator"
```

---

### Task 8: Update orchestrator system prompt for skills awareness

**Files:**
- Modify: `apps/agents/src/nexus/prompts/orchestrator-system.ts`

- [ ] **Step 1: Update the orchestrator system prompt**

Add the following section to the orchestrator system prompt in `apps/agents/src/nexus/prompts/orchestrator-system.ts`, after the existing "## Multi-Agent Coordination" section:

```
## Using Skills

You have access to skills — detailed workflow playbooks loaded on demand. Your skills list shows name and description for each. When a user's request matches a skill:

1. Read the full SKILL.md file to get the orchestration workflow
2. Read examples.md for ready-to-use task description templates
3. Tell sub-agents to use templates/ files for consistent output formatting
4. Follow the skill's workflow — it tells you which sub-agents to spawn, in what order, with what task descriptions

Skills complement each other — load all that match:
- **deep-research**: Multi-source research with question decomposition and parallel Research agents
- **build-app**: Software development with optional Research and Creative steps
- **generate-image**: Image generation with prompt engineering guidance for the Creative agent
- **data-analysis**: Data processing pipelines with Python, optional data gathering via Research
- **write-report**: Full report production combining Research, Code, and Creative agents

For example, "write a report with data analysis" should load both write-report and data-analysis.

Do NOT read skills for simple requests that don't need a structured workflow.
```

- [ ] **Step 2: Run all tests to verify no regressions**

Run: `cd apps/agents && npx vitest run`
Expected: ALL tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/nexus/prompts/orchestrator-system.ts
git commit -m "feat(skills): add skills usage guidance to orchestrator system prompt"
```

---

## Design Decisions

1. **Skills = SKILL.md + examples.md + templates/**: Each skill has three layers — the orchestration workflow (SKILL.md), ready-to-use task description templates (examples.md), and output format templates (templates/). The orchestrator reads SKILL.md first, then references examples.md when writing task descriptions, and tells sub-agents to use template files for consistent output.

2. **Skills complement, not compete**: Each skill has a "Complementary Skills" section explaining how it works with others. Descriptions are crafted to trigger on distinct intents. When multiple skills match (e.g., "write a report on X with charts"), the orchestrator loads all matching skills.

3. **Sub-agent delegation is prescriptive**: Skills tell the orchestrator exactly which agents to spawn, what to put in task descriptions, and what workspace paths to use. The examples.md files provide copy-paste-ready templates.

4. **StoreBackend for skills, seeded via files**: Skills are served via a `/skills/` StoreBackend route. The barrel export recursively collects all files (SKILL.md, examples.md, templates/) and provides them as a `FileData` map seeded on every invocation.

5. **No hard scope limits**: Deep-research decomposes into as many sub-questions as the topic needs. The orchestrator judges scope naturally.

6. **Python-first for data**: Data-analysis instructs the Code agent to use Python (pandas, matplotlib, seaborn) as the default analysis stack.

7. **Markdown as default output**: Write-report produces markdown. Other formats (PDF, HTML) only if the user explicitly asks, via a Code agent conversion step.

8. **No tool reference docs in skills**: Skills focus on orchestration patterns. Tool documentation lives in the sub-agent system prompts (Plans 3-4). This avoids duplication and keeps skills lean.
