---
created: 2026-04-12
updated: 2026-04-12
tags: [aio-sandbox, execution, filesystem, agent-infrastructure]
sources: [raw/aio-sandbox/README.md]
---

# AIO Sandbox Features

AIO Sandbox exposes six major tool surfaces — browser automation, shell terminal, file operations, VSCode Server, Jupyter Notebook, and MCP integration — all sharing a single filesystem inside the [[aio-sandbox-overview|container]]. This article is the "what can I do with it" reference.

## Content

### Browser Automation

Three control interfaces at different abstraction levels:

| Interface | How | Best for |
|-----------|-----|----------|
| VNC | `http://localhost:8080/vnc/index.html?autoconnect=true` | Visual/manual interaction, debugging |
| CDP (Chrome DevTools Protocol) | `sandbox.browser.get_info().data.cdp_url` → Playwright/Puppeteer | Programmatic automation, full browser control |
| MCP `browser` tools | `navigate`, `screenshot`, `click`, `type`, `scroll` | Agent tool calls over MCP |

The CDP URL lets any Playwright or Puppeteer client connect to the browser already running in the container — no need to launch a separate browser process.

HTTP API endpoint: `GET /v1/browser/screenshot`

### Shell / Terminal

Execute shell commands synchronously or manage persistent sessions:

| MCP Tool | Description |
|----------|-------------|
| `exec` | Run a command and return output |
| `create_session` | Open a persistent shell session |
| `kill` | Terminate a session |

HTTP API endpoint: `POST /v1/shell/exec`

TypeScript: `sandbox.shell.exec({ command: 'ls -la' })`
Python: `client.shell.exec_command(command="ls -la")` → `result.data.output`

The terminal is also available as a WebSocket-based interactive terminal via the VSCode Server interface.

### File Operations

Read, write, list, search, and replace files inside the container:

| MCP Tool | Description |
|----------|-------------|
| `read` | Read file contents |
| `write` | Write file contents |
| `list` | List directory contents |
| `search` | Search for files or content |
| `replace` | Replace content in a file |

HTTP API endpoints: `GET /v1/file/read`, `POST /v1/file/write`

TypeScript: `sandbox.file.read({ path: '/home/gem/.bashrc' })`
Python: `client.file.read_file(file=f"{home_dir}/.bashrc").data.content`

The home directory is `/home/gem/`. When using the Python SDK, retrieve the actual `home_dir` dynamically via `client.sandbox.get_context().home_dir` rather than hardcoding.

### Jupyter Notebook

Interactive Python kernel with persistent state within a session:

HTTP API endpoint: `POST /v1/jupyter/execute`

TypeScript: implied via `sandbox.jupyter` namespace
Python: `client.jupyter.execute_code(code="...")` → returns outputs including `text`, `images`, etc.

Node.js code execution is also available: `client.nodejs.execute_nodejs_code(code="...")`. Both execution environments run sandboxed with safety guarantees.

The Jupyter interface is particularly useful for data analysis, HTML-to-Markdown conversion, and any multi-step computation that benefits from shared in-memory state across calls.

### VSCode Server

Full browser-based IDE at `http://localhost:8080/code-server/`. Provides syntax highlighting, extension support, integrated terminal, and the full VSCode editing experience. Primarily useful for human developers inspecting or editing files in the sandbox during development; agents typically use the file/shell API rather than VSCode.

**Port Forwarding** — the sandbox includes a smart preview proxy. When a web application starts inside the container (e.g., `npm run dev` on port 3000), the proxy makes it accessible from outside. Port forwarding targets can be configured via `WAIT_PORTS` in the environment.

### MCP Integration

Pre-configured MCP server hub at `http://localhost:8080/mcp`. Four servers ship out of the box:

| MCP Server | Tools |
|------------|-------|
| `browser` | `navigate`, `screenshot`, `click`, `type`, `scroll` |
| `file` | `read`, `write`, `list`, `search`, `replace` |
| `shell` | `exec`, `create_session`, `kill` |
| `markitdown` | `convert`, `extract_text`, `extract_images` |

The `markitdown` server wraps the `markdownify` library for document processing — converting HTML, PDFs, and other formats to Markdown. Useful in research pipelines where agents need to ingest web content.

MCP compatibility means any LLM framework that supports the Model Context Protocol can use AIO Sandbox tools without a custom SDK — just point the MCP client at `http://localhost:8080/mcp`.

### Core HTTP API Summary

| Endpoint | Description |
|----------|-------------|
| `GET /v1/sandbox` | Get sandbox environment info (home dir, etc.) |
| `POST /v1/shell/exec` | Execute shell command |
| `GET /v1/file/read` | Read file |
| `POST /v1/file/write` | Write file |
| `GET /v1/browser/screenshot` | Take browser screenshot |
| `POST /v1/jupyter/execute` | Execute Python code in Jupyter |

Full interactive docs at `http://localhost:8080/v1/docs` (OpenAPI/Swagger).

## Related

- [[aio-sandbox-overview]]
- [[aio-sandbox-docker]]
- [[agent-infra-sandbox-sdk]]
- [[aio-sandbox-deepagents-integration]]

## Sources

- `raw/aio-sandbox/README.md` — Key Features, API Reference, MCP Servers, Complete Example sections
