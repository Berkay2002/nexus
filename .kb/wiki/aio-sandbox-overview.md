---
created: 2026-04-12
updated: 2026-04-12
tags: [aio-sandbox, sandbox, execution, agent-infrastructure, docker]
sources: [raw/aio-sandbox/README.md]
---

# AIO Sandbox Overview

AIO Sandbox is an all-in-one agent execution environment that packages browser automation, shell terminal, file operations, VSCode Server, Jupyter Notebook, and MCP tool servers into a single Docker container. Nexus runs it at `:8080` as the shared execution environment for all its sub-agents.

## Content

### The Single-Container Philosophy

Traditional sandboxes are single-purpose — a browser sandbox, a code execution sandbox, or a shell sandbox. Coordinating across them requires complex file-passing plumbing and makes sharing state between tasks difficult. AIO Sandbox solves this by co-locating every surface in one container with a **unified filesystem**: a file downloaded in the browser is immediately accessible in a shell command or Jupyter cell without any copying.

### What It Provides

| Surface | Access Method |
|---------|--------------|
| Browser automation | VNC (visual), CDP (programmatic), MCP tools |
| Shell / terminal | HTTP API `/v1/shell/exec`, WebSocket terminal, MCP `shell` server |
| File operations | HTTP API `/v1/file/read` + `/v1/file/write`, MCP `file` server |
| VSCode Server | Web IDE at `http://localhost:8080/code-server/` |
| Jupyter Notebook | HTTP API `/v1/jupyter/execute`, interactive Python kernel |
| MCP Hub | Pre-configured MCP servers at `http://localhost:8080/mcp` |

### Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser + VNC                            │
├─────────────────────────────────────────────────────────────┤
│  VSCode Server  │  Shell Terminal  │  File Ops             │
├─────────────────────────────────────────────────────────────┤
│              MCP Hub + Sandbox Fusion                       │
├─────────────────────────────────────────────────────────────┤
│         Preview Proxy + Service Monitoring                  │
└─────────────────────────────────────────────────────────────┘
```

The MCP Hub layer is the integration point for agent frameworks — it exposes browser, file, shell, and document-conversion tools over the Model Context Protocol so any MCP-compatible agent can use them without custom HTTP wiring.

### Filesystem and Workspace Convention

The sandbox runs as the `gem` user. The home directory is `/home/gem/`. For Nexus, the active workspace lives at `/home/gem/workspace/`, with per-agent subdirectories:

```
/home/gem/workspace/research/task_{id}/
/home/gem/workspace/code/task_{id}/
/home/gem/workspace/creative/task_{id}/
/home/gem/workspace/orchestrator/
/home/gem/workspace/shared/     ← final deliverables
```

Any agent can read from any path — the orchestrator passes workspace paths explicitly in task descriptions so sub-agents know where to look.

### Agent Connection Model

Agents connect via HTTP to `http://localhost:8080` (or the Docker host address). Both the [[agent-infra-sandbox-sdk|TypeScript SDK]] (`@agent-infra/sandbox`) and the Python package (`agent-sandbox`) provide typed clients over this HTTP API. Nexus uses the TypeScript SDK via its [[composite-backend]] to route AIOSandboxBackend as the default execution path.

### Key Properties

- **Zero configuration** — pre-configured MCP servers and dev tools start with the container.
- **Secure execution** — sandboxed Python and Node.js runtimes with safety guarantees.
- **Port forwarding** — smart preview proxy exposes web applications running inside the container.
- **Agent-ready** — MCP-compatible API surface designed for AI agent integration, not just human use.

## Related

- [[aio-sandbox-docker]]
- [[aio-sandbox-features]]
- [[agent-infra-sandbox-sdk]]
- [[composite-backend]]
- [[aio-sandbox-deepagents-integration]]

## Sources

- `raw/aio-sandbox/README.md` — architecture overview, feature list, workspace layout, container philosophy
