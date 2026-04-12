---
created: 2026-04-12
updated: 2026-04-12
tags: [deepagents, subagent, orchestration, task-delegation]
sources: [raw/langchain/deepagents/subagents.md]
---

# General-Purpose Subagent

DeepAgents automatically adds a `general-purpose` subagent to every [[create-deep-agent|DeepAgent]], regardless of what custom subagents you define. This is not optional — it is always present.

## What the default GP subagent is

By default, the general-purpose subagent:

- Has **the same system prompt** as the main agent.
- Has access to **all the same tools** as the main agent.
- Uses **the same model** as the main agent (unless overridden).
- **Automatically inherits skills** from the main agent (when skills are configured) — the only subagent that does this.

It is intended for context isolation without specialized behavior: the main agent delegates a complex multi-step task to `general-purpose` and gets a concise summary back, without the intermediate tool calls polluting its context.

## The Nexus gotcha

**Custom subagents do NOT replace the general-purpose subagent — they run alongside it.**

If you define three custom subagents (`research`, `code`, `creative`) and pass them to `createDeepAgent`, you end up with **four** subagents in practice: your three plus the auto-added `general-purpose`. This is a common source of confusion in Nexus because:

1. The GP subagent has no specialization, the same tools as the main agent, and no domain-specific instructions.
2. The main agent may call `general-purpose` for tasks you intended to route to a custom agent, especially if your custom agents' descriptions are not specific enough.
3. The GP subagent inherits skills while your custom subagents do not (unless you explicitly pass `skills` to each).

In the Nexus codebase, the `general-purpose/` agent directory exists specifically to override this default with a custom prompt that defers to the specialized agents.

## Overriding the general-purpose subagent

Include a subagent with `name: "general-purpose"` in your `subagents` list. When present, it **fully replaces** the default — the default is not added. Your spec must define `systemPrompt`, `tools`, and optionally `model`.

```typescript
import { createDeepAgent } from "deepagents";

const agent = await createDeepAgent({
  model: "claude-sonnet-4-6",
  tools: [internetSearch],
  subagents: [
    {
      name: "general-purpose",
      description: "General-purpose agent for tasks that don't require a specialist. Prefer specialized agents when available.",
      systemPrompt: `You are a general-purpose assistant. For research tasks, defer to the research-agent.
For code tasks, defer to the code-agent. Handle only tasks that don't fit a specialized agent.`,
      tools: [internetSearch],
      model: "openai:gpt-4o",  // can use a different model
    },
  ],
});
```

If you omit the `name: "general-purpose"` entry, the default GP subagent is added automatically with the main agent's prompt and tools.

## Skills inheritance

The GP subagent is the only subagent that automatically inherits skills from the main agent. Custom [[subagent-interface|subagents]] do **not** inherit skills — they must have skills explicitly configured via the `skills` field.

When present, skill state is fully isolated: the parent's skills are not visible to the subagent, and the subagent's skills are not propagated back. Each subagent with skills runs its own independent `SkillsMiddleware` instance.

## Ideal use case for the default GP subagent

Context isolation without specialization. The main agent delegates a broad, multi-step task:

```
task(name="general-purpose", task="Research quantum computing trends and summarize key developments in 2024")
```

The GP subagent performs all the searches internally and returns only a summary — the main agent's context stays clean.

## Related

- [[subagents]]
- [[subagent-interface]]
- [[context-quarantine]]
- [[create-deep-agent]]

## Sources

- `raw/langchain/deepagents/subagents.md` — "The general-purpose subagent" section, override example, skills inheritance notes
