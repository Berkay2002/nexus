---
created: 2026-04-12
updated: 2026-04-12
tags: [deepagents, backends, filesystem]
sources: [raw/langchain/deepagents/backends.md]
---

# FilesystemBackend

`FilesystemBackend` reads and writes real files on the host machine under a configurable root directory. It gives a [[deep-agents-overview|DeepAgent]] direct access to local disk and is best suited for local development tools, CI/CD pipelines, and mounted persistent volumes.

## Usage

```typescript
import { createDeepAgent, FilesystemBackend } from "deepagents";

const agent = createDeepAgent({
  backend: new FilesystemBackend({ rootDir: ".", virtualMode: true }),
});
```

## Key options

- **`rootDir`** — absolute path to the directory the agent can access (required).
- **`virtualMode`** — when `true`, enforces path restrictions: blocks `..`, `~`, and absolute paths escaping `rootDir`. Always enable for untrusted input. Default is `false` (no path restriction even with `rootDir` set).

## Security

This backend grants direct filesystem read/write access. The agent can read any accessible file including secrets and `.env` files. File modifications are permanent. Combined with network tools, credentials can be exfiltrated via SSRF.

**Recommended safeguards:**
1. Always set `virtualMode: true` with `rootDir`.
2. Enable Human-in-the-Loop middleware for sensitive operations.
3. Exclude secrets from accessible paths.
4. Use a sandbox backend (see [[deepagents-sandboxes]]) in production.

**Do not use** in web servers, HTTP APIs, or multi-tenant environments.

## Related

- [[backends]]
- [[local-shell-backend]]
- [[composite-backend]]
- [[deepagents-sandboxes]]

## Sources

- `raw/langchain/deepagents/backends.md` — FilesystemBackend section
