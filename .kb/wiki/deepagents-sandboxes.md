---
created: 2026-04-12
updated: 2026-04-12
tags: [deepagents, sandbox, backends, execution, isolation]
sources: [raw/langchain/deepagents/sandbox.md]
---

# DeepAgents Sandbox Backends

Sandbox backends are [[backends|DeepAgents backends]] that give the agent both the standard filesystem tools **and** an `execute` tool for running arbitrary shell commands inside an isolated environment. The sandbox creates a boundary between the agent's execution and your host system: local files, credentials, and processes are protected even when the agent runs autonomously.

## What makes a sandbox backend different

Regular backends (State, Filesystem, Store) only expose file operations. A sandbox backend additionally implements the `SandboxBackendProtocol`, which causes the harness to inject the `execute` tool into every model call. On each turn, the harness checks whether the configured backend implements this protocol; if not, `execute` is filtered out and the agent never sees it.

Tools the agent gets with a sandbox backend:

- `ls`, `read_file`, `write_file`, `edit_file`, `glob`, `grep` — standard filesystem tools
- `execute` — runs a shell command; returns combined stdout/stderr, exit code, and a truncation notice if output exceeds the limit (large outputs are saved to a file and the agent is told to use `read_file` incrementally)

## Built-in providers

| Provider | Package | Notes |
|---|---|---|
| Modal | `@langchain/modal` | Supports `blockNetwork: true` to block outbound traffic |
| Daytona | `@langchain/daytona` | Native git operations, `autoDeleteInterval` TTL |
| Deno | `@langchain/deno` | V8 isolate, configurable `memoryMb` and `lifetime` |
| Node VFS | `@langchain/node-vfs` | In-process virtual filesystem, no real isolation |
| LangSmith | built-in | Managed cloud sandbox |

For custom sandboxes (e.g., Nexus's [[aio-sandbox-deepagents-integration|AIOSandboxBackend]]), see [[base-sandbox-protocol]].

## Sandbox lifecycle scoping

### Thread-scoped (default)
Each conversation thread gets its own sandbox. The sandbox is created on the first run and reused for follow-up messages on the same thread. When the thread is cleaned up or the TTL expires, the sandbox is destroyed. Right for most agents — clean state per conversation.

### Assistant-scoped
All threads for a given assistant share one sandbox. The sandbox ID is stored on the assistant's configuration. Files, installed packages, and cloned repos persist across conversations. Use this for agents that maintain a long-running workspace (e.g., a coding assistant with a cloned repo). Requires periodic cleanup or TTL to prevent unbounded disk and memory growth.

### Lifecycle API

```typescript
const sandbox = await ModalSandbox.create(options);
const result = await sandbox.execute("echo hello");
await sandbox.close();
```

## Integration patterns

### Sandbox as tool (recommended)

The agent runs on your server. Shell and file operations are API calls to a remote sandbox. API keys stay outside the sandbox. Sandbox failures don't lose agent state. You can run tasks in multiple sandboxes in parallel. Network latency on each execution call is the trade-off.

### Agent in sandbox

The agent framework runs inside the sandbox container. Mirrors local development. Tighter coupling. Requires infrastructure for host-to-sandbox communication (WebSocket/HTTP). API keys must live inside the sandbox — a security risk.

## File transfer

Two distinct planes of file access:

- **Agent tools** (`read_file`, `write_file`, `execute`): the LLM calls these during task execution. All go through `execute()` inside the sandbox.
- **Transfer APIs** (`uploadFiles()`, `downloadFiles()`): application code calls these to move files across the host/sandbox boundary using the provider's native APIs. Use `uploadFiles()` to seed the sandbox before the agent runs; use `downloadFiles()` to retrieve artifacts afterward.

```typescript
// Seed
await sandbox.uploadFiles([["src/index.js", encoder.encode("...")]]);
// Retrieve
const results = await sandbox.downloadFiles(["output.txt"]);
```

## Security considerations

Sandboxes protect the host system but do **not** protect against context injection. An attacker who controls part of the agent's input can instruct it to run commands inside the sandbox — including reading files and exfiltrating data over HTTP or DNS (if network is not blocked).

**Never put secrets inside a sandbox.** API keys and tokens injected via environment variables or mounted files can be read and exfiltrated by a context-injected agent.

Safe approaches:
1. Define tools that run on the host (outside the sandbox) and handle authentication there. The agent calls the tool by name but never sees credentials.
2. Use a network proxy that intercepts sandbox HTTP requests and injects credentials before forwarding. (Not widely available yet.)

If secrets must be in the sandbox: enable Human-in-the-Loop for all tool calls, block network access, use narrowest credential scope, and monitor outbound traffic. This remains an unsafe workaround.

General best practices:
- Review sandbox outputs before acting on them
- Block network access when not needed (e.g., `blockNetwork: true` on Modal)
- Use [[filesystem-middleware|middleware]] to filter sensitive patterns in tool outputs
- Treat everything produced inside the sandbox as untrusted input

## Related

- [[base-sandbox-protocol]]
- [[backends]]
- [[aio-sandbox-deepagents-integration]]
- [[local-shell-backend]]
- [[filesystem-middleware]]

## Sources

- `raw/langchain/deepagents/sandbox.md` — full sandbox reference: providers, lifecycle, integration patterns, file transfer, security
