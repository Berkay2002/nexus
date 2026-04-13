---
created: 2026-04-13
updated: 2026-04-13
tags: [langchain, testing, evals, langsmith, trajectory]
sources: [raw/langchain/langchain/test/agent-evals.md]
---

# LLM-as-Judge Evaluator

`createTrajectoryLLMAsJudge` from the [[agent-evals|agentevals]] package uses an LLM to qualitatively evaluate an agent's execution trajectory. Unlike the [[trajectory-match-evaluator]], it does not require a reference trajectory and can assess reasoning quality, appropriateness of tool selection, and coherence — things that deterministic comparison cannot capture.

## When to Use

- No golden reference trajectory exists yet
- The reference trajectory is too rigid (e.g., acceptable tool orderings vary widely)
- You are iterating on system prompts and want a qualitative signal
- You want to evaluate the *reasoning* behind tool choices, not just which tools were called

**Trade-off:** LLM-as-judge is non-deterministic, adds latency, and incurs LLM API cost. Use [[trajectory-match-evaluator]] when you need deterministic, cost-free checks.

## Basic Usage — Without Reference

```typescript
import { createTrajectoryLLMAsJudge, TRAJECTORY_ACCURACY_PROMPT } from "agentevals";

const evaluator = createTrajectoryLLMAsJudge({
  model: "openai:o3-mini",
  prompt: TRAJECTORY_ACCURACY_PROMPT,
});

const result = await agent.invoke({
  messages: [new HumanMessage("What's the weather in Seattle?")]
});

const evaluation = await evaluator({
  outputs: result.messages,
});
// evaluation.score === true | false
```

`TRAJECTORY_ACCURACY_PROMPT` is a prebuilt prompt that instructs the judge LLM to assess whether the agent's trajectory is accurate and efficient given the user's request.

## Usage — With Reference Trajectory

When you have a reference trajectory, use `TRAJECTORY_ACCURACY_PROMPT_WITH_REFERENCE` so the judge LLM can compare against it:

```typescript
import {
  createTrajectoryLLMAsJudge,
  TRAJECTORY_ACCURACY_PROMPT_WITH_REFERENCE
} from "agentevals";

const evaluator = createTrajectoryLLMAsJudge({
  model: "openai:o3-mini",
  prompt: TRAJECTORY_ACCURACY_PROMPT_WITH_REFERENCE,
});

const evaluation = await evaluator({
  outputs: result.messages,
  referenceOutputs: referenceTrajectory,
});
```

Using a reference makes the judge more grounded — it can identify when the agent took a significantly different (possibly worse) path even if the final answer looks correct.

## Evaluator Signature

The returned evaluator accepts:

```typescript
{
  inputs?: Record<string, any>;      // optional — original agent inputs
  outputs: Record<string, any>;      // required — agent's actual messages
  referenceOutputs?: Record<string, any>; // optional — golden trajectory
}
```

Returns `{ key: string, score: boolean }`. The score is `true` if the judge deems the trajectory acceptable, `false` otherwise.

## Running in LangSmith

Plug `createTrajectoryLLMAsJudge` directly into LangSmith's `evaluate` function or the Vitest/Jest integration — the evaluator signature is compatible with both. See [[agent-evals]] for the full LangSmith integration patterns.

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

## Gotchas

> **Non-determinism:** The same trajectory can receive different scores across runs depending on the judge model and its sampling temperature. Do not use LLM-as-judge as a hard pass/fail gate in CI — use it for exploratory scoring or trend analysis across many runs in LangSmith.

> **Prompt matters:** The `TRAJECTORY_ACCURACY_PROMPT` is a reasonable default but may not match your domain. For specialized agents (e.g., code generation, medical triage), provide a custom prompt that articulates what "good" looks like for your use case.

> **Model choice:** The judge model should be capable enough to reason about tool call appropriateness. Cheap/fast models may produce unreliable scores. The examples use `openai:o3-mini` but any reasoning-capable model accessible via the `model: "provider:model-id"` string works.

## Related

- [[agent-evals]]
- [[trajectory-match-evaluator]]
- [[langsmith-studio]]
- [[langchain-messages]]
- [[tool-call]]

## Sources

- `raw/langchain/langchain/test/agent-evals.md` — `createTrajectoryLLMAsJudge` API, prebuilt prompts, reference/no-reference patterns
