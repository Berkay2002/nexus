# Using MCP Tools — Examples

## Example 1: Take a full-page screenshot via chrome_devtools

```javascript
const search = await mcp_tool_search({ query: "screenshot", namespace: "chrome_devtools" });
// search.results[0].path → "/home/gem/nexus-servers/chrome_devtools/take_screenshot.js"

// After read_file on that path to confirm the argument shape:
await sandbox_nodejs_execute({
  code: `
    import { chromeDevtoolsNavigate } from "/home/gem/nexus-servers/chrome_devtools/navigate.js";
    import { chromeDevtoolsTakeScreenshot } from "/home/gem/nexus-servers/chrome_devtools/take_screenshot.js";

    await chromeDevtoolsNavigate({ url: "https://example.com" });
    const shot = await chromeDevtoolsTakeScreenshot({ full_page: true });
    const out = shot.structuredContent || shot.content?.[0];
    console.log(JSON.stringify({ ok: true, saved: out }));
  `,
});
```

Notice: two wrappers composed in one script, one model turn, and only the structured result prints — the base64 image bytes stay out of the conversation.

## Example 2: Inspect network requests on a page

```javascript
await sandbox_nodejs_execute({
  code: `
    import { chromeDevtoolsNavigate } from "/home/gem/nexus-servers/chrome_devtools/navigate.js";
    import { chromeDevtoolsListNetworkRequests } from "/home/gem/nexus-servers/chrome_devtools/list_network_requests.js";

    await chromeDevtoolsNavigate({ url: "https://httpbin.org/delay/2" });
    const requests = await chromeDevtoolsListNetworkRequests({ limit: 50 });
    const entries = requests.structuredContent?.requests ?? [];
    const summary = entries.map(r => ({
      url: r.url,
      method: r.method,
      status: r.status,
      size: r.response_size,
    }));
    console.log(JSON.stringify(summary, null, 2));
  `,
});
```

## Example 3: Run Python code inside a Node script via the sandbox MCP tool

Use this when you want Python-specific behavior but are already inside a Node composition. The sandbox MCP server exposes its own code-execution tool which is callable from Node.

```javascript
await sandbox_nodejs_execute({
  code: `
    import { sandboxExecuteCode } from "/home/gem/nexus-servers/sandbox/execute_code.js";

    const result = await sandboxExecuteCode({
      language: "python",
      code: "import numpy as np; print(np.linspace(0, 1, 5).tolist())",
    });
    const out = result.structuredContent?.stdout ?? result.content?.[0]?.text;
    console.log(out);
  `,
});
```

Reaching Python through a Node wrapper in one turn is cheaper than spawning a separate code sub-agent when you only need a few lines.
