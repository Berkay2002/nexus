---
created: 2026-04-13
updated: 2026-04-13
tags: [langgraph, langgraph-sdk, deployment, configuration]
sources: [raw/langchain/langgraph/application-structure.md]
---

# LangGraph Configuration File (`langgraph.json`)

`langgraph.json` is the central configuration file for a [[langgraph-application-structure|LangGraph application]]. It tells the [[langgraph-cli|LangGraph CLI]] and [[langsmith-studio|LangSmith Deployment]] which graphs to expose, where to find dependencies, and which environment variables to inject at runtime.

## Minimal Example

```json
{
  "dependencies": ["."],
  "graphs": {
    "my_agent": "./your_package/your_file.js:agent"
  },
  "env": {
    "OPENAI_API_KEY": "secret-key"
  }
}
```

## Top-Level Fields

### `graphs` (required)

A map of graph name → module path with export suffix.

```
"graphs": {
  "<unique-name>": "<relative-path>:<export-name>"
}
```

- **`<unique-name>`** — the identifier used by the LangGraph API to route requests to this graph.
- **`<relative-path>`** — path to the JS/TS file relative to the config file location. Can point at a compiled `.js` file or a TypeScript source (when using a TS-aware runner).
- **`<export-name>`** — the named export from that module. Must be either a compiled `StateGraph`/`CompiledGraph` instance or a zero-argument factory function that returns one.

Multiple graphs can coexist in one config:

```json
"graphs": {
  "research": "./src/agents/research.js:graph",
  "creative": "./src/agents/creative.js:graph"
}
```

### `dependencies` (required)

An array of local directory paths containing dependency manifests (`package.json`). Typically `["."]` when the manifest is at the project root.

```json
"dependencies": ["."]
```

The runtime installs packages from these manifests before starting the server.

### `env` (optional)

A map of environment variable names to values, used for **local development only**.

```json
"env": {
  "OPENAI_API_KEY": "sk-...",
  "TAVILY_API_KEY": "tvly-..."
}
```

> **Warning:** Values in `"env"` are stored in plaintext in the config file. Do not commit real secrets here — use `.env` (gitignored) or the deployment platform's secret management for production.

For production deployments via LangSmith Deployment, set environment variables through the deployment UI or CI pipeline instead.

### `dockerfile_lines` (optional)

An array of Dockerfile `RUN` instruction strings injected into the generated container image. Use this to install system-level binaries or native libraries that npm cannot provide.

```json
"dockerfile_lines": [
  "RUN apt-get install -y chromium"
]
```

### `node_version` (optional)

Specifies the Node.js major version to use in the deployment container. Defaults to the platform's current LTS if omitted.

```json
"node_version": "20"
```

> **Warning:** Omitting `node_version` means the runtime's default LTS is used, which can change over time. Pin this field for reproducible deployments.

## CLI Default

The [[langgraph-cli|LangGraph CLI]] looks for `langgraph.json` in the current working directory by default. Pass `--config <path>` to override.

## Nexus Note

In Nexus, `apps/agents/langgraph.json` is the active config file. It registers the agent graphs served by the LangGraph Dev Server on `:2024`. The `langgraph.json` in the repo currently points to the scaffold's `research-agent`; it will be updated to register the `nexus` graph from `apps/agents/src/nexus/graph.ts`.

## Related

- [[langgraph-application-structure]]
- [[langgraph-local-server]]
- [[langgraph-cli]]
- [[langsmith-studio]]

## Sources

- `raw/langchain/langgraph/application-structure.md` — field definitions, examples, env var guidance
- `CLAUDE.md` — Nexus-specific note on graph registration in `apps/agents/langgraph.json`
