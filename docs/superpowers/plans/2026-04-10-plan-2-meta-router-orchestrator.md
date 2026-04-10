# Plan 2: Meta-Router & Orchestrator Core

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the meta-router (Flash classifier with structured output) and wire it into the Nexus orchestrator (`createDeepAgent`) so that user prompts are classified, the correct Gemini model is selected at runtime, and the orchestrator responds with full DeepAgents capabilities (todos, filesystem, subagent delegation).

**Architecture:** The main LangGraph graph has two nodes: `metaRouter` (always runs Flash, returns model choice via `withStructuredOutput`) and `orchestrator` (a `createDeepAgent` instance whose model is swapped at runtime via `ConfigurableModel` middleware reading from graph state). The meta-router writes its model selection to graph state; the orchestrator node reads it and passes it as `context` when invoking the DeepAgent. This avoids needing LangGraph-level context injection — state is the bridge.

**Tech Stack:** `deepagents` (`createDeepAgent`, `CompositeBackend`, `BaseSandbox`), `langchain` (`createMiddleware`, `initChatModel`), `@langchain/google-genai` (`ChatGoogleGenerativeAI`, `withStructuredOutput`), `@langchain/langgraph` (`StateGraph`, `Annotation`), `zod/v4`

**Relevant Skills:**
- `deep-agents-core` — createDeepAgent config, middleware, subagents
- `langchain-middleware` — createMiddleware, wrapModelCall pattern
- `langgraph-fundamentals` — StateGraph, conditional edges, state reducers
- `vertex-ai-api-dev` — Gemini model names, Vertex AI auth

**Relevant Docs:**
- `docs/langchain/deepagents/models.md` — ConfigurableModel middleware pattern
- `docs/langchain/deepagents/context.md` — contextSchema, runtime.context
- `docs/langchain/deepagents/overview.md` — createDeepAgent params
- `docs/langchain/langchain/models.md` — withStructuredOutput with Zod
- `docs/references/deepagents-reference.md` — Full API signatures

---

## Verified API Signatures

These were verified against the actual installed packages (`deepagents@1.9.0`, `langchain@1.3.1`):

```typescript
// From langchain
import { createMiddleware } from "langchain";
import { initChatModel } from "langchain/chat_models/universal";

// From deepagents
import { createDeepAgent, CompositeBackend, BaseSandbox, StoreBackend } from "deepagents";
// createDeepAgent accepts: { model, tools, systemPrompt, middleware, subagents,
//   responseFormat, contextSchema, checkpointer, store, backend, interruptOn,
//   name, memory, skills }

// createMiddleware accepts: { name, stateSchema?, contextSchema?, tools?,
//   wrapToolCall?, wrapModelCall?, beforeAgent?, afterAgent?, beforeModel?, afterModel? }
// wrapModelCall signature: (request, handler) => response
//   request contains: { model, messages, systemPrompt, tools, state, runtime }
//   handler accepts modified request

// initChatModel(modelName, options?) — async, returns ConfigurableModel
// Supported providers: google-genai, openai, anthropic, etc.

// SubAgent interface: { name, description, systemPrompt, tools?, model?,
//   middleware?, interruptOn?, skills?, responseFormat? }
```

---

## File Structure

```
apps/agents/src/nexus/
├── graph.ts                              # MODIFY: replace skeleton with meta-router → orchestrator
├── state.ts                              # MODIFY: add routerResult field to state
├── meta-router.ts                        # CREATE: Flash classifier with structured output
├── orchestrator.ts                       # CREATE: createDeepAgent config + node wrapper
├── middleware/
│   └── configurable-model.ts             # CREATE: ConfigurableModel middleware
├── prompts/
│   └── orchestrator-system.ts            # CREATE: orchestrator system prompt
├── __tests__/
│   ├── meta-router.test.ts               # CREATE: meta-router unit tests
│   ├── configurable-model.test.ts        # CREATE: middleware unit tests
│   ├── orchestrator.test.ts              # CREATE: orchestrator unit tests
│   └── graph.test.ts                     # MODIFY: update graph integration tests
└── backend/                              # KEEP: unchanged from Plan 1
    ├── aio-sandbox.ts
    ├── composite.ts
    └── store.ts
```

