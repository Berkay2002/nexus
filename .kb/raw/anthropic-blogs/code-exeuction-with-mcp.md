# Code execution with MCP: Building more efficient agents

**Published Nov 04, 2025**

Direct tool calls consume context for each definition and result. Agents scale better by writing code to call tools instead. Here's how it works with MCP.

The Model Context Protocol (MCP) is an open standard for connecting AI agents to external systems. Connecting agents to tools and data traditionally requires a custom integration for each pairing, creating fragmentation and duplicated effort that makes it difficult to scale truly connected systems. MCP provides a universal protocol—developers implement MCP once in their agent and it unlocks an entire ecosystem of integrations.

Since launching MCP in November 2024, adoption has been rapid: the community has built thousands of MCP servers, SDKs are available for all major programming languages, and the industry has adopted MCP as the de-facto standard for connecting agents to tools and data.

Today developers routinely build agents with access to hundreds or thousands of tools across dozens of MCP servers. However, as the number of connected tools grows, loading all tool definitions upfront and passing intermediate results through the context window slows down agents and increases costs.

In this blog we'll explore how code execution can enable agents to interact with MCP servers more efficiently, handling more tools while using fewer tokens.

---

## Excessive token consumption from tools makes agents less efficient

As MCP usage scales, there are two common patterns that can increase agent cost and latency:
1. Tool definitions overload the context window.
2. Intermediate tool results consume additional tokens.

### 1. Tool definitions overload the context window
Most MCP clients load all tool definitions upfront directly into context, exposing them to the model using a direct tool-calling syntax. These tool definitions might look like:

```typescript
gdrive.getDocument
Description: Retrieves a document from Google Drive
Parameters:
  documentId (required, string): The ID of the document to retrieve
  fields (optional, string): Specific fields to return
Returns: Document object with title, body content, metadata, permissions, etc.

salesforce.updateRecord
Description: Updates a record in Salesforce
Parameters:
  objectType (required, string): Type of Salesforce object (Lead, Contact, Account, etc.)
  recordId (required, string): The ID of the record to update
  data (required, object): Fields to update with their new values
Returns: Updated record object with confirmation
```

Tool descriptions occupy more context window space, increasing response time and costs. In cases where agents are connected to thousands of tools, they'll need to process hundreds of thousands of tokens before reading a request.

### 2. Intermediate tool results consume additional tokens
Most MCP clients allow models to directly call MCP tools. For example, you might ask your agent: "Download my meeting transcript from Google Drive and attach it to the Salesforce lead."

The model will make calls like:
- **TOOL CALL**: `gdrive.getDocument(documentId: "abc123")` → returns "Discussed Q4 goals... [full transcript text]" (loaded into model context).
- **TOOL CALL**: `salesforce.updateRecord(...)` (model needs to write entire transcript into context again).

Every intermediate result must pass through the model. In this example, the full call transcript flows through twice. For a 2-hour sales meeting, that could mean processing an additional 50,000 tokens. Even larger documents may exceed context window limits, breaking the workflow.


---

## Code execution with MCP improves context efficiency

With code execution environments becoming more common for agents, a solution is to present MCP servers as code APIs rather than direct tool calls. The agent can then write code to interact with MCP servers. This approach addresses both challenges: agents can load only the tools they need and process data in the execution environment before passing results back to the model.

One approach is to generate a file tree of all available tools from connected MCP servers:

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

Each tool corresponds to a file:

```typescript
// ./servers/google-drive/getDocument.ts
import { callMCPTool } from "../../../client.js";

interface GetDocumentInput {
  documentId: string;
}

interface GetDocumentResponse {
  content: string;
}

/* Read a document from Google Drive */
export async function getDocument(input: GetDocumentInput): Promise<GetDocumentResponse> {
  return callMCPTool<GetDocumentResponse>('google_drive__get_document', input);
}
```

The Google Drive to Salesforce example above becomes:

```typescript
// Read transcript from Google Docs and add to Salesforce prospect
import * as gdrive from './servers/google-drive';
import * as salesforce from './servers/salesforce';

const transcript = (await gdrive.getDocument({ documentId: 'abc123' })).content;
await salesforce.updateRecord({
  objectType: 'SalesMeeting',
  recordId: '00Q5f000001abcXYZ',
  data: { Notes: transcript }
});
```

The agent discovers tools by exploring the filesystem. This reduces token usage from 150,000 tokens to 2,000 tokens—a time and cost saving of 98.7%.

---

## Benefits of code execution with MCP

### Progressive disclosure
Presenting tools as code on a filesystem allows models to read tool definitions on-demand. Alternatively, a `search_tools` tool can be added to find relevant definitions, allowing the agent to load only the specific schemas required for the task.

### Context efficient tool results
Agents can filter and transform results in code before returning them.

```typescript
// With code execution - filter in the execution environment
const allRows = await gdrive.getSheet({ sheetId: 'abc123' });
const pendingOrders = allRows.filter(row => row["Status"] === 'pending' );
console.log(`Found ${pendingOrders.length} pending orders`);
console.log(pendingOrders.slice(0, 5)); // Only log first 5 for review
```

### More powerful and context-efficient control flow
Loops, conditionals, and error handling can be done with code patterns rather than chaining individual tool calls.

```typescript
let found = false;
while (!found) {
  const messages = await slack.getChannelHistory({ channel: 'C123456' });
  found = messages.some(m => m.text.includes('deployment complete'));
  if (!found) await new Promise(r => setTimeout(r, 5000));
}
console.log('Deployment notification received');
```

### Privacy-preserving operations
Intermediate results stay in the execution environment by default. The agent harness can tokenize sensitive data (PII) automatically before it reaches the model. The real data flows between MCP tools (e.g., from Google Sheets to Salesforce) but never enters the model's context window.

### State persistence and skills
Agents can maintain state across operations by writing intermediate results to files. They can also persist their own code as reusable functions (Skills), which models can reference later to improve performance on specialized tasks.

---

## Summary
While code execution introduces complexity—requiring secure sandboxing and resource limits—the benefits of reduced token costs, lower latency, and improved tool composition are significant. Code execution applies established software engineering patterns to agents, letting them use familiar programming constructs to interact with MCP servers more efficiently.