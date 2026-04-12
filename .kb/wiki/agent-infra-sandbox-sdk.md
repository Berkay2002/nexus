---
created: 2026-04-12
updated: 2026-04-12
tags: [aio-sandbox, agent-infrastructure, execution]
sources: [raw/aio-sandbox/README.md]
---

# agent-infra/sandbox SDK

The `@agent-infra/sandbox` npm package (TypeScript/JavaScript) and `agent-sandbox` PyPI package (Python) are the official client SDKs for talking to the [[aio-sandbox-overview|AIO Sandbox]] container from agent code. Both wrap the container's HTTP API with typed clients. A Go SDK (`sandbox-sdk-go`) also exists but is not used in Nexus.

## Content

### Installation

```bash
# TypeScript / JavaScript (used by Nexus)
npm install @agent-infra/sandbox

# Python
pip install agent-sandbox

# Go
go get github.com/agent-infra/sandbox-sdk-go
```

### TypeScript SDK

The main entry point is the `Sandbox` class. Construct it with a `baseURL` pointing at the running container:

```typescript
import { Sandbox } from '@agent-infra/sandbox';

const sandbox = new Sandbox({ baseURL: 'http://localhost:8080' });
```

Namespaced clients map to the container's tool surfaces:

| Namespace | Description |
|-----------|-------------|
| `sandbox.shell` | Shell command execution |
| `sandbox.file` | File read/write/list |
| `sandbox.browser` | Browser control and screenshots |
| `sandbox.jupyter` | Jupyter code execution |

**Shell:**
```typescript
const result = await sandbox.shell.exec({ command: 'ls -la' });
console.log(result.output);
```

**File:**
```typescript
const content = await sandbox.file.read({ path: '/home/gem/.bashrc' });
```

**Browser:**
```typescript
const screenshot = await sandbox.browser.screenshot();
// For CDP access:
const info = await sandbox.browser.getInfo();
// info.cdpUrl → connect Playwright here
```

### Python SDK

The `Sandbox` class works analogously:

```python
from agent_sandbox import Sandbox

client = Sandbox(base_url="http://localhost:8080")
home_dir = client.sandbox.get_context().home_dir  # typically "/home/gem"
```

Key difference from TypeScript: Python SDK methods are synchronous and return response wrappers — access data via `.data.output`, `.data.content`, etc.

```python
# Shell
result = client.shell.exec_command(command="ls -la")
print(result.data.output)

# File
content = client.file.read_file(file=f"{home_dir}/.bashrc")
print(content.data.content)

# Browser screenshot
screenshot = client.browser.screenshot()

# Jupyter
output = client.jupyter.execute_code(code="print(1+1)")
print(output.data.outputs[0]['text'])

# Node.js (Python SDK only, exposed via sandbox)
result = client.nodejs.execute_nodejs_code(code="console.log(1+1)")
```

### Getting the Home Directory

Always call `client.sandbox.get_context().home_dir` rather than hardcoding `/home/gem`. The `WORKSPACE` environment variable on the container controls this value (defaults to `/home/gem`), so dynamic retrieval is safer across configurations.

### Nexus Usage

Nexus uses the TypeScript SDK inside the `AIOSandboxBackend` class (`apps/agents/src/nexus/backend/aio-sandbox.ts`). The [[composite-backend]] wraps this backend as the default route — all agent tool calls that don't target `/memories/` or `/skills/` are dispatched to the AIO Sandbox container at `:8080`.

### Integration Patterns

The SDK composes naturally with other frameworks:

- **Playwright over CDP** — retrieve `sandbox.browser.getInfo().cdpUrl`, then pass it to `p.chromium.connect_over_cdp(cdpUrl)` for full Playwright control of the in-container browser.
- **LangChain tools** — wrap `client.shell.exec_command` in a `BaseTool` subclass. See the README's LangChain integration example.
- **OpenAI function calling** — expose `jupyter.execute_code` as a function tool for code-interpreter-style workflows.
- **browser-use** — pass the CDP URL to `BrowserSession(browser_profile=BrowserProfile(cdp_url=...))` for browser-use agent integration.

## Related

- [[aio-sandbox-overview]]
- [[aio-sandbox-features]]
- [[aio-sandbox-docker]]
- [[composite-backend]]
- [[aio-sandbox-deepagents-integration]]

## Sources

- `raw/aio-sandbox/README.md` — Installation, Basic Usage, Integration Examples sections
