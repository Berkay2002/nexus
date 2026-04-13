---
created: 2026-04-13
updated: 2026-04-13
tags: [mcp, code-execution, context-engineering, anthropic, tool-call, skill, privacy]
sources: [raw/anthropic-blogs/code-exeuction-with-mcp.md]
---

# Code Execution with MCP

A pattern from Anthropic's Nov 2025 engineering blog: instead of loading MCP tool definitions into the model's context and letting it call them directly, present the MCP servers as a **code API on a filesystem** and let the agent write code that imports and calls them inside an execution environment. The model sees only the tools it actually reads, and intermediate data never round-trips through its context window. The blog's worked example shows a **98.7% token reduction** (~150K → ~2K tokens) for a single Google Drive → Salesforce workflow.

This is a pattern, not a product. Anthropic later productized a version of the same idea as [[programmatic-tool-calling]] on the Claude Developer Platform, but the filesystem-of-tools approach is independent of that API and applies anywhere the agent has both MCP access and a code sandbox — which is exactly [[aio-sandbox-overview|Nexus's runtime shape]].

## The two problems it solves

### 1. Tool definitions overload the context window

Most MCP clients load every tool definition upfront and hand them to the model as a direct-tool-call menu. A typical five-server setup (GitHub, Slack, Sentry, Grafana, Splunk) consumes ~55K tokens before the conversation even starts; adding a sixth can push it past 100K. Agents with hundreds of tools spend hundreds of thousands of tokens on definitions before reading the user's first message.

### 2. Intermediate results consume additional tokens

Each direct tool call funnels its result back through the model, even when the agent's next step is just to pipe it into another tool. The blog's canonical example: "download my meeting transcript from Google Drive and attach it to the Salesforce lead." A 50K-token transcript gets loaded by `gdrive.getDocument(...)` and then has to be re-emitted by the model for `salesforce.updateRecord(...)`. The full payload flows through the context window **twice**, and for large enough documents it can exceed the context limit entirely — breaking the workflow.

## The pattern: tools as a file tree

Present the MCP servers' tools as TypeScript (or Python) files in a directory tree that lives inside the agent's sandbox:

```text
servers
├── google-drive
│   ├── getDocument.ts
│   ├── ... (other tools)
│   └── index.ts
├── salesforce
│   ├── updateRecord.ts
│   ├── ... (other tools)
│   └── index.ts
└── ... (other servers)
```

Each tool file is a thin wrapper over a single `callMCPTool` primitive:

```typescript
// ./servers/google-drive/getDocument.ts
import { callMCPTool } from "../../../client.js";

interface GetDocumentInput { documentId: string; }
interface GetDocumentResponse { content: string; }

/* Read a document from Google Drive */
export async function getDocument(
  input: GetDocumentInput
): Promise<GetDocumentResponse> {
  return callMCPTool<GetDocumentResponse>(
    "google_drive__get_document",
    input
  );
}
```

The agent is given a sandbox and a pointer to the `servers/` tree. It discovers the tools it needs by listing directories and reading files — not by having every definition pre-loaded into its system prompt. Once it knows which tools it wants, it writes a short script that imports them and runs it in the sandbox:

```typescript
import * as gdrive from "./servers/google-drive";
import * as salesforce from "./servers/salesforce";

const transcript = (await gdrive.getDocument({ documentId: "abc123" })).content;
await salesforce.updateRecord({
  objectType: "SalesMeeting",
  recordId: "00Q5f000001abcXYZ",
  data: { Notes: transcript },
});
```

The transcript lives entirely inside the sandbox. The model never sees its bytes — it sees only the code it wrote and whatever the script prints at the end. The blog claims this single example goes from ~150K tokens of context consumption to ~2K, a 98.7% saving.

## Benefits beyond token count

The token reduction is the headline, but the pattern has four other properties that matter for agent design:

### Progressive disclosure

Models read tool definitions on-demand by listing `servers/` and opening specific files. A `search_tools` primitive can be layered on top so the agent can query "find me tools related to Salesforce accounts" and get back a shortlist of file paths to read, loading only the schemas it actually needs. Compare with the default MCP posture: every schema for every tool loaded unconditionally into every request.

### Context-efficient tool results

Results can be **filtered and transformed in code** before anything crosses back into the model context. The blog's example:

```typescript
const allRows = await gdrive.getSheet({ sheetId: "abc123" });
const pendingOrders = allRows.filter((row) => row["Status"] === "pending");
console.log(`Found ${pendingOrders.length} pending orders`);
console.log(pendingOrders.slice(0, 5)); // Only log first 5 for review
```

`allRows` might be 10,000 entries. The model sees a count and the first five. This is impossible with direct tool calls — direct calls hand the whole payload to the model and ask it to sample from there.

### More powerful control flow

Loops, conditionals, retries, and error handling become ordinary code patterns rather than chains of individual model turns:

```typescript
let found = false;
while (!found) {
  const messages = await slack.getChannelHistory({ channel: "C123456" });
  found = messages.some((m) => m.text.includes("deployment complete"));
  if (!found) await new Promise((r) => setTimeout(r, 5000));
}
console.log("Deployment notification received");
```

A traditional direct-call agent would spend a model inference pass on every iteration of that loop. The code-execution version spends one model turn to write the loop and one turn to read the result.

### Privacy-preserving operations

Intermediate data stays inside the execution environment by default. The agent harness can even tokenize sensitive fields (PII, secrets, account IDs) before anything leaves the sandbox, so the model sees opaque placeholders while the real values flow directly between MCP servers. The blog positions this as an architectural property, not a feature of any specific product.

### State persistence and skills

Agents can write intermediate results to files and read them back on later turns — state without model context. They can also persist their own code as reusable functions and rediscover them as [[skills|skills]] on future runs. The pattern naturally closes the loop with DeepAgents' [[skill-md-format|SKILL.md format]] and [[long-term-memory|`/memories/` filesystem pattern]].

## Trade-offs

The blog is explicit that code execution adds complexity: the agent harness needs a secure sandbox, resource limits (CPU, memory, wall-clock, network), and a code runtime. That's real engineering overhead compared to "feed tool definitions to the model and let it call them." The argument for paying that cost is the compounding win across token count, latency, and composability — at the scale of "hundreds of tools across dozens of servers," direct tool calling stops working.

> **Note — "code execution" here means a sandbox, not a single call.** Direct tool calling requires no sandbox at all; the code-execution pattern requires a persistent or ephemeral environment the agent can write files into and run scripts from. [[aio-sandbox-overview|AIO Sandbox]] is exactly this kind of environment — shell, filesystem, Jupyter, Node.js, Python — so the pattern maps onto Nexus's existing runtime cleanly. The missing piece is exposing the MCP tools as files under `/home/gem/workspace/servers/` instead of (or alongside) binding them directly to sub-agents.

## Relevance to Nexus

Nexus's current MCP wiring is **direct tool calling**: sub-agents receive `mcp_*` tools via `bind_tools`-equivalent plumbing and invoke them one at a time, with results flowing back through the LangGraph message channel. This is the worst case the blog describes — every tool definition loaded upfront and every intermediate result passing through the context window. The Nexus stack already has all the ingredients to switch patterns:

1. **A sandbox with a filesystem and code execution.** [[aio-sandbox-overview|AIO Sandbox]] exposes persistent shell, Jupyter kernels, and one-shot [[aio-sandbox-code-execution-api|`/v1/code/execute`]] — any of them can run the agent-written scripts.
2. **MCP tools already reachable from inside the sandbox.** The Streamable HTTP MCP endpoint at `POST /mcp` exposes 60 native tools; [[langchain-mcp-adapters]] is the canonical client-side path.
3. **A skills registry to cache agent-written helper scripts.** [[skills]] + [[skill-md-format]] already provide persistent, model-visible file storage.

The pattern to try first, if the token-efficiency numbers matter for a given Nexus workload, is:

- Stand up `/home/gem/workspace/servers/` inside AIO Sandbox with one TS file per MCP tool, each wrapping `callMCPTool`.
- Give research/code sub-agents a `search_tools` primitive (grep over `servers/`) instead of binding all 60 tools to their prompt.
- Let them write and execute short scripts in `/home/gem/workspace/{agent}/task_{id}/` that import the relevant tool files.
- Capture repeatable scripts as skills.

> **[unverified]** — Nexus has not yet adopted this pattern; the tool-binding path is what ships today. This section is a design note, not a description of existing code.

## Related

- [[anthropic-advanced-tool-use]] — Anthropic's productization of parts of this pattern (Tool Search Tool, Programmatic Tool Calling, Tool Use Examples) as Claude API beta features
- [[programmatic-tool-calling]] — The direct API-level instantiation of the code-execution pattern on the Claude Developer Platform
- [[tool-search-tool]] — The API-level instantiation of the progressive-disclosure idea
- [[langchain-mcp-adapters]] — How Nexus actually reaches MCP tools today (the direct-call path)
- [[aio-sandbox-mcp-api]] — The AIO Sandbox's MCP gateway endpoints
- [[aio-sandbox-code-execution-api]] — The sandbox's one-shot code execution surface
- [[aio-sandbox-jupyter-api]] — Stateful Python kernel sessions (the persistent variant)
- [[skills]] — Persistent agent-authored scripts, which complete the state-persistence story
- [[context-engineering]] — DeepAgents' wider context-engineering taxonomy; this pattern is a context-compression technique
- [[context-compression]] — The offloading-and-summarization category this pattern fits in

## Sources

- `raw/anthropic-blogs/code-exeuction-with-mcp.md` — "Code execution with MCP: Building more efficient agents" (Anthropic engineering blog, Nov 04 2025). Includes the file-tree / `callMCPTool` wrapper pattern, the 150K→2K token example, the Google Drive → Salesforce worked example, and the five benefits (progressive disclosure, context-efficient results, control flow, privacy, skills).
