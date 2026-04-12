---
created: 2026-04-12
updated: 2026-04-12
tags: [deepagents, context-engineering, input-context, skill, memory]
sources: [raw/langchain/deepagents/context-engineering.md]
---

# Input Context

Input context is information provided to a deep agent at startup that becomes part of its system message. It is the composition of four sources assembled in a fixed order before the first model call.

## Assembled System Message Order

1. **Custom `systemPrompt`** — your domain-specific instructions (role, behavior, knowledge)
2. **Base agent prompt** — built-in guidance from DeepAgents for planning, filesystem, and delegation
3. **Todo-list prompt** — instructions for the `write_todos` planning tool
4. **Memory prompt** — `AGENTS.md` contents + memory usage guidelines (only when `memory` is configured)
5. **Skills prompt** — skill frontmatter list + usage guidance (only when `skills` is configured)
6. **Virtual filesystem prompt** — docs for `ls`, `read_file`, `write_file`, `edit_file`, `glob`, `grep`, `execute`
7. **Subagent prompt** — `task` tool delegation guidance
8. **User middleware prompts** — any custom middleware appended guidance
9. **Human-in-the-loop prompt** — pause behavior guidance (only when `interrupt_on` is set)

## System Prompt

The `systemPrompt` parameter is static — it does not change per invocation:

```typescript
const agent = await createDeepAgent({
  model: "claude-sonnet-4-6",
  systemPrompt: `You are a research assistant specializing in scientific literature.
  Always cite sources. Use subagents for parallel research on different topics.`,
});
```

When the prompt must vary per request (e.g., injecting user role or runtime preferences), use `dynamicSystemPromptMiddleware` instead. Tools do NOT require middleware to access runtime data — they receive `runtime.context` and `runtime.store` directly. Only add dynamic prompt middleware when the system message itself must vary.

## Memory

[[memory|Memory files]] (`AGENTS.md`) are **always loaded** into the system prompt unconditionally. Use memory for conventions, preferences, and critical guidelines that apply to every conversation:

```typescript
const agent = await createDeepAgent({
  model: "claude-sonnet-4-6",
  memory: ["/project/AGENTS.md", "~/.deepagents/preferences.md"],
});
```

Unlike [[skills]], there is no progressive disclosure for memory — every token in memory files counts against every invocation. Keep memory minimal and delegate detailed workflows to skills.

## Skills

[[skills|Skills]] are on-demand capabilities with **progressive disclosure**. The agent reads only each skill's frontmatter at startup; it loads the full `SKILL.md` content only when it determines the skill is relevant:

```typescript
const agent = await createDeepAgent({
  model: "claude-sonnet-4-6",
  skills: ["/skills/research/", "/skills/web-search/"],
});
```

Keep each skill focused on a single workflow — broad or overlapping skills dilute relevance scoring and bloat context when loaded. Move detailed reference material to separate files referenced from the skill.

## Tool Prompts

Tool prompts shape how the model reasons about when and how to use tools. Two sources:

- **Built-in tools** — DeepAgents middleware automatically appends tool-specific instructions (planning, filesystem, subagents, HITL). No action required.
- **Custom tools** — tools passed via `tools:` expose their Zod schema and description to the model. Include *when* to use the tool in the description and describe each argument's purpose.

```typescript
const searchOrders = tool(
  async ({ userId, status, limit }) => { /* ... */ },
  {
    name: "search_orders",
    description: `Search for user orders by status.
Use this when the user asks about order history or wants to check order status.`,
    schema: z.object({
      userId: z.string().describe("Unique identifier for the user"),
      status: z.enum(["pending", "shipped", "delivered"]).describe("Order status to filter by"),
      limit: z.number().default(10).describe("Maximum number of results to return"),
    }),
  }
);
```

## Related

- [[context-engineering]]
- [[skills]]
- [[memory]]
- [[config-runtime-context]]
- [[context-compression]]

## Sources

- `raw/langchain/deepagents/context-engineering.md` — input context composition, system prompt, memory vs skills distinction, tool prompt patterns
