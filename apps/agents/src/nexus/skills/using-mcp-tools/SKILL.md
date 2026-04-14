---
name: using-mcp-tools
description: Use when your directly-bound tools don't cover what you need — for example, you need Chrome DevTools performance traces, network inspection, form automation beyond screenshots, or a specific sandbox introspection capability. Triggers when the agent asks "is there a tool for X?" and the hot-layer research/code tools come up short. Teaches the cold-layer pattern: search the MCP catalog, read wrapper files, write a Node script that imports them, and run via sandbox_nodejs_execute.
---

# Using MCP Tools (Cold-Layer Pattern)

## When to Reach For This

Your research and code sub-agents have a small set of directly-bound tools. There's also a **cold layer** of additional MCP tools that live as JavaScript wrapper files at `/home/gem/nexus-servers/` inside the sandbox. Reach for the cold layer when:

- You need browser automation beyond screenshot + action (e.g. network request inspection, performance traces, console messages)
- You need Chrome DevTools-specific capabilities (CDP events, script evaluation with structured return)
- You need sandbox introspection the hot-layer tools don't expose
- You've tried the obvious hot-layer tools and they can't do what the task needs

Do NOT reach for this pattern when a hot-layer tool would work. It costs more tokens (one extra tool-call round-trip to discover the wrapper) and is strictly more complex.

## The Pattern

1. **Search the catalog.** Call `mcp_tool_search({ query: "<capability>" })`. You get back a ranked list of `{ path, name, summary }` entries where `path` is a sandbox-side absolute path under `/home/gem/nexus-servers/`.
2. **Read the wrapper.** Call `read_file({ path: "<path from step 1>" })`. The file contains the JSDoc argument docs, the exported function signature, and the wrapper body — everything you need to call it correctly.
3. **Write a Node script.** Use `sandbox_nodejs_execute({ code: "..." })` with a script that imports the wrapper via its absolute path and calls it.
4. **Read the script output.** Only what your script `console.log`s comes back to you. Print the fields you need, not the raw result.

## Two Node ESM Facts You Can Trust

- **`import` statements accept absolute filesystem paths directly**, with no `file://` prefix. Write `import { takeScreenshot } from "/home/gem/nexus-servers/chrome_devtools/take_screenshot.js"` and it just works.
- **`node_modules` resolution walks upward from the importing file's directory.** The wrappers import `@modelcontextprotocol/sdk` from `callMCPTool.js`, and resolution finds `/home/gem/nexus-servers/node_modules/` regardless of what cwd your Node process was started in. That's why `sandbox_nodejs_execute` has no `cwd` field and doesn't need one.

## Print What You Need

Script output is what reaches the conversation, not the raw MCP tool result. If you call a screenshot wrapper and `console.log(result)` the whole thing, you dump base64 image data into your context window. Instead, extract the fields you need:

```javascript
const r = await takeScreenshot({ full_page: true });
console.log(JSON.stringify({ saved_to: r.structuredContent.path, bytes: r.structuredContent.size }));
```

## When Scripts Fail

Scripts crash. The stack trace comes back in stderr. Three common failure modes:

1. **Wrong arguments.** The wrapper's JSDoc told you `{ url: string }` was required. You passed `{ path: "..." }` by accident. Fix: re-read the wrapper file and resend with the right argument names.
2. **MCP tool error.** The wrapper calls `callMCPTool` which throws on `isError: true` from the MCP server. The error message quotes the MCP server's diagnostic. Fix: read the MCP error text, adjust the tool arguments or the page state, retry.
3. **Stale wrapper.** The wrapper exists on disk but the MCP server no longer has that tool registered (upstream image bumped without a re-generation). Fix: flag it in your summary ("wrapper X is stale, please regenerate") — you cannot fix this from inside a turn, so use a different approach for the current task.

## Combining Multiple MCP Tools in One Turn

Scripts can compose. "Navigate, click login, fill form, screenshot" is four MCP calls but ONE `sandbox_nodejs_execute` invocation which is ONE model turn. Lean on this: compose wrappers inside your script rather than making four separate tool calls across four turns.

## See Also

- `examples.md` for three worked examples (screenshot, network inspection, cross-language composition)
- `templates/screenshot-script.js` for a copy-pasteable starting point
