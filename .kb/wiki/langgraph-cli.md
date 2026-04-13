---
created: 2026-04-13
updated: 2026-04-13
tags: [langgraph, langgraph-sdk, cli, dev-server]
sources: [raw/langchain/langgraph/local-server.md]
---

# LangGraph CLI (`@langchain/langgraph-cli`)

`@langchain/langgraph-cli` is the TypeScript developer CLI for [[langgraph-local-server|running LangGraph applications locally]]. It provides commands to scaffold new projects, auto-generate [[langgraph-config-file|`langgraph.json`]] for existing projects, and start the local dev server.

## Installation

```shell
npm install --save-dev @langchain/langgraph-cli
```

Install as a dev dependency — the CLI is only needed during development, not at runtime.

## Commands

### `npm create langgraph`

Scaffolds a new LangGraph project from the [`new-langgraph-project-js`](https://github.com/langchain-ai/new-langgraphjs-project) template. The template is a minimal single-node graph you can extend with your own logic. It includes a `.env.example` and a pre-configured `langgraph.json`.

```shell
npm create langgraph
```

### `npm create langgraph config`

Auto-generates a `langgraph.json` configuration file for an existing project. Scans the project for LangGraph agent patterns (`createAgent()`, `StateGraph.compile()`, `workflow.compile()`) and writes a config with all detected exported agents.

```shell
npm create langgraph config
```

Example generated output:

```json
{
  "node_version": "24",
  "graphs": {
    "agent": "./src/agent.ts:agent",
    "searchAgent": "./src/search.ts:searchAgent"
  },
  "env": ".env"
}
```

> **Warning:** Only **exported** agents are included. If an agent is missing from the output, add the `export` keyword to its declaration. The command emits a warning for any agent it found but could not include.

### `npx @langchain/langgraph-cli dev`

Starts the [[langgraph-local-server|LangGraph API server]] in in-memory mode on `http://127.0.0.1:2024`.

```shell
npx @langchain/langgraph-cli dev
```

**Flags:**

| Flag | Description |
|------|-------------|
| `--tunnel` | Creates a secure tunnel to localhost — required for Safari, which blocks connections to localhost servers |

> **Default port is 2024.** The `--port` flag is not documented in the current source; assume 2024 unless the LangGraph team adds it. Changing the port requires updating both the server config and any SDK clients that hardcode `http://localhost:2024`.

## Relationship to `langgraph.json`

The `dev` command reads [[langgraph-config-file|`langgraph.json`]] at startup to know which graphs to register, which `.env` file to load, and which Node.js version to target. The `config` subcommand is the fastest way to produce that file for an existing project.

## Nexus Usage

Nexus does not invoke the CLI directly via `npx @langchain/langgraph-cli dev`. Instead, Turborepo runs `turbo dev --filter=agents` which delegates to the `agents` workspace's own dev script, which in turn starts the server. The CLI is listed as a dev dependency in `apps/agents/package.json`. See `CLAUDE.md` for the full `npm run dev` wiring.

## Related

- [[langgraph-local-server]]
- [[langgraph-config-file]]
- [[langgraph-application-structure]]
- [[langsmith-studio]]

## Sources

- `raw/langchain/langgraph/local-server.md` — install command, scaffold commands, `dev` command, `--tunnel` flag, config auto-generation behavior
