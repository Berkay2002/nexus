---
created: 2026-04-12
updated: 2026-04-12
tags: [aio-sandbox, deepagents, sandbox, python, integration-example]
sources: [raw/aio-sandbox/deepagents-example/README.md]
---

# AIO Sandbox — DeepAgents Integration

A reference example (`aio-deepagents`) showing how to plug [[aio-sandbox-overview|AIO Sandbox]] into [[deepagents-sandboxes|DeepAgents]] as a native sandbox backend by implementing the [[base-sandbox-protocol|`BaseSandbox` protocol]]. The example is in Python; Nexus does the TypeScript equivalent using the same three-method contract.

## The BaseSandbox Protocol

DeepAgents requires a sandbox backend to implement exactly three methods:

| Method | AIO Sandbox call |
|---|---|
| `execute(cmd)` | `client.bash.exec()` |
| `upload_files(...)` | `client.file.write_file()` |
| `download_files(...)` | `client.file.read_file()` |

All three delegate to the `agent-sandbox` SDK, which issues HTTP requests to the [[aio-sandbox-docker|AIO Sandbox container]] running at `http://localhost:8080`.

## Project Layout

```
aio-deepagents/
├── main.py              # creates the DeepAgent and calls astream()
├── sandbox_backend.py   # AIOSandboxBackend — all three BaseSandbox methods
├── pyproject.toml       # Python deps (deepagents, agent-sandbox, langgraph)
└── .env.example         # OPENAI_API_KEY, OPENAI_MODEL_ID, OPENAI_BASEURL, SANDBOX_URL
```

`sandbox_backend.py` is the only integration surface — everything else is standard DeepAgents boilerplate.

## Architecture Diagram

```
DeepAgents Agent
    └── AIOSandboxBackend (sandbox_backend.py)
        ├── execute(cmd)       → client.bash.exec()
        ├── upload_files()     → client.file.write_file()
        └── download_files()   → client.file.read_file()
                └── agent-sandbox SDK → AIO Sandbox HTTP API (:8080)
```

This mirrors how other sandbox integrations are done in the DeepAgents ecosystem (`langchain-daytona`, `langchain-runloop`). The pattern is the same regardless of which sandbox provider you target — only the SDK calls inside each method differ.

## OpenAI-Compatible LLM Setup

The example does not hard-code a provider. It uses the OpenAI client interface pointed at any compatible base URL:

```bash
OPENAI_API_KEY=sk-xxxxx
OPENAI_MODEL_ID=anthropic/claude-sonnet-4   # or any OpenRouter model slug
OPENAI_BASEURL=https://openrouter.ai/api/v1
SANDBOX_URL=http://localhost:8080
```

This lets the same agent binary run against Claude, GPT-4, Gemini, or Z.AI/GLM by changing only environment variables — no code changes.

## Streaming

The agent is invoked via `astream()` (not `ainvoke()`), which emits tokens as they arrive. This is the standard DeepAgents streaming path — the sandbox backend itself is not streaming-aware; streaming is handled at the agent layer.

## Relevance to Nexus

Nexus implements the same `BaseSandbox` interface in TypeScript (`apps/agents/src/nexus/backend/aio-sandbox.ts`). The mapping is identical:

- `execute` → `@agent-infra/sandbox` `client.bash.exec()`
- `upload_files` → `client.file.writeFile()`
- `download_files` → `client.file.readFile()`

The Python example is the canonical reference for what each method is expected to do and what the DeepAgents framework calls them with.

## Related

- [[aio-sandbox-overview]]
- [[aio-sandbox-docker]]
- [[deepagents-sandboxes]]
- [[base-sandbox-protocol]]

## Sources

- `raw/aio-sandbox/deepagents-example/README.md` — full example project README covering architecture, project layout, env config, and quick-start steps
