# Plan 1: Foundation & Backend Infrastructure

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Nexus's foundation alongside the scaffold — AIO Sandbox backend, SQLite persistence, CompositeBackend routing, and a minimal graph entry point so `langgraph dev` starts cleanly. Keep existing model provider deps (Anthropic, OpenAI) for future multi-provider support.

**Architecture:** Extend `BaseSandbox` from `deepagents` to wrap the `@agent-infra/sandbox` TypeScript SDK, connecting to the AIO Sandbox Docker container at `:8080`. Wire a `CompositeBackend` with the sandbox as default route and `StoreBackend` (backed by LangGraph's `InMemoryStore` initially, SQLite later) for `/memories/`. Create a skeleton `graph.ts` that exports a compilable LangGraph graph so the dev server boots.

**Tech Stack:** `deepagents`, `@agent-infra/sandbox`, `@langchain/google-genai`, `@langchain/anthropic`, `@langchain/openai`, `@langchain/langgraph`, `better-sqlite3`, `drizzle-orm`, `zod`

---

## File Structure

```
apps/agents/
├── package.json                          # MODIFY: replace scaffold deps
├── src/
│   ├── nexus/
│   │   ├── graph.ts                      # CREATE: minimal graph entry point
│   │   ├── state.ts                      # CREATE: graph state annotation
│   │   ├── backend/
│   │   │   ├── aio-sandbox.ts            # CREATE: AIOSandboxBackend extends BaseSandbox
│   │   │   ├── composite.ts              # CREATE: CompositeBackend factory
│   │   │   └── store.ts                  # CREATE: StoreBackend config + SQLite store
│   │   └── db/
│   │       ├── index.ts                  # CREATE: Drizzle connection
│   │       └── schema.ts                 # CREATE: Drizzle table schemas
│   └── research-agent/                   # KEEP (don't delete yet — remove in Plan 2)
├── memories/
│   └── AGENTS.md                         # CREATE: seed memory file
└── skills/                               # CREATE: empty directory (populated in Plan 5)

nexus/
├── .env.example                          # MODIFY: replace with Nexus env vars
├── .gitignore                            # MODIFY: add data/ directory
├── langgraph.json                        # MODIFY: add nexus graph (keep research_agent temporarily)
└── data/                                 # CREATE: gitignored SQLite storage
```

---

### Task 1: Clean Up Scaffold Dependencies

**Files:**
- Modify: `apps/agents/package.json`

- [ ] **Step 1: Read current dependencies**

Run: `cat apps/agents/package.json`
Note which scaffold deps to remove and which to keep.

- [ ] **Step 2: Remove RAG/vector-store scaffold dependencies**

Run:
```bash
cd apps/agents && npm uninstall @langchain/community @langchain/pinecone @langchain/mongodb @elastic/elasticsearch mongodb && cd ../..
```

Keep `@langchain/anthropic` and `@langchain/openai` — Nexus will be model-agnostic in the future. Only remove RAG-specific deps (Pinecone, MongoDB, Elasticsearch).

- [ ] **Step 3: Install Nexus dependencies**

Run:
```bash
cd apps/agents && npm install deepagents @langchain/google-genai @agent-infra/sandbox better-sqlite3 drizzle-orm zod && cd ../..
```

Run:
```bash
cd apps/agents && npm install -D @types/better-sqlite3 drizzle-kit && cd ../..
```

- [ ] **Step 4: Verify install succeeded**

Run: `cd apps/agents && npm ls --depth=0 && cd ../..`
Expected: All packages listed, no peer dep errors blocking startup.

- [ ] **Step 5: Commit**

```bash
git add apps/agents/package.json package-lock.json
git commit -m "chore: replace scaffold deps with Nexus stack (deepagents, google-genai, sandbox, sqlite)"
```

---

### Task 2: Environment & Gitignore Configuration

**Files:**
- Modify: `.env.example`
- Modify: `.gitignore`
- Create: `data/` directory (empty, gitignored)

- [ ] **Step 1: Rewrite `.env.example`**

Replace the entire contents of `.env.example` with:

```env
# Google Vertex AI
GOOGLE_GENAI_USE_VERTEXAI=true
GOOGLE_CLOUD_PROJECT=""
GOOGLE_CLOUD_LOCATION="us-central1"
GEMINI_API_KEY=""

# Search APIs
TAVILY_API_KEY=""
EXA_API_KEY=""

# AIO Sandbox
SANDBOX_URL="http://localhost:8080"

# LangGraph Frontend
NEXT_PUBLIC_API_URL="http://localhost:2024"
NEXT_PUBLIC_ASSISTANT_ID="nexus"

# LangSmith (optional)
# LANGSMITH_API_KEY=""
# LANGSMITH_TRACING_V2="true"
# LANGSMITH_PROJECT="nexus"
```

- [ ] **Step 2: Update `.gitignore`**

Add these lines to `.gitignore`:

```
# SQLite database
data/
*.db
*.db-journal
*.db-wal
```

- [ ] **Step 3: Create data directory with .gitkeep**

Run:
```bash
mkdir -p data && touch data/.gitkeep
```

- [ ] **Step 4: Commit**

```bash
git add .env.example .gitignore data/.gitkeep
git commit -m "chore: configure env vars for Nexus stack, gitignore SQLite data"
```

---

### Task 3: SQLite Database Setup with Drizzle ORM

**Files:**
- Create: `apps/agents/src/nexus/db/schema.ts`
- Create: `apps/agents/src/nexus/db/index.ts`

- [ ] **Step 1: Write the database schema**

Create `apps/agents/src/nexus/db/schema.ts`:

```typescript
import { sqliteTable, text, integer, blob } from "drizzle-orm/sqlite-core";

/**
 * LangGraph checkpointer table — stores thread state for conversation persistence.
 * Used by SqliteSaver from @langchain/langgraph-checkpoint-sqlite.
 * Note: SqliteSaver manages its own schema — this is here for documentation.
 * We create it via SqliteSaver.fromConnString(), not Drizzle migrations.
 */

/**
 * Key-value store table for StoreBackend (memory persistence).
 * LangGraph's store also manages its own schema.
 * We use @langchain/langgraph's SqliteStore which handles table creation.
 */

// If we need custom tables later (e.g., task history, user preferences),
// they go here. For now, both SQLite consumers (checkpointer + store)
// manage their own schemas via their respective libraries.
export {};
```

- [ ] **Step 2: Write the database connection**

Create `apps/agents/src/nexus/db/index.ts`:

```typescript
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import path from "path";

const DB_PATH = path.resolve(process.cwd(), "data", "nexus.db");

// Ensure data directory exists
import fs from "fs";
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const sqlite = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);
export const rawDb = sqlite;
export { DB_PATH };
```

- [ ] **Step 3: Verify the database initializes**

Run:
```bash
cd apps/agents && npx tsx -e "
const { rawDb, DB_PATH } = require('./src/nexus/db/index.ts');
console.log('DB path:', DB_PATH);
console.log('WAL mode:', rawDb.pragma('journal_mode', { simple: true }));
rawDb.close();
console.log('SQLite OK');
" && cd ../..
```

Expected: Prints DB path, "wal", and "SQLite OK". File `data/nexus.db` created.

- [ ] **Step 4: Commit**

```bash
git add apps/agents/src/nexus/db/
git commit -m "feat: add SQLite database connection with Drizzle ORM and WAL mode"
```

---

### Task 4: AIOSandboxBackend — Extends BaseSandbox

**Files:**
- Create: `apps/agents/src/nexus/backend/aio-sandbox.ts`

- [ ] **Step 1: Write the AIOSandboxBackend test**

We need to verify the backend can connect to and execute commands in the AIO Sandbox. Since this is an integration test requiring Docker, we write a manual verification script instead of a unit test.

Create `apps/agents/src/nexus/backend/__tests__/aio-sandbox.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { AIOSandboxBackend } from "../aio-sandbox.js";

// Integration test — requires AIO Sandbox running at :8080
// Run: docker run --security-opt seccomp=unconfined --rm -it -p 8080:8080 ghcr.io/agent-infra/sandbox:latest
describe("AIOSandboxBackend", () => {
  let backend: AIOSandboxBackend;

  beforeAll(() => {
    backend = new AIOSandboxBackend("http://localhost:8080");
  });

  it("should have a stable id", () => {
    expect(backend.id).toBe("aio-sandbox");
  });

  it("should execute a shell command", async () => {
    const result = await backend.execute("echo hello");
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("hello");
    expect(result.truncated).toBe(false);
  });

  it("should report non-zero exit codes", async () => {
    const result = await backend.execute("exit 1");
    expect(result.exitCode).toBe(1);
  });

  it("should execute in the sandbox home directory", async () => {
    const result = await backend.execute("pwd");
    expect(result.output.trim()).toBe("/home/gem");
  });

  it("should write and read files via execute", async () => {
    await backend.execute(
      "mkdir -p /home/gem/workspace/test && echo 'test content' > /home/gem/workspace/test/file.txt"
    );
    const result = await backend.execute(
      "cat /home/gem/workspace/test/file.txt"
    );
    expect(result.output.trim()).toBe("test content");

    // Clean up
    await backend.execute("rm -rf /home/gem/workspace/test");
  });

  it("should upload and download files", async () => {
    const content = new TextEncoder().encode("uploaded content");
    const uploadResult = await backend.uploadFiles([
      ["/home/gem/workspace/upload-test.txt", content],
    ]);
    expect(uploadResult[0].error).toBeNull();

    const downloadResult = await backend.downloadFiles([
      "/home/gem/workspace/upload-test.txt",
    ]);
    expect(downloadResult[0].error).toBeNull();

    const decoded = new TextDecoder().decode(
      downloadResult[0].content as Uint8Array
    );
    expect(decoded).toBe("uploaded content");

    // Clean up
    await backend.execute("rm /home/gem/workspace/upload-test.txt");
  });
});
```

- [ ] **Step 2: Write the AIOSandboxBackend implementation**

Create `apps/agents/src/nexus/backend/aio-sandbox.ts`:

```typescript
import {
  BaseSandbox,
  type ExecuteResponse,
  type FileUploadResponse,
  type FileDownloadResponse,
} from "deepagents";
import { Sandbox } from "@agent-infra/sandbox";

/**
 * AIO Sandbox backend for DeepAgents.
 *
 * Wraps the @agent-infra/sandbox TypeScript SDK to connect to an AIO Sandbox
 * Docker container. Only execute() is strictly required — BaseSandbox derives
 * all filesystem tools (ls, read_file, write_file, edit_file, glob, grep)
 * from shell commands via execute().
 *
 * uploadFiles() and downloadFiles() are implemented for efficient bulk transfer
 * (seeding workspace, retrieving artifacts).
 */
export class AIOSandboxBackend extends BaseSandbox {
  readonly id = "aio-sandbox";
  private client: Sandbox;

  constructor(baseURL: string = "http://localhost:8080") {
    super();
    this.client = new Sandbox({ baseURL });
  }

  async execute(command: string): Promise<ExecuteResponse> {
    const result = await this.client.shell.exec({ command });
    return {
      output: result.output,
      exitCode: result.exitCode,
      truncated: result.truncated,
    };
  }

  async uploadFiles(
    files: Array<[string, Uint8Array]>
  ): Promise<FileUploadResponse[]> {
    const results: FileUploadResponse[] = [];
    for (const [filePath, content] of files) {
      try {
        await this.client.file.write({ path: filePath, content });
        results.push({ path: filePath, error: null });
      } catch (err) {
        results.push({
          path: filePath,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return results;
  }

  async downloadFiles(paths: string[]): Promise<FileDownloadResponse[]> {
    const results: FileDownloadResponse[] = [];
    for (const filePath of paths) {
      try {
        const file = await this.client.file.read({ path: filePath });
        const content =
          typeof file.content === "string"
            ? new TextEncoder().encode(file.content)
            : file.content;
        results.push({ path: filePath, content, error: null });
      } catch (err) {
        results.push({
          path: filePath,
          content: null,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return results;
  }
}
```

- [ ] **Step 3: Run the integration test (requires Docker sandbox running)**

Run:
```bash
cd apps/agents && npx vitest run src/nexus/backend/__tests__/aio-sandbox.test.ts && cd ../..
```

Expected: All 5 tests pass. If sandbox is not running, tests will fail with connection error — that's expected in CI, these are integration tests.

- [ ] **Step 4: Commit**

```bash
git add apps/agents/src/nexus/backend/aio-sandbox.ts apps/agents/src/nexus/backend/__tests__/aio-sandbox.test.ts
git commit -m "feat: add AIOSandboxBackend extending BaseSandbox for AIO Sandbox Docker"
```

---

### Task 5: StoreBackend Configuration

**Files:**
- Create: `apps/agents/src/nexus/backend/store.ts`

- [ ] **Step 1: Write the StoreBackend test**

Create `apps/agents/src/nexus/backend/__tests__/store.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createNexusStore } from "../store.js";

describe("createNexusStore", () => {
  it("should create a StoreBackend with nexus namespace", () => {
    const backend = createNexusStore();
    expect(backend).toBeDefined();
  });
});
```

- [ ] **Step 2: Write the StoreBackend configuration**

Create `apps/agents/src/nexus/backend/store.ts`:

```typescript
import { StoreBackend } from "deepagents";

/**
 * Creates a StoreBackend for persistent memory storage.
 *
 * Routes: /memories/ in the CompositeBackend
 * Namespace: ["nexus"] — single-user, agent-scoped
 *
 * The actual BaseStore instance is passed at the createDeepAgent() level
 * via the `store` parameter — StoreBackend reads from it automatically.
 * See: https://reference.langchain.com/javascript/deepagents/backends/StoreBackend
 */
export function createNexusStore(): StoreBackend {
  return new StoreBackend({
    namespace: () => ["nexus"],
  });
}
```

- [ ] **Step 3: Run the test**

Run:
```bash
cd apps/agents && npx vitest run src/nexus/backend/__tests__/store.test.ts && cd ../..
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/agents/src/nexus/backend/store.ts apps/agents/src/nexus/backend/__tests__/store.test.ts
git commit -m "feat: add StoreBackend factory for persistent memory with nexus namespace"
```

---

### Task 6: CompositeBackend Factory

**Files:**
- Create: `apps/agents/src/nexus/backend/composite.ts`

- [ ] **Step 1: Write the CompositeBackend test**

Create `apps/agents/src/nexus/backend/__tests__/composite.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createNexusBackend } from "../composite.js";
import { AIOSandboxBackend } from "../aio-sandbox.js";

describe("createNexusBackend", () => {
  it("should create a CompositeBackend with sandbox default and store for memories", () => {
    const sandbox = new AIOSandboxBackend("http://localhost:8080");
    const backend = createNexusBackend(sandbox);
    expect(backend).toBeDefined();
  });
});
```

- [ ] **Step 2: Write the CompositeBackend factory**

Create `apps/agents/src/nexus/backend/composite.ts`:

```typescript
import { CompositeBackend } from "deepagents";
import { AIOSandboxBackend } from "./aio-sandbox.js";
import { createNexusStore } from "./store.js";

/**
 * Creates the Nexus CompositeBackend:
 *
 * - Default route (/) → AIOSandboxBackend (ephemeral workspace in Docker)
 * - /memories/ route → StoreBackend (SQLite-persisted memory)
 *
 * The sandbox as default route means the agent gets the `execute` tool
 * auto-provisioned (BaseSandbox implements SandboxBackendProtocolV2).
 *
 * Note: The actual BaseStore for StoreBackend is passed via createDeepAgent({ store }).
 */
export function createNexusBackend(
  sandbox: AIOSandboxBackend
): CompositeBackend {
  return new CompositeBackend(sandbox, {
    "/memories/": createNexusStore(),
  });
}
```

- [ ] **Step 3: Run the test**

Run:
```bash
cd apps/agents && npx vitest run src/nexus/backend/__tests__/composite.test.ts && cd ../..
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/agents/src/nexus/backend/composite.ts apps/agents/src/nexus/backend/__tests__/composite.test.ts
git commit -m "feat: add CompositeBackend factory routing sandbox + StoreBackend"
```

---

### Task 7: Graph State & Minimal Graph Entry Point

**Files:**
- Create: `apps/agents/src/nexus/state.ts`
- Create: `apps/agents/src/nexus/graph.ts`

- [ ] **Step 1: Write the graph state annotation**

Create `apps/agents/src/nexus/state.ts`:

```typescript
import { Annotation, MessagesAnnotation } from "@langchain/langgraph";

/**
 * Nexus graph state.
 *
 * Extends MessagesAnnotation (provides `messages` with reducer).
 * Additional fields will be added in Plan 2 (meta-router output, model selection).
 */
export const NexusStateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
});

export type NexusState = typeof NexusStateAnnotation.State;
```

- [ ] **Step 2: Write the minimal graph entry point**

Create `apps/agents/src/nexus/graph.ts`:

```typescript
import { StateGraph } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { NexusStateAnnotation } from "./state.js";

/**
 * Nexus graph — minimal skeleton for Plan 1.
 *
 * This will be expanded in Plan 2 with:
 * - Meta-router node (prompt classifier)
 * - Orchestrator node (createDeepAgent)
 * - ConfigurableModel middleware
 *
 * For now, it's a simple echo agent that proves the LangGraph dev server
 * can boot with the Nexus graph registered.
 */
const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash",
  temperature: 0,
});

async function respond(
  state: typeof NexusStateAnnotation.State
): Promise<Partial<typeof NexusStateAnnotation.State>> {
  const response = await model.invoke(state.messages);
  return { messages: [response] };
}

const workflow = new StateGraph(NexusStateAnnotation)
  .addNode("respond", respond)
  .addEdge("__start__", "respond")
  .addEdge("respond", "__end__");

export const graph = workflow.compile();
```

- [ ] **Step 3: Verify the graph compiles**

Run:
```bash
cd apps/agents && npx tsx -e "
import('./src/nexus/graph.js').then(m => {
  console.log('Graph name:', m.graph.name);
  console.log('Graph nodes:', Object.keys(m.graph.nodes));
  console.log('Graph OK');
}).catch(e => { console.error(e); process.exit(1); });
" && cd ../..
```

Expected: Prints graph name, nodes list including "respond", and "Graph OK".

- [ ] **Step 4: Commit**

```bash
git add apps/agents/src/nexus/state.ts apps/agents/src/nexus/graph.ts
git commit -m "feat: add minimal Nexus graph skeleton with state annotation"
```

---

### Task 8: Update langgraph.json & Seed Memory

**Files:**
- Modify: `langgraph.json`
- Create: `apps/agents/src/memories/AGENTS.md`
- Create: `apps/agents/src/skills/` (empty directory)

- [ ] **Step 1: Update langgraph.json to register the Nexus graph**

Add the `nexus` graph entry. Keep the scaffold graphs temporarily (they'll be removed in Plan 2 when we delete `research-agent/`).

Edit `langgraph.json` — replace the `graphs` object:

```json
{
  "node_version": "20",
  "dependencies": ["."],
  "graphs": {
    "nexus": "./apps/agents/src/nexus/graph.ts:graph",
    "research_agent": "./apps/agents/src/research-agent/retrieval-graph/graph.ts:graph",
    "research_index_graph": "./apps/agents/src/research-agent/index-graph/graph.ts:graph"
  },
  "env": ".env"
}
```

- [ ] **Step 2: Create seed memory file**

Create `apps/agents/src/memories/AGENTS.md`:

```markdown
# Nexus Agent Memory

This file is loaded into the orchestrator's system prompt on every invocation.
The orchestrator updates it when it learns user preferences worth remembering.

## User Preferences

(none yet)

## Learned Patterns

(none yet)
```

- [ ] **Step 3: Create empty skills directory**

Run:
```bash
mkdir -p apps/agents/src/skills && touch apps/agents/src/skills/.gitkeep
```

- [ ] **Step 4: Verify `langgraph dev` can start with the new graph**

Run:
```bash
cd apps/agents && npx @langchain/langgraph-cli dev --port 2024 &
sleep 5
curl -s http://localhost:2024/info | head -20
kill %1 2>/dev/null
cd ../..
```

Expected: Server starts, `/info` endpoint returns JSON listing the `nexus` graph among available graphs.

- [ ] **Step 5: Commit**

```bash
git add langgraph.json apps/agents/src/memories/AGENTS.md apps/agents/src/skills/.gitkeep
git commit -m "feat: register nexus graph in langgraph.json, seed memory and skills dirs"
```

---

### Task 9: Vitest Configuration

**Files:**
- Create: `apps/agents/vitest.config.ts`
- Modify: `apps/agents/package.json` (add test script)

- [ ] **Step 1: Create vitest config**

Create `apps/agents/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    testTimeout: 30000, // Integration tests with sandbox need longer timeout
  },
});
```

- [ ] **Step 2: Install vitest**

Run:
```bash
cd apps/agents && npm install -D vitest && cd ../..
```

- [ ] **Step 3: Add test script to package.json**

Add to `apps/agents/package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Run all tests**

Run:
```bash
cd apps/agents && npm test && cd ../..
```

Expected: All tests in `__tests__/` directories pass (store and composite tests pass without Docker; sandbox tests need Docker running).

- [ ] **Step 5: Commit**

```bash
git add apps/agents/vitest.config.ts apps/agents/package.json
git commit -m "chore: add vitest config and test scripts for agents workspace"
```

---

### Task 10: End-to-End Verification

**Files:** None (verification only)

This task verifies the full foundation works together. **Requires AIO Sandbox Docker running.**

- [ ] **Step 1: Start the AIO Sandbox (if not already running)**

Run:
```bash
docker run --security-opt seccomp=unconfined --rm -d -p 8080:8080 ghcr.io/agent-infra/sandbox:latest
```

Wait for container to be ready:
```bash
sleep 10 && curl -s http://localhost:8080/v1/sandbox | head -5
```

Expected: JSON response with sandbox info.

- [ ] **Step 2: Verify AIOSandboxBackend can execute in the sandbox**

Run:
```bash
cd apps/agents && npx tsx -e "
import { AIOSandboxBackend } from './src/nexus/backend/aio-sandbox.js';

const sandbox = new AIOSandboxBackend('http://localhost:8080');

// Test execute
const result = await sandbox.execute('echo hello from nexus && whoami');
console.log('Execute output:', result.output.trim());
console.log('Exit code:', result.exitCode);

// Test workspace creation
await sandbox.execute('mkdir -p /home/gem/workspace/test');
await sandbox.execute('echo test > /home/gem/workspace/test/hello.txt');
const cat = await sandbox.execute('cat /home/gem/workspace/test/hello.txt');
console.log('File content:', cat.output.trim());

// Cleanup
await sandbox.execute('rm -rf /home/gem/workspace/test');
console.log('Sandbox verification OK');
" && cd ../..
```

Expected: "hello from nexus", exit code 0, file content "test", "Sandbox verification OK".

- [ ] **Step 3: Verify CompositeBackend wires sandbox + store**

Run:
```bash
cd apps/agents && npx tsx -e "
import { AIOSandboxBackend } from './src/nexus/backend/aio-sandbox.js';
import { createNexusBackend } from './src/nexus/backend/composite.js';

const sandbox = new AIOSandboxBackend('http://localhost:8080');
const backend = createNexusBackend(sandbox);

console.log('CompositeBackend created:', !!backend);
console.log('Backend verification OK');
" && cd ../..
```

Expected: "CompositeBackend created: true", "Backend verification OK".

- [ ] **Step 4: Verify the Nexus graph can be invoked**

Run:
```bash
cd apps/agents && npx tsx -e "
import { graph } from './src/nexus/graph.js';

const result = await graph.invoke({
  messages: [{ role: 'user', content: 'Say hello in exactly 3 words.' }]
});

const lastMsg = result.messages[result.messages.length - 1];
console.log('Response:', lastMsg.content);
console.log('Graph invocation OK');
" && cd ../..
```

Expected: A 3-word greeting response and "Graph invocation OK". (Requires `GEMINI_API_KEY` or Vertex AI credentials in `.env`.)

- [ ] **Step 5: Verify `langgraph dev` serves the nexus graph**

Run:
```bash
npm run dev &
sleep 10
curl -s http://localhost:2024/info
kill %1 2>/dev/null
```

Expected: JSON response listing `nexus` as an available graph.

- [ ] **Step 6: Final commit (if any test fixes were needed)**

```bash
git add -A
git status
# Only commit if there are changes from fixes
git commit -m "fix: address issues found during end-to-end verification"
```

---

## Verification Checklist

After completing all tasks, confirm:

1. `npm install` succeeds from root with no peer dep errors
2. `apps/agents/package.json` has `deepagents`, `@langchain/google-genai`, `@langchain/anthropic`, `@langchain/openai`, `@agent-infra/sandbox`, `better-sqlite3`, `drizzle-orm` — and does NOT have `@langchain/pinecone`, `@langchain/mongodb`, `@elastic/elasticsearch`, `mongodb`
3. `AIOSandboxBackend` can execute shell commands in AIO Sandbox Docker
4. `CompositeBackend` wires sandbox (default) + StoreBackend (/memories/)
5. SQLite database initializes at `data/nexus.db` with WAL mode
6. `langgraph.json` registers the `nexus` graph
7. `langgraph dev` boots and serves the nexus graph at `:2024`
8. The minimal graph responds to a prompt via Google Gemini

## What's Next

**Plan 2: Meta-Router & Orchestrator Core** builds on this foundation:
- Meta-router node classifies prompts (Flash model, structured output)
- ConfigurableModel middleware swaps orchestrator model at runtime
- Orchestrator created via `createDeepAgent()` with the CompositeBackend from this plan
- The skeleton `graph.ts` gets replaced with the full meta-router → orchestrator pipeline
