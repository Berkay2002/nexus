---
created: 2026-04-13
updated: 2026-04-13
tags: [langchain, testing, evals, langsmith, trajectory]
sources: [raw/langchain/langchain/test/agent-evals.md]
---

# Agent Evals

Evaluations ("evals") measure how well an agent performs by assessing its **execution trajectory** — the full sequence of messages and tool calls it produces in response to an input. Unlike [[langchain-integration-testing]] that verifies basic correctness (did it run?), evals score behavior against a reference or rubric, enabling regression catching when you change prompts, tools, or models.

## What an Evaluator Is

An evaluator is a function with the signature:

```typescript
function evaluator({ outputs, referenceOutputs }: {
  outputs: Record<string, any>;
  referenceOutputs: Record<string, any>;
}) {
  // compare messages, return a score
  return { key: "evaluator_score", score: score };
}
```

The `outputs` and `referenceOutputs` values are typically message arrays produced by a LangChain agent.

## The `agentevals` Package

Install the prebuilt evaluators from npm:

```bash
npm install agentevals @langchain/core
```

`agentevals` ships two evaluator factories for trajectory assessment:

| Evaluator | Article | When to use |
|---|---|---|
| `createTrajectoryMatchEvaluator` | [[trajectory-match-evaluator]] | You know the expected tool calls — fast, deterministic, free |
| `createTrajectoryLLMAsJudge` | [[llm-as-judge-evaluator]] | You want qualitative scoring of reasoning without strict expectations |

## Choosing an Approach

**Use trajectory match when:**
- You have a reference trajectory (golden example) to compare against
- The evaluation must be deterministic and cost-free
- You want to enforce specific sequencing rules (e.g., policy lookup before authorization)
- You are running evals in CI where LLM calls are too slow or expensive

**Use LLM-as-judge when:**
- You have no reference trajectory, or it is too rigid to be useful
- You want to assess overall quality, reasoning coherence, or appropriateness of tool selection
- You are iterating on prompts and want a qualitative signal on whether behavior improved

Both approaches can be used together: trajectory match for regression gating, LLM-as-judge for exploratory scoring.

## Running Evals in LangSmith

[[langsmith-studio]] tracks experiments over time. Enable it with:

```bash
export LANGSMITH_API_KEY="your_langsmith_api_key"
export LANGSMITH_TRACING="true"
```

### Vitest/Jest Integration

Use the `langsmith/vitest` (or `langsmith/jest`) wrapper to log results automatically:

```typescript
import * as ls from "langsmith/vitest";
import { createTrajectoryLLMAsJudge, TRAJECTORY_ACCURACY_PROMPT } from "agentevals";

const trajectoryEvaluator = createTrajectoryLLMAsJudge({
  model: "openai:o3-mini",
  prompt: TRAJECTORY_ACCURACY_PROMPT,
});

ls.describe("trajectory accuracy", () => {
  ls.test("accurate trajectory", { inputs, referenceOutputs }, async ({ inputs, referenceOutputs }) => {
    const result = await agent.invoke({ messages: inputs.messages });
    ls.logOutputs({ messages: result.messages });
    await trajectoryEvaluator({ inputs, outputs: result.messages, referenceOutputs });
  });
});
```

Run with: `vitest run test_trajectory.eval.ts`

### `evaluate` Function

For dataset-backed evaluation, use `evaluate` from `langsmith/evaluation`:

```typescript
import { evaluate } from "langsmith/evaluation";

await evaluate(
  async (inputs) => (await agent.invoke(inputs)).messages,
  {
    data: "your_dataset_name",
    evaluators: [trajectoryEvaluator],
  }
);
```

The dataset schema requires:
- **input**: `{ "messages": [...] }` — messages to invoke the agent with
- **output**: `{ "messages": [...] }` — expected message history (can contain only assistant messages for trajectory eval)

## Related

- [[trajectory-match-evaluator]]
- [[llm-as-judge-evaluator]]
- [[langsmith-studio]]
- [[langchain-integration-testing]]
- [[langchain-tools]]

## Sources

- `raw/langchain/langchain/test/agent-evals.md` — full source including code examples and LangSmith integration patterns
