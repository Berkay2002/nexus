---
created: 2026-04-13
updated: 2026-04-13
tags: [langgraph, langgraph-sdk, deployment, configuration]
sources: [raw/langchain/langgraph/application-structure.md]
---

# LangGraph Application Structure

A LangGraph application is a directory containing one or more graphs, a [[langgraph-config-file|configuration file]] (`langgraph.json`), a dependency manifest, and an optional `.env` file. This layout is the unit that [[langsmith-studio|LangSmith Deployment]] expects when deploying or serving the application.

## Canonical Directory Layout

```
my-app/
├── src/                    # all project source code
│   ├── utils/              # optional helpers
│   │   ├── tools.ts        # tool definitions
│   │   ├── nodes.ts        # node functions
│   │   └── state.ts        # graph state type
│   └── agent.ts            # graph construction and export
├── package.json            # npm dependency manifest
├── .env                    # local environment variables
└── langgraph.json          # LangGraph configuration file
```

The `src/` layout is a convention, not a requirement — the LangGraph server only cares that the paths listed in `langgraph.json` resolve correctly relative to the project root.

## Required Pieces

| Piece | Purpose |
|---|---|
| `langgraph.json` | Registers graphs, declares env vars, points to dependency file |
| Graph module | TypeScript file that exports a compiled graph or a factory function |
| Dependency file | `package.json` — tells the runtime what to install |
| `.env` (optional) | Local-only env overrides; not used in production deployments |

## Nexus Note

In the Nexus monorepo, `apps/agents/langgraph.json` at the workspace root serves this role. It currently points to the scaffold's `research-agent` graph and will be replaced with the `nexus` graph. The source files live under `apps/agents/src/nexus/`. See `CLAUDE.md` (`langgraph.json` at root registers graphs).

## Dependency Declaration

Two things are needed for dependencies:

1. A `package.json` in the project directory listing npm packages.
2. A `"dependencies"` key in `langgraph.json` pointing at the directory containing that manifest (usually `"."`).

For additional system-level binaries or native libraries, use the `"dockerfile_lines"` key in `langgraph.json` to inject extra `RUN` instructions into the generated Dockerfile.

## Graph Registration

Each graph is registered under a unique name in `langgraph.json`. The path format is:

```
"./path/to/file.js:exportedName"
```

The suffix after `:` is the named export from that module — either a compiled `StateGraph` instance or a zero-argument factory function returning one. Multiple graphs can be registered in a single config file.

## Environment Variables

- **Local / dev:** put vars in `langgraph.json`'s `"env"` key or in `.env`.
- **Production:** configure vars in the deployment environment (LangSmith Deployment UI or CI secrets). Do not rely on `langgraph.json`'s `"env"` block in production — it is primarily for local development convenience.

> **Warning:** Inlining secrets (API keys) directly in the `"env"` block of `langgraph.json` commits them to source control. Prefer `.env` (gitignored) for local secrets and deployment-environment injection for production.

## Related

- [[langgraph-config-file]]
- [[langgraph-local-server]]
- [[langgraph-cli]]
- [[langsmith-studio]]
- [[create-deep-agent]]

## Sources

- `raw/langchain/langgraph/application-structure.md` — directory layout, key concepts, env var handling, dependency declaration
- `CLAUDE.md` — Nexus-specific note on `apps/agents/langgraph.json`
