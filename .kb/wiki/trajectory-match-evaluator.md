---
created: 2026-04-13
updated: 2026-04-13
tags: [langchain, testing, evals, trajectory]
sources: [raw/langchain/langchain/test/agent-evals.md]
---

# Trajectory Match Evaluator

`createTrajectoryMatchEvaluator` from the [[agent-evals|agentevals]] package performs deterministic comparison of an agent's actual message trajectory against a reference trajectory. It is fast, cost-free, and requires no LLM call — making it suitable for CI regression gating.

## The Four Modes

> **Warning — mode selection is subtle.** The names sound symmetric but they are not. Read each carefully before choosing.

| Mode | What must match | Extra calls | Fewer calls |
|---|---|---|---|
| `strict` | Same tools in **same order** | Fails | Fails |
| `unordered` | Same tools in **any order** | Fails | Fails |
| `subset` | Agent calls only tools from reference | N/A — no extras allowed | Pass |
| `superset` | Agent calls **at least** reference tools | Pass | Fails |

### strict

Requires identical message structure and tool call sequence. Message *content* can differ; tool call *order* cannot.

```typescript
import { createTrajectoryMatchEvaluator } from "agentevals";

const evaluator = createTrajectoryMatchEvaluator({
  trajectoryMatchMode: "strict",
});
```

**Use when:** You must enforce a specific operational sequence, e.g., policy lookup must precede an authorization action.

**Gotcha:** `strict` does not care about argument values by default — only that the same tools were called in the same positions. To also match arguments, configure `toolArgsMatchMode`.

### unordered

Same tool calls as the reference, but any ordering is accepted.

```typescript
const evaluator = createTrajectoryMatchEvaluator({
  trajectoryMatchMode: "unordered",
});
```

**Use when:** Verifying that a set of information sources was consulted, but the order is non-deterministic or irrelevant (e.g., parallel tool calls that the model may reorder).

**Gotcha:** `unordered` still requires the *exact same set* of tool calls. If the agent calls one extra tool or skips one, the score is `false`. Use `superset` or `subset` if you want partial matching.

### subset

The agent's tool calls must be a subset of the reference — it may call *fewer* tools but no extras.

```typescript
const evaluator = createTrajectoryMatchEvaluator({
  trajectoryMatchMode: "subset",
});
```

**Use when:** Ensuring the agent stays within its expected scope — it should not call tools that are not in the reference plan. Useful for cost control or compliance checks.

**Gotcha:** `subset` passes when the agent calls *nothing at all*, since the empty set is a subset of any set. If you need at least one tool call, combine with an additional assertion.

### superset

The agent's tool calls must be a superset of the reference — it must call at least the reference tools but may call additional ones.

```typescript
const evaluator = createTrajectoryMatchEvaluator({
  trajectoryMatchMode: "superset",
});
```

**Use when:** Verifying minimum required actions were taken. The agent may do extra research or validation steps, which is fine.

**Gotcha:** `superset` will pass even if the agent calls the reference tools in a completely different order and adds many others. If order matters, use `strict` and extend your reference trajectory instead.

## Basic Usage

```typescript
import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { createTrajectoryMatchEvaluator } from "agentevals";

const evaluator = createTrajectoryMatchEvaluator({
  trajectoryMatchMode: "strict", // or "unordered" | "subset" | "superset"
});

const result = await agent.invoke({
  messages: [new HumanMessage("What's the weather in San Francisco?")]
});

const referenceTrajectory = [
  new HumanMessage("What's the weather in San Francisco?"),
  new AIMessage({
    content: "",
    tool_calls: [{ id: "call_1", name: "get_weather", args: { city: "San Francisco" } }]
  }),
  new ToolMessage({ content: "It's 75 degrees and sunny.", tool_call_id: "call_1" }),
  new AIMessage("The weather in San Francisco is 75 degrees and sunny."),
];

const evaluation = await evaluator({
  outputs: result.messages,
  referenceOutputs: referenceTrajectory,
});
// evaluation.score === true | false
```

## Customizing Tool Argument Matching

By default, two tool calls are considered equal only if they call the same tool with the same arguments. This can be adjusted with `toolArgsMatchMode` and `toolArgsMatchOverrides`:

```typescript
const evaluator = createTrajectoryMatchEvaluator({
  trajectoryMatchMode: "strict",
  toolArgsMatchMode: "ignore",          // ignore args entirely — only match tool name
  // toolArgsMatchOverrides: { get_weather: "subset" }  // per-tool overrides
});
```

See the [agentevals repository](https://github.com/langchain-ai/agentevals?tab=readme-ov-file#tool-args-match-modes) for the full list of `toolArgsMatchMode` values.

## Mode Selection Quick Guide

```
Need exact sequence?              → strict
Need same tools, any order?       → unordered
Agent must not exceed scope?      → subset
Agent must meet minimum actions?  → superset
```

## Related

- [[agent-evals]]
- [[llm-as-judge-evaluator]]
- [[langchain-messages]]
- [[tool-call]]
- [[langsmith-studio]]

## Sources

- `raw/langchain/langchain/test/agent-evals.md` — mode descriptions, code examples, and `toolArgsMatchMode` note