---

### Task 1: Extend Graph State with Router Result

**Files:**
- Modify: `apps/agents/src/nexus/state.ts`
- Create: `apps/agents/src/nexus/__tests__/state.test.ts`

The meta-router writes its classification result to graph state. The orchestrator node reads it to know which model to use. This is the bridge between the two nodes.

- [ ] **Step 1: Write the failing test**

Create `apps/agents/src/nexus/__tests__/state.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { NexusStateAnnotation } from "../state.js";

describe("NexusStateAnnotation", () => {
  it("should include messages field from MessagesAnnotation", () => {
    const spec = NexusStateAnnotation.spec;
    expect(spec).toHaveProperty("messages");
  });

  it("should include routerResult field", () => {
    const spec = NexusStateAnnotation.spec;
    expect(spec).toHaveProperty("routerResult");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/state.test.ts`
Expected: FAIL — `routerResult` does not exist yet.

- [ ] **Step 3: Update state.ts to add routerResult**

Replace `apps/agents/src/nexus/state.ts` with:

```typescript
import { Annotation, MessagesAnnotation } from "@langchain/langgraph";

/**
 * Router classification result written by the meta-router node.
 * Read by the orchestrator node to select the correct model at runtime.
 */
export interface RouterResult {
  /** The Gemini model name to use for the orchestrator */
  model: string;
  /** Brief reasoning for the model selection */
  reasoning: string;
}

/**
 * Nexus graph state.
 * - messages: conversation history (from MessagesAnnotation, with reducer)
 * - routerResult: meta-router's model classification (overwritten each turn)
 */
export const NexusStateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  routerResult: Annotation<RouterResult | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
});

export type NexusState = typeof NexusStateAnnotation.State;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/state.test.ts`
Expected: PASS — both fields exist.

- [ ] **Step 5: Commit**

```bash
git add apps/agents/src/nexus/state.ts apps/agents/src/nexus/__tests__/state.test.ts
git commit -m "feat(state): add routerResult field for meta-router → orchestrator bridge"
```

---

### Task 2: Meta-Router — Structured Output Classifier

**Files:**
- Create: `apps/agents/src/nexus/meta-router.ts`
- Create: `apps/agents/src/nexus/__tests__/meta-router.test.ts`

The meta-router is a single fast LLM call using `gemini-2.0-flash` with `withStructuredOutput`. It classifies the user's prompt and returns a model selection. It is a LangGraph node function, NOT a separate agent.

- [ ] **Step 1: Write the failing test**

Create `apps/agents/src/nexus/__tests__/meta-router.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { routerOutputSchema, metaRouter } from "../meta-router.js";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod/v4";

describe("routerOutputSchema", () => {
  it("should accept valid Flash classification", () => {
    const result = z.safeParse(routerOutputSchema, {
      model: "gemini-2.0-flash",
      reasoning: "Simple question, single-step",
    });
    expect(result.success).toBe(true);
  });

  it("should accept valid Pro classification", () => {
    const result = z.safeParse(routerOutputSchema, {
      model: "gemini-2.5-pro-preview-05-06",
      reasoning: "Complex multi-step project",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid model names", () => {
    const result = z.safeParse(routerOutputSchema, {
      model: "gpt-4",
      reasoning: "Not a valid Gemini model",
    });
    expect(result.success).toBe(false);
  });
});

describe("metaRouter", () => {
  it("should be a function that accepts NexusState", () => {
    expect(typeof metaRouter).toBe("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/meta-router.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create meta-router.ts**

Create `apps/agents/src/nexus/meta-router.ts`:

```typescript
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { z } from "zod/v4";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { NexusState } from "./state.js";

/**
 * Structured output schema for the meta-router.
 * Constrains model selection to the two supported Gemini models.
 */
