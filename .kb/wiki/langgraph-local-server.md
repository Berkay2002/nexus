---
created: 2026-04-13
updated: 2026-04-13
tags: [langgraph, langgraph-sdk, dev-server, langsmith]
sources: [raw/langchain/langgraph/local-server.md]
---

# LangGraph Local Server

The LangGraph dev server runs your [[langgraph-application-structure|LangGraph application]] locally on port **2024** as an in-memory HTTP API. It is the local equivalent of a LangSmith cloud deployment and is the standard way to develop, test, and connect [[langsmith-studio]] during development.

> **Warning — in-memory only:** `langgraph dev` does not persist state across restarts. For production or persistent-storage needs, deploy via LangSmith Deployment.

## Starting the Server

```shell
npx @langchain/langgraph-cli dev
```

Sample startup output:

```
- API:       http://127.0.0.1:2024
- Studio UI: https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024
- API Docs:  http://127.0.0.1:2024/docs
```

## Required Environment Variables

A `LANGSMITH_API_KEY` is required before the server will start. Copy `.env.example` to `.env` and fill in the key:

```bash
LANGSMITH_API_KEY=lsv2...
```

> **Warning:** Forgetting `LANGSMITH_API_KEY` is a common reason the server refuses to start. Obtain a free key at https://smith.langchain.com/settings.

## Connecting to the Server

### LangGraph JS SDK

```js
import { Client } from "@langchain/langgraph-sdk";

const client = new Client({ apiUrl: "http://localhost:2024" });
```

Only set `apiUrl` explicitly if you changed the default port.

### REST API

```bash
curl -s --request POST \
    --url "http://localhost:2024/runs/stream" \
    --header 'Content-Type: application/json' \
    --data '{
        "assistant_id": "agent",
        "input": { "messages": [{ "role": "human", "content": "Hello" }] },
        "stream_mode": "messages-tuple"
    }'
```

## Connecting LangSmith Studio

Studio connects to your local server via `baseUrl` query param:

```
https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024
```

For a custom host or port, update the `baseUrl` accordingly:

```
https://smith.langchain.com/studio/?baseUrl=http://myhost:3000
```

> **Safari compatibility:** Safari blocks connections to localhost servers. Use the `--tunnel` flag to work around this:
>
> ```shell
> npx @langchain/langgraph-cli dev --tunnel
> ```

## Nexus Project Usage

In Nexus, the LangGraph dev server is started automatically by `npm run dev` from the monorepo root. Turborepo dispatches `turbo dev --filter=agents`, which starts the server at **http://127.0.0.1:2024**. The Next.js frontend (`apps/web`) connects to it via `@langchain/langgraph-sdk`. See the project `CLAUDE.md` for full three-process architecture details.

> **Port:** Nexus always uses the default port 2024. Do not change this unless you update both the LangGraph server config and the SDK client in `src/providers/client.ts`.

## Related

- [[langgraph-cli]]
- [[langgraph-application-structure]]
- [[langgraph-config-file]]
- [[langsmith-studio]]
- [[use-stream-hook]]

## Sources

- `raw/langchain/langgraph/local-server.md` — server startup, port, env vars, Studio connection, SDK and REST usage
- `CLAUDE.md` (Nexus project) — three-process architecture, port 2024, `npm run dev` wiring
