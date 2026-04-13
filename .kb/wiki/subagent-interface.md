---
created: 2026-04-12
updated: 2026-04-13
tags: [deepagents, subagent, task-delegation, orchestration]
sources: [raw/langchain/deepagents/subagents.md, raw/langchain/deepagents/customize.md]
---

# SubAgent Interface

The two concrete types you pass into [[create-deep-agent]]'s `subagents` parameter: the dict-based `SubAgent` (for most cases) and the `CompiledSubAgent` (for pre-built LangGraph graphs).

## SubAgent (dict-based)

Defined by the `SubAgent` TypeScript type from `deepagents`. Fields:

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | `string` | Yes | Unique identifier. Used by the main agent in `task()` calls, and as `lc_agent_name` in streaming metadata. |
| `description` | `string` | Yes | Action-oriented description. The main agent reads this to decide when to delegate. Be specific. |
| `systemPrompt` | `string` | Yes | Instructions for the subagent. **Does not inherit** from the main agent — must be defined fully. |
| `tools` | `Callable[]` | Yes | Tool list. **Does not inherit** from the main agent — specify exactly what this subagent needs. |
| `model` | `string \| BaseChatModel` | No | Overrides the main agent's model. Accepts `"provider:model-id"` strings (e.g., `"openai:gpt-5"`) or a LangChain model instance. Defaults to main agent's model. |
| `middleware` | `Middleware[]` | No | Additional middleware (logging, rate limiting, etc.). Does not inherit. |
| `interruptOn` | `Record<string, boolean \| InterruptOnConfig>` | No | Human-in-the-loop config per tool. Requires a checkpointer on the main agent. Subagent value overrides the main agent's default. See [[deepagents-human-in-the-loop]]. |
| `skills` | `string[]` | No | Filesystem paths to skill directories (e.g., `["/skills/research/"]`). **Does not inherit** main agent's skills. Only the [[general-purpose-subagent]] auto-inherits skills. When set, the subagent runs its own isolated `SkillsMiddleware` instance — skill state is fully isolated in both directions. |

### Inheritance summary

| Field | Inherits from main agent? |
|---|---|
| `systemPrompt` | No — must define explicitly |
| `tools` | No — must define explicitly |
| `model` | Yes — inherits if omitted |
| `middleware` | No |
| `interruptOn` | Yes — subagent overrides default |
| `skills` | No — only GP subagent inherits |

### Minimal example

```typescript
import { createDeepAgent, type SubAgent } from "deepagents";

const researchSubagent: SubAgent = {
  name: "research-agent",
  description: "Conducts in-depth research on specific topics using web search. Use when you need detailed information that requires multiple searches.",
  systemPrompt: `You are a thorough researcher. Break down questions into searches,
synthesize findings, and return a summary under 500 words with sources.`,
  tools: [internetSearch],
  model: "openai:gpt-5.2",  // optional override
};

const agent = createDeepAgent({
  model: "claude-sonnet-4-6",
  subagents: [researchSubagent],
});
```

## CompiledSubAgent

Used when the subagent is itself a full LangGraph graph (e.g., built with `createAgent` or a custom graph). Fields:

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | `string` | Yes | Unique identifier, used in `task()` calls and streaming metadata. |
| `description` | `string` | Yes | What this subagent does. |
| `runnable` | `Runnable` | Yes | A compiled LangGraph graph (must call `.compile()` first). The graph must expose a `messages` state key. |

### Example

```typescript
import { createDeepAgent, CompiledSubAgent } from "deepagents";
import { createAgent } from "langchain";

const customGraph = createAgent({
  model: yourModel,
  tools: specializedTools,
  prompt: "You are a specialized agent for data analysis...",
});

const customSubagent: CompiledSubAgent = {
  name: "data-analyzer",
  description: "Specialized agent for complex data analysis tasks",
  runnable: customGraph,
};

const agent = createDeepAgent({
  model: "claude-sonnet-4-6",
  subagents: [customSubagent],
});
```

`CompiledSubAgent` gives full control over the subagent's internal graph structure, useful when the subagent itself needs conditional branching, loops, or multi-node orchestration beyond what a single agent loop provides.

## CLI alternative

When using the DeepAgents CLI, subagents can be defined as `AGENTS.md` files on disk. The `name`, `description`, and `model` fields become YAML frontmatter; the markdown body becomes `system_prompt`.

## Related

- [[subagents]]
- [[general-purpose-subagent]]
- [[create-deep-agent]]
- [[context-quarantine]]

## Sources

- `raw/langchain/deepagents/subagents.md` — SubAgent and CompiledSubAgent field tables, code examples, inheritance notes
- `raw/langchain/deepagents/customize.md` — corrected `interruptOn` TypeScript camelCase parameter name (was incorrectly `interrupt_on`)