export const routerOutputSchema = z.object({
  model: z
    .enum(["gemini-2.0-flash", "gemini-2.5-pro-preview-05-06"])
    .describe("The Gemini model to use for the orchestrator"),
  reasoning: z
    .string()
    .describe("Brief reasoning for the model selection (1-2 sentences)"),
});

export type RouterOutput = z.infer<typeof routerOutputSchema>;

const ROUTER_SYSTEM_PROMPT = `You are a silent request classifier. Your job is to analyze the user's prompt and decide which Gemini model should handle it.

Classification criteria:
- Intent complexity: Single-step task vs multi-step project
- Implied scope: Even vague prompts like "build me something cool" imply a large project requiring Pro
- Domain signals: Research-heavy, code-heavy, creative, or multi-domain
- Clarity: Specific enough to act on directly, or requires sophisticated planning

Model selection:
- "gemini-2.0-flash" — Simple, single-domain tasks. Quick answers, single sub-agent or no sub-agents needed. Examples: "What is X?", "Summarize this article", "Convert this CSV to JSON"
- "gemini-2.5-pro-preview-05-06" — Complex, multi-step, multi-domain tasks. Requires sophisticated planning, multiple sub-agents, or quality decomposition. Examples: "Build me a website", "Research X and write a report with visualizations", "Create a marketing campaign"

When in doubt, choose Pro. It's better to over-provision than under-provision.

Respond ONLY with the structured output. Do not include any other text.`;

/**
 * Meta-router LangGraph node.
 *
 * Always uses gemini-2.0-flash (fast, cheap) to classify the user's prompt.
 * Returns { routerResult } to be written to graph state.
 */
