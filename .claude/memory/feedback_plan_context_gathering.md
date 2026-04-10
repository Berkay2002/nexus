---
name: Systematic context gathering for plan writing
description: When writing implementation plans, systematically read all .claude/skills/ and docs/ NEXUS.md files first to determine which are relevant
type: feedback
---

When writing implementation plans from the design spec, always gather context systematically before writing:

1. **Read all skills:** `ls .claude/skills/` then read each `SKILL.md` — summarize what each covers and identify which are relevant to the plan
2. **Read all NEXUS.md indexes:** Read every `docs/*/NEXUS.md` file — these are curated indexes of what docs exist and what's relevant to Nexus
3. **Read relevant deep docs:** Based on the NEXUS.md indexes, read the specific doc files that cover APIs/patterns needed for the plan
4. **Verify actual package APIs:** Check `node_modules/*/dist/*.d.ts` for real type signatures — docs were wrong in Plan 1

**Why:** The user wants plans informed by the full context of available skills and documentation, not just the design spec alone. Skills contain framework patterns (TDD, middleware, StateGraph) and docs contain exact API signatures. Missing these leads to plans with wrong APIs or missed patterns.

**How to apply:** Do this context gathering in parallel (multiple Explore agents) at the start of every plan-writing session. Reference the relevant skills and docs in the plan header so implementers know where to look.
