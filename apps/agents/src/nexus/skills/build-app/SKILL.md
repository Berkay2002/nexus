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
- Workspace path: `{workspaceRoot}/code/task_{id}/`
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
2. Copy final deliverable to `{workspaceRoot}/shared/`
3. If Creative produced assets, integrate them into the app directory
4. Return a summary with: what was built, how to run it, key features

## Complementary Skills

- **deep-research**: When the user references unfamiliar APIs or asks "build something that uses X", deep-research can provide thorough API documentation first.
- **generate-image**: For web apps needing visual assets, generate-image guides the Creative agent to produce icons, illustrations, and hero images.
- **data-analysis**: If the app involves data processing (dashboards, analytics tools), data-analysis can guide the data pipeline portion.

## Output Format

```
{workspaceRoot}/shared/
├── [project files]    # The complete application
├── build-log.md       # What was built, how to run, dependencies (see templates/build-log.md)
└── assets/            # Visual assets if Creative agent was used (optional)
```
