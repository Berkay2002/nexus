---
name: strict-tdd-for-agents
description: User wants strict TDD (red-green-refactor) for all apps/agents work
type: feedback
---

Use strict TDD for all `apps/agents/` implementation: write failing test first, run to confirm failure, write minimal implementation, run to confirm pass, then commit.

**Why:** Tools, backends, and sub-agents have clear inputs/outputs — TDD catches design issues early and produces better interfaces.

**How to apply:** All subagent implementer prompts for agents workspace must enforce red-green-refactor cycle. Tests before implementation, always.