export async function metaRouter(
  state: NexusState,
): Promise<Pick<NexusState, "routerResult">> {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.0-flash",
    temperature: 0,
  });

  const structuredModel = model.withStructuredOutput(routerOutputSchema, {
    name: "RouterOutput",
  });

  const lastMessage = state.messages[state.messages.length - 1];
  const userContent =
    typeof lastMessage.content === "string"
      ? lastMessage.content
      : JSON.stringify(lastMessage.content);

  const result = await structuredModel.invoke([
    new SystemMessage(ROUTER_SYSTEM_PROMPT),
    new HumanMessage(userContent),
  ]);

  return {
    routerResult: {
      model: result.model,
      reasoning: result.reasoning,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/meta-router.test.ts`
Expected: PASS — schema validation tests pass, function exists.

- [ ] **Step 5: Commit**

```bash
git add apps/agents/src/nexus/meta-router.ts apps/agents/src/nexus/__tests__/meta-router.test.ts
git commit -m "feat(meta-router): add Flash classifier with structured output schema"
```

---

### Task 3: ConfigurableModel Middleware

**Files:**
- Create: `apps/agents/src/nexus/middleware/configurable-model.ts`
- Create: `apps/agents/src/nexus/__tests__/configurable-model.test.ts`

This middleware intercepts model calls and swaps the model based on `runtime.context.model`. It uses `createMiddleware` from `langchain` with `wrapModelCall`.

- [ ] **Step 1: Write the failing test**

Create `apps/agents/src/nexus/__tests__/configurable-model.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  configurableModelMiddleware,
  modelContextSchema,
} from "../middleware/configurable-model.js";
import { z } from "zod/v4";

describe("modelContextSchema", () => {
  it("should accept a valid model string", () => {
    const result = z.safeParse(modelContextSchema, {
      model: "gemini-2.0-flash",
    });
    expect(result.success).toBe(true);
  });

  it("should accept context without model (optional)", () => {
    const result = z.safeParse(modelContextSchema, {});
    expect(result.success).toBe(true);
  });
});

describe("configurableModelMiddleware", () => {
  it("should be an AgentMiddleware object", () => {
    expect(configurableModelMiddleware).toBeDefined();
    // AgentMiddleware has a brand symbol, but we can check it's an object
    expect(typeof configurableModelMiddleware).toBe("object");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/configurable-model.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the middleware directory and file**

Run: `mkdir -p apps/agents/src/nexus/middleware`

Create `apps/agents/src/nexus/middleware/configurable-model.ts`:

```typescript
import { createMiddleware } from "langchain";
import { initChatModel } from "langchain/chat_models/universal";
import { z } from "zod/v4";

/**
 * Context schema for model selection.
 * The `model` field is optional — when absent, the default model is used.
 */
export const modelContextSchema = z.object({
  model: z.string().optional().describe("Model name to use (e.g., 'google-genai:gemini-2.0-flash')"),
});

/**
 * ConfigurableModel middleware.
 *
 * Intercepts every model call and swaps the model if `runtime.context.model` is set.
 * Uses `initChatModel` from langchain to dynamically resolve the model by name.
 *
 * Usage: Pass as middleware to createDeepAgent, and invoke the agent with
 * `{ context: { model: "google-genai:gemini-2.0-flash" } }` to override.
 */
export const configurableModelMiddleware = createMiddleware({
  name: "ConfigurableModel",
  contextSchema: modelContextSchema,
  wrapModelCall: async (request, handler) => {
    const modelName = request.runtime.context?.model;
    if (!modelName) {
      // No model override — use the default
      return handler(request);
    }
    const model = await initChatModel(modelName);
    return handler({ ...request, model });
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/configurable-model.test.ts`
Expected: PASS — schema validates, middleware is defined.

- [ ] **Step 5: Commit**

```bash
git add apps/agents/src/nexus/middleware/configurable-model.ts apps/agents/src/nexus/__tests__/configurable-model.test.ts
git commit -m "feat(middleware): add ConfigurableModel middleware for runtime model swapping"
```

---

### Task 4: Orchestrator System Prompt

**Files:**
- Create: `apps/agents/src/nexus/prompts/orchestrator-system.ts`
- Create: `apps/agents/src/nexus/__tests__/orchestrator-system.test.ts`

The orchestrator needs a carefully crafted system prompt that defines its role, delegation guidelines, workspace conventions, and output format.

- [ ] **Step 1: Write the failing test**

Create `apps/agents/src/nexus/__tests__/orchestrator-system.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { ORCHESTRATOR_SYSTEM_PROMPT } from "../prompts/orchestrator-system.js";

describe("ORCHESTRATOR_SYSTEM_PROMPT", () => {
  it("should be a non-empty string", () => {
    expect(typeof ORCHESTRATOR_SYSTEM_PROMPT).toBe("string");
    expect(ORCHESTRATOR_SYSTEM_PROMPT.length).toBeGreaterThan(100);
  });

  it("should mention workspace convention", () => {
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("/home/gem/workspace/");
  });

  it("should mention sub-agent delegation via task tool", () => {
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("task");
  });

  it("should mention write_todos for planning", () => {
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("write_todos");
  });

  it("should instruct concise sub-agent responses", () => {
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("500");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/orchestrator-system.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the prompts directory and file**

Run: `mkdir -p apps/agents/src/nexus/prompts`

Create `apps/agents/src/nexus/prompts/orchestrator-system.ts`:

```typescript
/**
 * Nexus Orchestrator system prompt.
 *
 * Combined with DeepAgents' base prompt (planning, filesystem, sub-agent instructions),
 * memory content, skills frontmatter, and sub-agent descriptions at runtime.
 *
 * This prompt defines Nexus-specific behavior on top of the DeepAgents foundation.
 */
export const ORCHESTRATOR_SYSTEM_PROMPT = `You are Nexus, an AI orchestrator that takes a user's prompt, plans the work, and delegates to specialized sub-agents.

## Your Role
- Analyze the user's request to understand intent, scope, and domains involved
- Create a structured plan using write_todos before delegating work
- Delegate specialized work to sub-agents via the task tool
- Synthesize sub-agent results into a cohesive final deliverable
- Write final outputs to /home/gem/workspace/shared/

## Assessing Requests
1. If the request is vague or ambiguous, ask for clarification. Do NOT spawn sub-agents for unclear tasks.
2. If the request is clear and single-domain, you may handle it directly or delegate to one sub-agent.
3. If the request is multi-step or multi-domain, create a plan with write_todos, then delegate.

## Delegation Guidelines
- Use the task tool to spawn sub-agents. Specify the sub-agent type and a detailed task description.
- Each sub-agent works in isolation with its own context. Provide all necessary information in the task description.
- Tell sub-agents where to write their outputs: /home/gem/workspace/{research|code|creative}/task_{id}/
- Sub-agents should return concise summaries (under 500 words). Detailed data goes to the filesystem.
- You can read any file in the workspace to check sub-agent outputs before synthesizing.

## Workspace Convention
All agents share the AIO Sandbox filesystem at /home/gem/workspace/:
- /home/gem/workspace/research/task_{id}/ — Research sub-agent outputs
- /home/gem/workspace/code/task_{id}/ — Code sub-agent outputs
- /home/gem/workspace/creative/task_{id}/ — Creative sub-agent outputs
- /home/gem/workspace/orchestrator/ — Your scratch space
- /home/gem/workspace/shared/ — Final assembled deliverables

## Output Format
- For simple answers: respond directly in the conversation
- For complex deliverables: write to /home/gem/workspace/shared/ and summarize what was produced
- Always be concise in conversation messages. Long content belongs in files.`;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/orchestrator-system.test.ts`
Expected: PASS — all content assertions match.

- [ ] **Step 5: Commit**

```bash
git add apps/agents/src/nexus/prompts/orchestrator-system.ts apps/agents/src/nexus/__tests__/orchestrator-system.test.ts
git commit -m "feat(prompts): add orchestrator system prompt with delegation and workspace guidelines"
```

---

### Task 5: Orchestrator — createDeepAgent Configuration

**Files:**
- Create: `apps/agents/src/nexus/orchestrator.ts`
- Create: `apps/agents/src/nexus/__tests__/orchestrator.test.ts`

The orchestrator wraps `createDeepAgent` with the Nexus-specific configuration: system prompt, ConfigurableModel middleware, CompositeBackend, memory paths, and skills paths. It also provides a LangGraph node wrapper function that reads `routerResult` from state and passes it as context.

- [ ] **Step 1: Write the failing test**

Create `apps/agents/src/nexus/__tests__/orchestrator.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createNexusOrchestrator, orchestratorNode } from "../orchestrator.js";

describe("createNexusOrchestrator", () => {
  it("should be a function", () => {
    expect(typeof createNexusOrchestrator).toBe("function");
  });
});

describe("orchestratorNode", () => {
  it("should be a function that accepts state", () => {
    expect(typeof orchestratorNode).toBe("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/orchestrator.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create orchestrator.ts**

Create `apps/agents/src/nexus/orchestrator.ts`:

```typescript
import { createDeepAgent } from "deepagents";
import { AIOSandboxBackend } from "./backend/aio-sandbox.js";
import { createNexusBackend } from "./backend/composite.js";
import { configurableModelMiddleware } from "./middleware/configurable-model.js";
import { ORCHESTRATOR_SYSTEM_PROMPT } from "./prompts/orchestrator-system.js";
import type { NexusState } from "./state.js";

/**
 * Creates the Nexus orchestrator DeepAgent.
 *
 * The orchestrator is the central brain — it receives user prompts,
 * plans work via write_todos, and delegates to specialized sub-agents.
 *
 * Model is selected at runtime via ConfigurableModel middleware,
 * based on the meta-router's classification in graph state.
 *
 * @param sandboxUrl - URL of the AIO Sandbox Docker container (default: http://localhost:8080)
 */
export function createNexusOrchestrator(sandboxUrl = "http://localhost:8080") {
  const sandbox = new AIOSandboxBackend(sandboxUrl);
  const backend = createNexusBackend(sandbox);

  return createDeepAgent({
    name: "nexus-orchestrator",
    model: "google-genai:gemini-2.0-flash",
    systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT,
    middleware: [configurableModelMiddleware] as const,
    backend,
    memory: ["/memories/AGENTS.md"],
    skills: ["/skills/"],
  });
}

// Lazy singleton — initialized on first invocation
let orchestratorInstance: ReturnType<typeof createNexusOrchestrator> | null =
  null;

function getOrchestrator() {
  if (!orchestratorInstance) {
    orchestratorInstance = createNexusOrchestrator();
  }
  return orchestratorInstance;
}

/**
 * LangGraph node wrapper for the orchestrator.
 *
 * Reads routerResult from graph state and passes the selected model
 * as runtime context to the DeepAgent. This is the bridge between
 * the meta-router's classification and the ConfigurableModel middleware.
 */
export async function orchestratorNode(
  state: NexusState,
): Promise<Partial<NexusState>> {
  const orchestrator = getOrchestrator();

  // Build the model name with provider prefix for initChatModel
  const selectedModel = state.routerResult?.model;
  const modelWithProvider = selectedModel
    ? `google-genai:${selectedModel}`
    : undefined;

  const result = await orchestrator.invoke(
    { messages: state.messages },
    {
      context: { model: modelWithProvider },
    },
  );

  return { messages: result.messages };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/orchestrator.test.ts`
Expected: PASS — both exports are functions.

- [ ] **Step 5: Commit**

```bash
git add apps/agents/src/nexus/orchestrator.ts apps/agents/src/nexus/__tests__/orchestrator.test.ts
git commit -m "feat(orchestrator): add createDeepAgent config with ConfigurableModel middleware"
```

---

### Task 6: Wire Main Graph — Meta-Router → Orchestrator

**Files:**
- Modify: `apps/agents/src/nexus/graph.ts`
- Modify: `apps/agents/src/nexus/__tests__/graph.test.ts`

Replace the Plan 1 skeleton graph with the real two-node pipeline: `__start__` → `metaRouter` → `orchestrator` → `__end__`.

- [ ] **Step 1: Write the failing test**

Replace `apps/agents/src/nexus/__tests__/graph.test.ts` with:

```typescript
import { describe, it, expect } from "vitest";
import { graph } from "../graph.js";

describe("Nexus graph", () => {
  it("should be a compiled graph", () => {
    expect(graph).toBeDefined();
    // Compiled graphs have invoke and stream methods
    expect(typeof graph.invoke).toBe("function");
    expect(typeof graph.stream).toBe("function");
  });

  it("should have metaRouter and orchestrator nodes", () => {
    // CompiledGraph exposes nodes via getGraph()
    const graphDef = graph.getGraph();
    const nodeIds = graphDef.nodes.map((n: { id: string }) => n.id);
    expect(nodeIds).toContain("metaRouter");
    expect(nodeIds).toContain("orchestrator");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/graph.test.ts`
Expected: FAIL — old graph only has "respond" node, not "metaRouter" and "orchestrator".

- [ ] **Step 3: Replace graph.ts with the real pipeline**

Replace `apps/agents/src/nexus/graph.ts` with:

```typescript
import { StateGraph } from "@langchain/langgraph";
import { NexusStateAnnotation } from "./state.js";
import { metaRouter } from "./meta-router.js";
import { orchestratorNode } from "./orchestrator.js";

/**
 * Nexus main graph.
 *
 * Pipeline: __start__ → metaRouter → orchestrator → __end__
 *
 * 1. metaRouter: Fast Flash classifier that selects the orchestrator model
 * 2. orchestrator: DeepAgent that plans, delegates, and synthesizes
 *
 * The meta-router writes routerResult to state. The orchestrator node
 * reads it and passes it as context to the ConfigurableModel middleware.
 */
const workflow = new StateGraph(NexusStateAnnotation)
  .addNode("metaRouter", metaRouter)
  .addNode("orchestrator", orchestratorNode)
  .addEdge("__start__", "metaRouter")
  .addEdge("metaRouter", "orchestrator")
  .addEdge("orchestrator", "__end__");

export const graph = workflow.compile();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/graph.test.ts`
Expected: PASS — graph compiles, both nodes present.

Note: The `getGraph()` API may differ — if it doesn't expose nodes in that format, adjust the test to check `graph.getGraph().nodes` structure. The compiled graph object is what matters.

- [ ] **Step 5: Commit**

```bash
git add apps/agents/src/nexus/graph.ts apps/agents/src/nexus/__tests__/graph.test.ts
git commit -m "feat(graph): wire meta-router → orchestrator pipeline in main graph"
```

---

### Task 7: Remove Scaffold Research Agent

**Files:**
- Modify: `langgraph.json`
- Delete: `apps/agents/src/research-agent/` (entire directory)

Plan 1 kept the scaffold research agent temporarily. Now that the Nexus graph is the primary entry point, remove the scaffold.

- [ ] **Step 1: Verify the scaffold research agent still exists**

Run: `ls apps/agents/src/research-agent/`
Expected: Directory exists with scaffold files.

Run: `cat langgraph.json`
Expected: Contains `research_agent` and `research_index_graph` entries.

- [ ] **Step 2: Remove scaffold graph registrations from langgraph.json**

Update `langgraph.json` to:

```json
{
  "node_version": "20",
  "dependencies": [
    "."
  ],
  "graphs": {
    "nexus": "./apps/agents/src/nexus/graph.ts:graph"
  },
  "env": ".env"
}
```

- [ ] **Step 3: Delete the scaffold research agent directory**

Run: `rm -rf apps/agents/src/research-agent`

- [ ] **Step 4: Verify no imports reference the deleted files**

Run: `cd apps/agents && grep -r "research-agent" src/ --include="*.ts" || echo "No references found"`
Expected: "No references found"

- [ ] **Step 5: Run all existing tests to ensure nothing breaks**

Run: `cd apps/agents && npx vitest run`
Expected: All tests pass (no test referenced the scaffold).

- [ ] **Step 6: Commit**

```bash
git add langgraph.json
git rm -rf apps/agents/src/research-agent/
git commit -m "chore: remove scaffold research agent, nexus is now the sole graph"
```

---

### Task 8: Integration Test — Full Pipeline Smoke Test

**Files:**
- Create: `apps/agents/src/nexus/__tests__/integration.test.ts`

This test verifies the full pipeline: prompt → meta-router classifies → orchestrator responds. Requires Gemini API key but NOT the Docker sandbox (orchestrator will fail on sandbox-dependent tools, but the model call itself should work).

**Important:** This test hits real APIs and costs money. It should be skipped in CI and only run manually.

- [ ] **Step 1: Write the integration test**

Create `apps/agents/src/nexus/__tests__/integration.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { routerOutputSchema, metaRouter } from "../meta-router.js";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod/v4";

/**
 * Integration tests that hit the real Gemini API.
 * Requires GOOGLE_API_KEY or Vertex AI credentials.
 * Skip with: npx vitest run --exclude '**/integration*'
 */
describe("Meta-Router Integration", () => {
  it("should classify a simple question as Flash", async () => {
    const state = {
      messages: [new HumanMessage("What is the capital of France?")],
      routerResult: null,
    };

    const result = await metaRouter(state);

    expect(result.routerResult).not.toBeNull();
    expect(result.routerResult!.model).toBe("gemini-2.0-flash");
    expect(result.routerResult!.reasoning).toBeTruthy();
  }, 30000);

  it("should classify a complex project as Pro", async () => {
    const state = {
      messages: [
        new HumanMessage(
          "Build me a full-stack web application with user authentication, a dashboard with real-time charts, and deploy it to production",
        ),
      ],
      routerResult: null,
    };

    const result = await metaRouter(state);

    expect(result.routerResult).not.toBeNull();
    expect(result.routerResult!.model).toBe("gemini-2.5-pro-preview-05-06");
    expect(result.routerResult!.reasoning).toBeTruthy();
  }, 30000);

  it("should return valid schema-conformant output", async () => {
    const state = {
      messages: [new HumanMessage("Help me debug this Python error")],
      routerResult: null,
    };

    const result = await metaRouter(state);
    const parsed = z.safeParse(routerOutputSchema, result.routerResult);
    expect(parsed.success).toBe(true);
  }, 30000);
});
```

- [ ] **Step 2: Run the integration test (requires API key)**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/integration.test.ts`
Expected: PASS — all 3 tests pass (may take 10-20 seconds due to API calls).

If no API key is configured, tests will fail with auth errors — that's expected in environments without credentials.

- [ ] **Step 3: Commit**

```bash
git add apps/agents/src/nexus/__tests__/integration.test.ts
git commit -m "test(integration): add meta-router API integration tests"
```

---

### Task 9: Run All Tests and Verify

**Files:** None (verification only)

Run the full test suite and verify everything works together.

- [ ] **Step 1: Run all unit tests (exclude integration)**

Run: `cd apps/agents && npx vitest run --exclude '**/integration*'`
Expected: All unit tests pass:
- `state.test.ts` — 2 tests
- `meta-router.test.ts` — 4 tests
- `configurable-model.test.ts` — 3 tests
- `orchestrator-system.test.ts` — 5 tests
- `orchestrator.test.ts` — 2 tests
- `graph.test.ts` — 2 tests
- `store.test.ts` — 1 test (from Plan 1)
- `composite.test.ts` — 1 test (from Plan 1)

- [ ] **Step 2: Verify graph compiles and langgraph.json is valid**

Run: `cat langgraph.json | node -e "const fs=require('fs'); const j=JSON.parse(fs.readFileSync('/dev/stdin','utf8')); console.log('Graphs:', Object.keys(j.graphs)); console.log('Valid JSON: true')"`

Expected:
```
Graphs: [ 'nexus' ]
Valid JSON: true
```

- [ ] **Step 3: Verify file structure matches plan**

Run: `find apps/agents/src/nexus -name "*.ts" | sort`
Expected:
```
apps/agents/src/nexus/__tests__/configurable-model.test.ts
apps/agents/src/nexus/__tests__/graph.test.ts
apps/agents/src/nexus/__tests__/integration.test.ts
apps/agents/src/nexus/__tests__/meta-router.test.ts
apps/agents/src/nexus/__tests__/orchestrator-system.test.ts
apps/agents/src/nexus/__tests__/orchestrator.test.ts
apps/agents/src/nexus/__tests__/state.test.ts
apps/agents/src/nexus/backend/aio-sandbox.ts
apps/agents/src/nexus/backend/composite.ts
apps/agents/src/nexus/backend/store.ts
apps/agents/src/nexus/db/index.ts
apps/agents/src/nexus/db/schema.ts
apps/agents/src/nexus/graph.ts
apps/agents/src/nexus/meta-router.ts
apps/agents/src/nexus/middleware/configurable-model.ts
apps/agents/src/nexus/orchestrator.ts
apps/agents/src/nexus/prompts/orchestrator-system.ts
apps/agents/src/nexus/state.ts
```

- [ ] **Step 4: Verify no scaffold references remain**

Run: `grep -r "research-agent\|research_agent\|research_index" apps/agents/src/ langgraph.json --include="*.ts" --include="*.json" || echo "Clean — no scaffold references"`
Expected: "Clean — no scaffold references"

---

## Verification Checklist

After all tasks are complete, verify:

| Requirement | How to verify |
|---|---|
| Meta-router classifies prompts | Integration test passes (Task 8) |
| Meta-router uses Flash always | Check `meta-router.ts` — hardcoded `gemini-2.0-flash` |
| Router returns structured output | Schema test + integration test |
| ConfigurableModel swaps model at runtime | Middleware test + code review |
| Orchestrator uses createDeepAgent | Check `orchestrator.ts` imports |
| Orchestrator has CompositeBackend | Check `createNexusOrchestrator` — uses `createNexusBackend` |
| Orchestrator has memory + skills paths | Check createDeepAgent params |
| Graph wires meta-router → orchestrator | Graph test checks both nodes |
| langgraph.json only has nexus | Task 7 verification step |
| Scaffold research agent removed | Task 7 grep verification |
| All unit tests pass | Task 9 full test run |
