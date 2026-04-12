---
created: 2026-04-12
updated: 2026-04-12
tags: [deepagents, backends, filesystem]
sources: [raw/langchain/deepagents/backends.md]
---

# LocalShellBackend

`LocalShellBackend` extends [[filesystem-backend|FilesystemBackend]] with the `execute` tool, giving a [[deep-agents-overview|DeepAgent]] unrestricted shell command execution directly on the host machine. It is the most powerful and most dangerous backend — suitable only for local development environments where the developer fully trusts the agent.

## Usage

```typescript
import { createDeepAgent, LocalShellBackend } from "deepagents";

const backend = new LocalShellBackend({ workingDirectory: "." });
const agent = createDeepAgent({ backend });
```

## How it works

- Extends `FilesystemBackend` with an `execute` tool that runs shell commands via `subprocess.run(shell=True)` with no sandboxing.
- Commands run directly on the host machine with the current user's permissions.
- `workingDirectory` (or `rootDir`) is used as the working directory for shell commands, but commands can access any path on the system — `virtual_mode` provides no restriction when shell access is enabled.
- Supports `timeout` (default 120 s), `maxOutputBytes` (default 100,000), `env`, and `inheritEnv` for environment variable control.

## Security

This backend has the same risks as [[filesystem-backend|FilesystemBackend]] **plus** arbitrary code execution:

- Agent can run any shell command with your user's permissions
- File modifications and command execution are permanent and irreversible
- Commands can consume unlimited CPU, memory, and disk
- Secrets are trivially readable

**Never use in production, web servers, or multi-tenant environments.** For production shell execution, use a sandbox backend instead (see [[deepagents-sandboxes]]).

**Recommended safeguards for local dev:**
1. Enable Human-in-the-Loop middleware to review and approve operations before execution.
2. Run in a dedicated development environment only.

## Best for

- Local coding assistants
- Quick iteration during development when you fully trust the agent
- Scenarios where a sandbox is too heavyweight

## Related

- [[backends]]
- [[filesystem-backend]]
- [[deepagents-sandboxes]]
- [[composite-backend]]

## Sources

- `raw/langchain/deepagents/backends.md` — LocalShellBackend section
