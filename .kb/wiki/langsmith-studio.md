---
created: 2026-04-13
updated: 2026-04-13
tags: [langchain, langgraph, debugging, observability, langsmith]
sources: [raw/langchain/langchain/langsmith-studio.md]
---

# LangSmith Studio

LangSmith Studio is a free visual interface for developing and debugging LangChain and LangGraph agents locally. It connects to a locally running agent server and shows each step the agent takes — prompts sent to the model, [[tool-call|tool calls]] and their results, intermediate state, and the final output — without requiring deployment or extra instrumentation code.

## How Studio Works

Studio is hosted at `https://smith.langchain.com/studio/` and connects to your local agent via a `baseUrl` query parameter. Once the [[langgraph-cli]] dev server is running on port 2024, Studio is accessible at:

```
https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024
```

The agent is also available as a REST API at `http://127.0.0.1:2024` simultaneously.

## Setup Steps

### 1. Create a LangSmith Account and API Key

Sign up for free at [smith.langchain.com](https://smith.langchain.com). Retrieve an API key from the Settings page.

### 2. Configure Environment Variables

Create a `.env` file at your project root:

```bash
LANGSMITH_API_KEY=lsv2...
```

> **WARNING:** Never commit `.env` to version control. The source explicitly flags this.

To disable tracing entirely (no data leaves your local server), set:

```bash
LANGSMITH_TRACING=false
```

### 3. Create a `langgraph.json` Config File

The [[langgraph-cli]] requires a `langgraph.json` to locate graphs and manage dependencies:

```json
{
  "dependencies": ["."],
  "graphs": {
    "agent": "./src/agent.ts:agent"
  },
  "env": ".env"
}
```

The `graphs` value is a map of graph name → `<file>:<export>`. The `createAgent` function from `@langchain/agents` returns a compiled LangGraph graph, which satisfies the `graphs` contract.

### 4. Start the Dev Server

```bash
npx @langchain/langgraph-cli dev
```

The dev server supports **hot-reloading** — changes to prompts or tool signatures are reflected in Studio immediately without restarting.

> **WARNING:** Safari blocks `localhost` connections to Studio. Use the `--tunnel` flag when on Safari:
> ```bash
> npx @langchain/langgraph-cli dev --tunnel
> ```

## What Studio Shows

- Full execution trace: prompts, tool arguments, return values, token usage, and latency metrics
- Exceptions with surrounding state captured at the point of failure
- Re-run any conversation thread from any step to test changes without starting over

This workflow applies to both simple single-tool agents and complex multi-node LangGraph graphs.

## LangSmith Tracing

When `LANGSMITH_TRACING` is not set to `false`, Studio automatically traces all runs to LangSmith cloud. Traces are associated with the project identified by your `LANGSMITH_API_KEY`. Tracing adds observability overhead but provides persistent run history accessible from `smith.langchain.com`.

For local-only development with zero data egress, set `LANGSMITH_TRACING=false`. Studio's local execution UI still functions without cloud tracing — it reads directly from the local agent server.

## Nexus Usage Context

In the Nexus project, the LangGraph dev server runs at `:2024` via `turbo dev --filter=agents`. Studio can attach to this server with:

```
https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024
```

This is useful for debugging the orchestrator's DeepAgent step-by-step execution, inspecting tool calls from the [[composite-backend]], and verifying [[subagent-streaming|subagent streaming]] events before wiring them to the [[use-stream-hook]] in the frontend.

## Related

- [[langgraph-cli]] — the CLI that starts the local agent server Studio connects to
- [[use-stream-hook]] — the frontend hook that consumes the same `:2024` LangGraph server
- [[composite-backend]] — backend routing layer visible in Studio execution traces
- [[tool-call]] — individual tool invocations inspectable in the Studio trace view
- [[subagent-streaming]] — subgraph streaming events surfaced through Studio for multi-agent graphs

## Sources

- `raw/langchain/langchain/langsmith-studio.md` — primary source; setup steps, Safari warning, tracing env vars, `langgraph.json` schema
