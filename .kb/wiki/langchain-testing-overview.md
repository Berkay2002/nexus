---
created: 2026-04-13
updated: 2026-04-13
tags: [langchain, testing, vitest]
sources: [raw/langchain/langchain/test/overview.md]
---

# LangChain Testing Overview

LangChain's JavaScript testing documentation covers three distinct layers: unit tests (no API calls), integration tests (real API calls), and evals (trajectory scoring). Each layer answers a different question and is used at a different point in the development cycle.

> **Note:** The source file `raw/langchain/langchain/test/overview.md` is actually the unit-testing page — the filename is misleading. The overview below is synthesized from the three sub-pages in that directory.

## The three layers

| Layer | Speed | Cost | API keys needed | What it catches |
|---|---|---|---|---|
| [[langchain-unit-testing]] | Fast (ms) | Free | No | Logic bugs, tool-call sequencing, error handling |
| [[langchain-integration-testing]] | Slow (seconds) | Incurs API charges | Yes | Credential validity, real model behavior, latency |
| [[agent-evals]] | Variable | API charges | Yes | Trajectory regressions across prompt/model changes |

## When to use each

**Use unit tests** when you want to run tests in CI without API keys, verify that your agent's loop handles tool-call responses correctly, or test error-handling paths (rate limits, policy violations). The [[fake-model]] (`fakeModel` from `langchain`) replaces the real LLM with a scripted fixture — fast, deterministic, free.

**Use integration tests** when you need to confirm that your agent actually works end-to-end with a real model provider. Integration tests make network calls; they are slower, incur costs, and require environment variables with valid API keys. In Vitest, `source .env && export VAR_NAME` is required before running, since Vitest does not auto-load `.env` files.

**Use evals** when you are changing prompts, swapping models, or tuning tool selection and want to detect regressions across a benchmark set. Evals score agent trajectories (the full message + tool-call sequence) against reference outputs or an LLM-as-judge rubric. They are the most expensive layer and are usually run on a schedule or pre-release, not on every commit.

## Decision criteria

```
Is the test environment air-gapped / CI without secrets?
  → unit test with fakeModel

Do you need proof the real API accepts your request?
  → integration test

Are you changing prompts, models, or tools and need a regression score?
  → eval
```

## LangGraph-specific testing

[[langgraph-testing]] covers testing patterns specific to LangGraph graphs (checkpointers, state assertions, interrupt/resume flows). That article is separate from this one because LangGraph tests involve graph state management that goes beyond what `fakeModel` alone handles.

## Related

- [[langchain-unit-testing]]
- [[langchain-integration-testing]]
- [[agent-evals]]
- [[langgraph-testing]]
- [[fake-model]]

## Sources

- `raw/langchain/langchain/test/overview.md` — actual content is the unit-testing page; the filename is a mis-save from the web clipper. Overview synthesized from the three sibling files in the same directory.
