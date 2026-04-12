---
created: 2026-04-12
updated: 2026-04-12
tags: [deepagents, skill, workflow, context-engineering, instructions]
sources: [raw/langchain/deepagents/skills.md]
---

# Skills

Skills are reusable, on-demand workflow templates that a DeepAgent loads into [[context-engineering|context]] only when the active task matches. They are distinct from [[memory]] (`AGENTS.md` files), which is always injected at startup. Skills follow the [Agent Skills specification](https://agentskills.io/specification).

## What Skills Are

A skill is a named directory containing at minimum a `SKILL.md` file. Supporting files — scripts, reference docs, template assets — may accompany it, but they must be referenced inside `SKILL.md` so the agent knows they exist and when to use them.

```
skills/
├── deep-research/
│   ├── SKILL.md
│   └── templates/report.md
└── build-app/
    ├── SKILL.md
    └── examples.md
```

## How Skills Are Discovered and Loaded (Progressive Disclosure)

When a [[create-deep-agent|deep agent]] starts, it reads only the **frontmatter** of each `SKILL.md`. On every incoming prompt the agent runs a three-step process:

1. **Match** — checks whether any skill's `description` field covers the task.
2. **Read** — if matched, reads the full `SKILL.md` (and any referenced supporting files) via the [[filesystem-middleware|filesystem]].
3. **Execute** — follows the skill's instructions, accessing templates or scripts as directed.

This "read-on-demand" pattern keeps the system prompt small while making large workflow instructions available when needed.

## Passing Skills to an Agent

Skills are registered via the `skills` array on `createDeepAgent`. Paths are virtual POSIX paths relative to the backend root.

```typescript
const agent = await createDeepAgent({
  backend: new StoreBackend(),
  store,
  skills: ["/skills/"],   // scans this prefix for SKILL.md files
});
```

Skill files themselves are seeded as `FileData` records either via `invoke({ files: skillsFiles })` (StateBackend) or pre-populated into the [[store-backend]] before agent creation.

### Source Precedence

When two sources define a skill with the same `name`, the later entry in the `skills` array wins (last-wins layering).

## Skills for Sub-Agents

Skill state is **fully isolated** between the orchestrator and its sub-agents:

- **General-purpose subagent**: automatically inherits the main agent's `skills` array.
- **Custom subagents**: do NOT inherit parent skills. Each must declare its own `skills` parameter.

```typescript
const researchSubagent = {
  name: "researcher",
  tools: [webSearch],
  skills: ["/skills/research/"],   // only these
};

const agent = await createDeepAgent({
  skills: ["/skills/main/"],       // orchestrator + GP subagent
  subagents: [researchSubagent],
});
```

## Skills vs. Memory

| | Skills | Memory |
|---|---|---|
| **Purpose** | On-demand workflow instructions | Persistent context always available |
| **Loading** | Only when task matches | Always injected at startup |
| **Format** | `SKILL.md` in named directories | `AGENTS.md` files |
| **Layering** | Last source wins | Sources combined |
| **Use when** | Instructions are large or task-specific | Context is universally relevant |

## Skills vs. Tools

- Use a skill when there is substantial context to communicate (large instructions, templates, multi-step workflows).
- Use a skill to bundle a capability with explanatory context that would be too verbose for a tool description.
- Use a tool when the agent has no filesystem access — tool calls work without a backend.

## Nexus Usage

Nexus seeds five orchestrator skills (`deep-research`, `build-app`, `generate-image`, `data-analysis`, `write-report`) via the `/skills/` route of a [[composite-backend]]. The barrel export at `skills/index.ts` collects all skill files as a `FileData` map with virtual POSIX paths (`/skills/{name}/...`) and the orchestrator receives them through `orchestrator.invoke({ files: nexusSkillFiles })`.

Custom sub-agents in Nexus (research, code, creative) do NOT inherit orchestrator skills; they have their own skill lists if needed.

## Related

- [[skill-md-format]]
- [[memory]]
- [[composite-backend]]
- [[store-backend]]
- [[filesystem-middleware]]

## Sources

- `raw/langchain/deepagents/skills.md` — Skills reference: what skills are, discovery pattern, passing to agent, sub-agent isolation, skills vs memory comparison
