# NEXUS — AIO Sandbox Documentation Index

What we need from the AIO Sandbox docs for building Nexus.

---

## README.md — AIO Sandbox Overview

AIO Sandbox is an all-in-one agent sandbox environment that combines Browser, Shell, File, MCP operations, and VSCode Server in a single Docker container. Built on cloud-native lightweight sandbox technology.

**What it is:**
- Single Docker container providing: Browser (VNC + CDP), Shell Terminal, File System, VSCode Server, Jupyter Notebook, MCP Hub
- All components share a unified filesystem — files downloaded in browser are instantly available in shell/file operations
- Has both Python and TypeScript/JavaScript SDKs plus a REST API

**What Nexus needs:**
- **Docker launch:** `docker run --security-opt seccomp=unconfined --rm -it -p 8080:8080 ghcr.io/agent-infra/sandbox:latest`. → `README.md:35-36`
- **TypeScript SDK:** `npm install @agent-infra/sandbox`. Client: `new Sandbox({ baseURL: 'http://localhost:8080' })`. → `README.md:98-99, 140-158`
- **Key SDK methods we'll use in our `AIOSandboxBackend`:**
  - `sandbox.shell.exec({ command })` — execute shell commands (maps to `BaseSandbox.execute()`)
  - `sandbox.file.read({ path })` — read files (maps to `downloadFiles()`)
  - `sandbox.file.write({ path, content })` — write files (maps to `uploadFiles()`)
- **REST API endpoints** (alternative to SDK):
  - `POST /v1/shell/exec` — execute shell commands
  - `GET /v1/file/read` — read file contents
  - `POST /v1/file/write` — write file contents
  - `GET /v1/sandbox` — get sandbox environment info
  - `POST /v1/jupyter/execute` — execute Jupyter code
  - `GET /v1/browser/screenshot` — take browser screenshot
  → `README.md:267-279`
- **MCP Servers** available out of the box: browser (`navigate`, `screenshot`, `click`, `type`, `scroll`), file (`read`, `write`, `list`, `search`, `replace`), shell (`exec`, `create_session`, `kill`), markitdown (`convert`, `extract_text`, `extract_images`). → `README.md:281-287`
- **Docker Compose** config for persistent setup with volume mounts, shared memory, and environment variables. → `README.md:293-318`
- **Accessible services when running:** Docs at `:8080/v1/docs`, VNC at `:8080/vnc/`, VSCode at `:8080/code-server/`, MCP at `:8080/mcp`. → `README.md:53-57`

---

## deepagents-example/README.md — DeepAgents Integration Example

An official example implementing `AIOSandboxBackend(BaseSandbox)` for DeepAgents. **Currently Python-only** — we need to port to TypeScript.

**What it provides:**
- `AIOSandboxBackend` class extending `BaseSandbox` with three method mappings:
  - `execute(cmd)` → `client.bash.exec()`
  - `upload_files()` → `client.file.write_file()`
  - `download_files()` → `client.file.read_file()`
  → `deepagents-example/README.md:63-69`
- Architecture: `DeepAgents Agent → AIOSandboxBackend → agent-sandbox SDK → AIO Sandbox HTTP API`. → `deepagents-example/README.md:63-69`
- Uses OpenAI-compatible API (any provider via OpenRouter). → `deepagents-example/README.md:47-53`

**What Nexus needs to do:**
- Port this Python class to TypeScript using the `@agent-infra/sandbox` npm package
- The port is ~50-80 lines. Since `BaseSandbox` only requires `execute()` (all other fs tools are auto-derived), the minimum viable port is just the `execute()` method mapping to `sandbox.shell.exec()`
- `uploadFiles()` and `downloadFiles()` are optional but useful for seeding/retrieving artifacts
- The `@agent-infra/sandbox` TS SDK already has all the methods we need: `sandbox.shell.exec()`, `sandbox.file.read()`, `sandbox.file.write()`
