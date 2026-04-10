# Plan 4: Sub-Agents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define and wire Research, Code, and Creative sub-agents into the Nexus orchestrator so it can delegate specialized work via DeepAgents' `task` tool.

**Architecture:** Each sub-agent is a `SubAgent` config object (name, description, systemPrompt, tools, model) passed to `createDeepAgent({ subagents })`. Sub-agents share the AIO Sandbox filesystem but have isolated conversation context. The orchestrator spawns them via the auto-provisioned `task` tool. A general-purpose subagent override (`name: "general-purpose"`) prevents DeepAgents from adding an unwanted default agent.

**Tech Stack:** DeepAgents `SubAgent` interface, `createDeepAgent`, Gemini models (`gemini-3.1-pro-preview` for Research/Code, `gemini-3.1-flash-image-preview` for Creative), existing custom tools from Plan 3 (`researchTools`, `creativeTools`), Zod v4, Vitest.

---

## File Structure

```
apps/agents/src/nexus/
├── agents/                          ← NEW: Sub-agent definitions
│   ├── research/
│   │   ├── prompt.ts                ← Research system prompt + description constants
│   │   └── agent.ts                 ← Research SubAgent config
│   ├── code/
│   │   ├── prompt.ts                ← Code system prompt + description constants
│   │   └── agent.ts                 ← Code SubAgent config
│   ├── creative/
│   │   ├── prompt.ts                ← Creative system prompt + description constants
│   │   └── agent.ts                 ← Creative SubAgent config
│   ├── general-purpose/
│   │   └── agent.ts                 ← GP override (minimal, disables default)
│   └── index.ts                     ← Barrel export with grouped arrays
├── orchestrator.ts                  ← MODIFY: Wire subagents into createDeepAgent
├── prompts/
│   └── orchestrator-system.ts       ← MODIFY: Add sub-agent delegation details
└── __tests__/
    ├── research-agent.test.ts       ← NEW: Research agent unit tests
    ├── code-agent.test.ts           ← NEW: Code agent unit tests
    ├── creative-agent.test.ts       ← NEW: Creative agent unit tests
    ├── agents-index.test.ts         ← NEW: Barrel export tests
    └── orchestrator-subagents.test.ts ← NEW: Orchestrator wiring tests
```

---

### Task 1: Research Sub-Agent

**Files:**
- Create: `apps/agents/src/nexus/agents/research/prompt.ts`
- Create: `apps/agents/src/nexus/agents/research/agent.ts`
- Test: `apps/agents/src/nexus/__tests__/research-agent.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/agents/src/nexus/__tests__/research-agent.test.ts
import { describe, it, expect } from "vitest";
import {
  RESEARCH_AGENT_NAME,
  RESEARCH_AGENT_DESCRIPTION,
  RESEARCH_SYSTEM_PROMPT,
} from "../agents/research/prompt.js";
import { researchAgent } from "../agents/research/agent.js";

describe("Research Agent prompt", () => {
  it("should export RESEARCH_AGENT_NAME as 'research'", () => {
    expect(RESEARCH_AGENT_NAME).toBe("research");
  });

  it("should export a non-empty RESEARCH_AGENT_DESCRIPTION", () => {
    expect(RESEARCH_AGENT_DESCRIPTION.length).toBeGreaterThan(20);
  });

  it("should export a non-empty RESEARCH_SYSTEM_PROMPT", () => {
    expect(RESEARCH_SYSTEM_PROMPT.length).toBeGreaterThan(100);
  });

  it("should include workspace path in system prompt", () => {
    expect(RESEARCH_SYSTEM_PROMPT).toContain("/home/gem/workspace/research/");
  });

  it("should instruct concise summaries in system prompt", () => {
    expect(RESEARCH_SYSTEM_PROMPT).toContain("500");
  });
});

describe("Research Agent config", () => {
  it("should have name matching RESEARCH_AGENT_NAME", () => {
    expect(researchAgent.name).toBe("research");
  });

  it("should have a description", () => {
    expect(researchAgent.description).toBeTruthy();
  });

  it("should have a systemPrompt", () => {
    expect(researchAgent.systemPrompt).toBeTruthy();
  });

  it("should have exactly 3 tools (tavily_search, tavily_extract, tavily_map)", () => {
    expect(researchAgent.tools).toHaveLength(3);
    const toolNames = researchAgent.tools!.map((t) => t.name);
    expect(toolNames).toContain("tavily_search");
    expect(toolNames).toContain("tavily_extract");
    expect(toolNames).toContain("tavily_map");
  });

  it("should use gemini-3.1-pro-preview model", () => {
    expect(researchAgent.model).toBe("google-genai:gemini-3.1-pro-preview");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/research-agent.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Create the prompt file**

```typescript
// apps/agents/src/nexus/agents/research/prompt.ts

export const RESEARCH_AGENT_NAME = "research";

export const RESEARCH_AGENT_DESCRIPTION =
  "Research sub-agent that searches the web, extracts content from URLs, and maps site structures " +
  "using Tavily. Use for finding current information, gathering sources, synthesizing research " +
  "findings, and building knowledge bases. Returns concise summaries with sources cited.";

export const RESEARCH_SYSTEM_PROMPT = `You are a Research sub-agent for Nexus. Your job is to find, extract, and synthesize information from the web.

## Tools
- **tavily_search**: Search the web for current information. Use topic filters (general/news/finance) and time_range for recency.
- **tavily_extract**: Extract detailed content from specific URLs. Use when you need the full text of a page.
- **tavily_map**: Discover the URL structure of a website. Use before deep extraction to understand what pages exist.

## Workflow
1. Start with tavily_search to find relevant sources
2. Use tavily_map to understand site structures when exploring documentation or multi-page sites
3. Use tavily_extract to get detailed content from the most relevant URLs
4. Synthesize findings into a structured summary

## Output Requirements
- Write all outputs to \`/home/gem/workspace/research/task_{id}/\`
- Create \`findings.md\` — synthesized summary with key insights
- Create \`sources.json\` — structured source list: \`[{ "title": "...", "url": "...", "relevance": "..." }]\`
- Store raw extracted data in \`raw/\` subdirectory if needed
- Return a concise summary (under 500 words) to the orchestrator — full data goes in the filesystem
- Always cite sources with URLs

## Guidelines
- Prefer multiple targeted searches over one broad search
- Use "advanced" search_depth when you need detailed, multi-chunk results
- Cross-reference findings across multiple sources for accuracy
- If a search returns insufficient results, try rephrasing the query or using different topic filters
- You can read files from any path in /home/gem/workspace/ to understand context from other agents`;
```

- [ ] **Step 4: Create the agent config file**

```typescript
// apps/agents/src/nexus/agents/research/agent.ts
import type { SubAgent } from "deepagents";
import { researchTools } from "../../tools/index.js";
import {
  RESEARCH_AGENT_NAME,
  RESEARCH_AGENT_DESCRIPTION,
  RESEARCH_SYSTEM_PROMPT,
} from "./prompt.js";

export const researchAgent: SubAgent = {
  name: RESEARCH_AGENT_NAME,
  description: RESEARCH_AGENT_DESCRIPTION,
  systemPrompt: RESEARCH_SYSTEM_PROMPT,
  tools: [...researchTools],
  model: "google-genai:gemini-3.1-pro-preview",
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/research-agent.test.ts`
Expected: PASS — all 11 tests green

- [ ] **Step 6: Commit**

```bash
git add apps/agents/src/nexus/agents/research/prompt.ts apps/agents/src/nexus/agents/research/agent.ts apps/agents/src/nexus/__tests__/research-agent.test.ts
git commit -m "feat(agents): add research sub-agent with Tavily tools"
```

---

### Task 2: Code Sub-Agent

**Files:**
- Create: `apps/agents/src/nexus/agents/code/prompt.ts`
- Create: `apps/agents/src/nexus/agents/code/agent.ts`
- Test: `apps/agents/src/nexus/__tests__/code-agent.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/agents/src/nexus/__tests__/code-agent.test.ts
import { describe, it, expect } from "vitest";
import {
  CODE_AGENT_NAME,
  CODE_AGENT_DESCRIPTION,
  CODE_SYSTEM_PROMPT,
} from "../agents/code/prompt.js";
import { codeAgent } from "../agents/code/agent.js";

describe("Code Agent prompt", () => {
  it("should export CODE_AGENT_NAME as 'code'", () => {
    expect(CODE_AGENT_NAME).toBe("code");
  });

  it("should export a non-empty CODE_AGENT_DESCRIPTION", () => {
    expect(CODE_AGENT_DESCRIPTION.length).toBeGreaterThan(20);
  });

  it("should export a non-empty CODE_SYSTEM_PROMPT", () => {
    expect(CODE_SYSTEM_PROMPT.length).toBeGreaterThan(100);
  });

  it("should include workspace path in system prompt", () => {
    expect(CODE_SYSTEM_PROMPT).toContain("/home/gem/workspace/code/");
  });

  it("should mention execute tool in system prompt", () => {
    expect(CODE_SYSTEM_PROMPT).toContain("execute");
  });

  it("should instruct concise summaries in system prompt", () => {
    expect(CODE_SYSTEM_PROMPT).toContain("500");
  });
});

describe("Code Agent config", () => {
  it("should have name matching CODE_AGENT_NAME", () => {
    expect(codeAgent.name).toBe("code");
  });

  it("should have a description", () => {
    expect(codeAgent.description).toBeTruthy();
  });

  it("should have a systemPrompt", () => {
    expect(codeAgent.systemPrompt).toBeTruthy();
  });

  it("should have no custom tools (uses auto-provisioned execute + filesystem)", () => {
    expect(codeAgent.tools).toBeUndefined();
  });

  it("should use gemini-3.1-pro-preview model", () => {
    expect(codeAgent.model).toBe("google-genai:gemini-3.1-pro-preview");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/code-agent.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Create the prompt file**

```typescript
// apps/agents/src/nexus/agents/code/prompt.ts

export const CODE_AGENT_NAME = "code";

export const CODE_AGENT_DESCRIPTION =
  "Code sub-agent that writes, runs, and debugs code in a sandboxed environment. " +
  "Has access to a full Linux shell via execute, plus filesystem tools. " +
  "Use for building applications, writing scripts, processing data, formatting documents, " +
  "and any task requiring code execution.";

export const CODE_SYSTEM_PROMPT = `You are a Code sub-agent for Nexus. Your job is to write, execute, and debug code in the AIO Sandbox environment.

## Tools
You have access to the sandbox's auto-provisioned tools:
- **execute**: Run shell commands (install packages, run scripts, compile, test)
- **Filesystem tools**: ls, read_file, write_file, edit_file, glob, grep

## Workflow
1. Read any input files or context from the workspace paths provided in your task description
2. Plan your approach — create files, install dependencies, write code
3. Execute and iterate — run your code, read errors, fix issues, retry
4. Write a build log summarizing what was built

## Output Requirements
- Write all outputs to \`/home/gem/workspace/code/task_{id}/\`
- Create a \`build-log.md\` summarizing: what was built, how to run it, dependencies installed, any known issues
- Return a concise summary (under 500 words) to the orchestrator — detailed code and logs go in the filesystem
- If building an application, include clear run instructions in build-log.md

## Guidelines
- Always check for errors after executing commands
- If a command fails, read the error output carefully before retrying
- Install dependencies explicitly (don't assume they're available)
- Use the filesystem tools to read context from other agents' workspaces when referenced in your task
- Write clean, well-structured code with comments where non-obvious
- For multi-file projects, create a logical directory structure
- Test your code before reporting completion
- The sandbox runs Linux — use standard Unix commands`;
```

- [ ] **Step 4: Create the agent config file**

```typescript
// apps/agents/src/nexus/agents/code/agent.ts
import type { SubAgent } from "deepagents";
import {
  CODE_AGENT_NAME,
  CODE_AGENT_DESCRIPTION,
  CODE_SYSTEM_PROMPT,
} from "./prompt.js";

/**
 * Code sub-agent.
 *
 * No custom tools — relies entirely on auto-provisioned sandbox tools:
 * execute (shell), ls, read_file, write_file, edit_file, glob, grep.
 * These are provided automatically because the orchestrator uses a
 * sandbox backend (AIOSandboxBackend via CompositeBackend).
 */
export const codeAgent: SubAgent = {
  name: CODE_AGENT_NAME,
  description: CODE_AGENT_DESCRIPTION,
  systemPrompt: CODE_SYSTEM_PROMPT,
  model: "google-genai:gemini-3.1-pro-preview",
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/code-agent.test.ts`
Expected: PASS — all 11 tests green

- [ ] **Step 6: Commit**

```bash
git add apps/agents/src/nexus/agents/code/prompt.ts apps/agents/src/nexus/agents/code/agent.ts apps/agents/src/nexus/__tests__/code-agent.test.ts
git commit -m "feat(agents): add code sub-agent with sandbox execution"
```

---

### Task 3: Creative Sub-Agent

**Files:**
- Create: `apps/agents/src/nexus/agents/creative/prompt.ts`
- Create: `apps/agents/src/nexus/agents/creative/agent.ts`
- Test: `apps/agents/src/nexus/__tests__/creative-agent.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/agents/src/nexus/__tests__/creative-agent.test.ts
import { describe, it, expect } from "vitest";
import {
  CREATIVE_AGENT_NAME,
  CREATIVE_AGENT_DESCRIPTION,
  CREATIVE_SYSTEM_PROMPT,
} from "../agents/creative/prompt.js";
import { creativeAgent } from "../agents/creative/agent.js";

describe("Creative Agent prompt", () => {
  it("should export CREATIVE_AGENT_NAME as 'creative'", () => {
    expect(CREATIVE_AGENT_NAME).toBe("creative");
  });

  it("should export a non-empty CREATIVE_AGENT_DESCRIPTION", () => {
    expect(CREATIVE_AGENT_DESCRIPTION.length).toBeGreaterThan(20);
  });

  it("should export a non-empty CREATIVE_SYSTEM_PROMPT", () => {
    expect(CREATIVE_SYSTEM_PROMPT.length).toBeGreaterThan(100);
  });

  it("should include workspace path in system prompt", () => {
    expect(CREATIVE_SYSTEM_PROMPT).toContain("/home/gem/workspace/creative/");
  });

  it("should instruct concise summaries in system prompt", () => {
    expect(CREATIVE_SYSTEM_PROMPT).toContain("500");
  });
});

describe("Creative Agent config", () => {
  it("should have name matching CREATIVE_AGENT_NAME", () => {
    expect(creativeAgent.name).toBe("creative");
  });

  it("should have a description", () => {
    expect(creativeAgent.description).toBeTruthy();
  });

  it("should have a systemPrompt", () => {
    expect(creativeAgent.systemPrompt).toBeTruthy();
  });

  it("should have exactly 1 tool (generate_image)", () => {
    expect(creativeAgent.tools).toHaveLength(1);
    expect(creativeAgent.tools![0].name).toBe("generate_image");
  });

  it("should use gemini-3.1-flash-image-preview model", () => {
    expect(creativeAgent.model).toBe("google-genai:gemini-3.1-flash-image-preview");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/creative-agent.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Create the prompt file**

```typescript
// apps/agents/src/nexus/agents/creative/prompt.ts

export const CREATIVE_AGENT_NAME = "creative";

export const CREATIVE_AGENT_DESCRIPTION =
  "Creative sub-agent that generates images using Gemini Imagen. " +
  "Use for creating illustrations, diagrams, hero images, icons, and visual assets. " +
  "Saves images to the workspace filesystem with descriptive filenames.";

export const CREATIVE_SYSTEM_PROMPT = `You are a Creative sub-agent for Nexus. Your job is to generate images and visual assets using the generate_image tool.

## Tools
- **generate_image**: Generate images from text descriptions using Gemini Imagen. Provide a detailed prompt and a filename. Returns base64 image data that you should save to the filesystem.
- **Filesystem tools**: ls, read_file, write_file, edit_file, glob, grep (auto-provisioned)

## Workflow
1. Read context from the workspace paths provided in your task description to understand what visuals are needed
2. Craft detailed, specific image generation prompts — the more descriptive, the better the results
3. Generate images with generate_image, providing descriptive filenames (e.g., "hero-banner-dark-theme.png")
4. Save the generated images using write_file
5. Document the prompts used for reproducibility

## Output Requirements
- Write all outputs to \`/home/gem/workspace/creative/task_{id}/\`
- Save images with descriptive filenames reflecting their content
- Create \`prompt-used.md\` documenting the exact prompts used for each image (for reproducibility)
- Return a concise summary (under 500 words) listing generated files and brief descriptions
- If multiple images are requested, generate them sequentially

## Guidelines
- Write detailed, specific prompts — include style, mood, colors, composition, subject matter
- Use descriptive filenames, not generic ones (e.g., "dashboard-chart-dark.png" not "image1.png")
- You can read from other agents' workspaces to understand visual context (e.g., reading research findings to inform infographic design)
- If an image generation fails, try rephrasing the prompt
- For consistent style across multiple images, maintain similar prompt structures`;
```

- [ ] **Step 4: Create the agent config file**

```typescript
// apps/agents/src/nexus/agents/creative/agent.ts
import type { SubAgent } from "deepagents";
import { creativeTools } from "../../tools/index.js";
import {
  CREATIVE_AGENT_NAME,
  CREATIVE_AGENT_DESCRIPTION,
  CREATIVE_SYSTEM_PROMPT,
} from "./prompt.js";

export const creativeAgent: SubAgent = {
  name: CREATIVE_AGENT_NAME,
  description: CREATIVE_AGENT_DESCRIPTION,
  systemPrompt: CREATIVE_SYSTEM_PROMPT,
  tools: [...creativeTools],
  model: "google-genai:gemini-3.1-flash-image-preview",
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/creative-agent.test.ts`
Expected: PASS — all 10 tests green

- [ ] **Step 6: Commit**

```bash
git add apps/agents/src/nexus/agents/creative/prompt.ts apps/agents/src/nexus/agents/creative/agent.ts apps/agents/src/nexus/__tests__/creative-agent.test.ts
git commit -m "feat(agents): add creative sub-agent with Gemini Imagen"
```

---

### Task 4: General-Purpose Subagent Override

DeepAgents always adds a general-purpose subagent alongside custom ones. It inherits all skills and tools from the main agent. We override it with `name: "general-purpose"` to control its behavior — giving it a minimal prompt that defers to specialized agents.

**Files:**
- Create: `apps/agents/src/nexus/agents/general-purpose/agent.ts`
- Test: `apps/agents/src/nexus/__tests__/general-purpose-agent.test.ts` (within agents-index tests in Task 5)

- [ ] **Step 1: Write the failing test**

We'll test this as part of the barrel export in Task 5, but verify the override config exists:

```typescript
// Add to apps/agents/src/nexus/__tests__/agents-index.test.ts (created in Task 5)
// For now, create a minimal test:
```

- [ ] **Step 2: Create the general-purpose override**

```typescript
// apps/agents/src/nexus/agents/general-purpose/agent.ts
import type { SubAgent } from "deepagents";

/**
 * General-purpose subagent override.
 *
 * DeepAgents always adds a default general-purpose subagent that inherits
 * all tools and skills from the main agent. By passing a SubAgent with
 * name "general-purpose", we override it with controlled behavior.
 *
 * This override instructs the GP agent to suggest using specialized agents
 * instead of attempting tasks itself, acting as a fallback for truly
 * miscellaneous work that doesn't fit Research, Code, or Creative.
 */
export const generalPurposeAgent: SubAgent = {
  name: "general-purpose",
  description:
    "General-purpose assistant for miscellaneous tasks that don't fit Research, Code, or Creative. " +
    "Use only when no specialized agent is appropriate. Prefer specialized agents for better results.",
  systemPrompt: `You are a general-purpose assistant for Nexus. You handle miscellaneous tasks that don't fit the specialized sub-agents (Research, Code, Creative).

## When You Should Be Used
- Text formatting, summarization, or rewriting tasks
- Simple calculations or data transformations
- Tasks that combine multiple domains but are too small to warrant multiple specialized agents
- Clarification or elaboration on previous results

## Output Requirements
- Write outputs to /home/gem/workspace/orchestrator/ if file output is needed
- Return concise responses directly when possible
- Keep filesystem usage minimal — you're for lightweight tasks

## Guidelines
- If the task would be better handled by Research (web search), Code (execution), or Creative (images), say so in your response
- You have filesystem tools (ls, read_file, write_file, etc.) but no specialized tools
- Keep responses focused and concise`,
};
```

- [ ] **Step 3: Commit**

```bash
git add apps/agents/src/nexus/agents/general-purpose/agent.ts
git commit -m "feat(agents): add general-purpose subagent override"
```

---

### Task 5: Barrel Export with Grouped Arrays

**Files:**
- Create: `apps/agents/src/nexus/agents/index.ts`
- Test: `apps/agents/src/nexus/__tests__/agents-index.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/agents/src/nexus/__tests__/agents-index.test.ts
import { describe, it, expect } from "vitest";
import {
  researchAgent,
  codeAgent,
  creativeAgent,
  generalPurposeAgent,
  nexusSubagents,
} from "../agents/index.js";

describe("Agents barrel export", () => {
  it("should export researchAgent", () => {
    expect(researchAgent).toBeDefined();
    expect(researchAgent.name).toBe("research");
  });

  it("should export codeAgent", () => {
    expect(codeAgent).toBeDefined();
    expect(codeAgent.name).toBe("code");
  });

  it("should export creativeAgent", () => {
    expect(creativeAgent).toBeDefined();
    expect(creativeAgent.name).toBe("creative");
  });

  it("should export generalPurposeAgent", () => {
    expect(generalPurposeAgent).toBeDefined();
    expect(generalPurposeAgent.name).toBe("general-purpose");
  });

  it("should export nexusSubagents array with all 4 agents", () => {
    expect(nexusSubagents).toHaveLength(4);
    const names = nexusSubagents.map((a) => a.name);
    expect(names).toContain("research");
    expect(names).toContain("code");
    expect(names).toContain("creative");
    expect(names).toContain("general-purpose");
  });

  it("should have unique names across all subagents", () => {
    const names = nexusSubagents.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("should have descriptions on all subagents", () => {
    for (const agent of nexusSubagents) {
      expect(agent.description.length).toBeGreaterThan(20);
    }
  });

  it("should have systemPrompts on all subagents", () => {
    for (const agent of nexusSubagents) {
      expect(agent.systemPrompt.length).toBeGreaterThan(50);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/agents-index.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create the barrel export**

```typescript
// apps/agents/src/nexus/agents/index.ts
export { researchAgent } from "./research/agent.js";
export {
  RESEARCH_AGENT_NAME,
  RESEARCH_AGENT_DESCRIPTION,
  RESEARCH_SYSTEM_PROMPT,
} from "./research/prompt.js";

export { codeAgent } from "./code/agent.js";
export {
  CODE_AGENT_NAME,
  CODE_AGENT_DESCRIPTION,
  CODE_SYSTEM_PROMPT,
} from "./code/prompt.js";

export { creativeAgent } from "./creative/agent.js";
export {
  CREATIVE_AGENT_NAME,
  CREATIVE_AGENT_DESCRIPTION,
  CREATIVE_SYSTEM_PROMPT,
} from "./creative/prompt.js";

export { generalPurposeAgent } from "./general-purpose/agent.js";

import { researchAgent } from "./research/agent.js";
import { codeAgent } from "./code/agent.js";
import { creativeAgent } from "./creative/agent.js";
import { generalPurposeAgent } from "./general-purpose/agent.js";

/**
 * All Nexus sub-agents, ready to pass to createDeepAgent({ subagents }).
 * Includes the general-purpose override to prevent DeepAgents from
 * adding an uncontrolled default agent.
 */
export const nexusSubagents = [
  researchAgent,
  codeAgent,
  creativeAgent,
  generalPurposeAgent,
] as const;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/agents-index.test.ts`
Expected: PASS — all 8 tests green

- [ ] **Step 5: Commit**

```bash
git add apps/agents/src/nexus/agents/index.ts apps/agents/src/nexus/__tests__/agents-index.test.ts
git commit -m "feat(agents): add barrel export with nexusSubagents array"
```

---

### Task 6: Wire Sub-Agents into Orchestrator

**Files:**
- Modify: `apps/agents/src/nexus/orchestrator.ts`
- Modify: `apps/agents/src/nexus/prompts/orchestrator-system.ts`
- Test: `apps/agents/src/nexus/__tests__/orchestrator-subagents.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/agents/src/nexus/__tests__/orchestrator-subagents.test.ts
import { describe, it, expect, vi } from "vitest";

/**
 * These tests verify the orchestrator is wired with sub-agents
 * without hitting real APIs. We mock createDeepAgent to capture
 * the params it receives.
 */

// Mock createDeepAgent to capture params
let capturedParams: Record<string, unknown> | null = null;
vi.mock("deepagents", () => ({
  createDeepAgent: (params: Record<string, unknown>) => {
    capturedParams = params;
    return {
      invoke: vi.fn().mockResolvedValue({ messages: [] }),
    };
  },
}));

// Must import AFTER mock setup
const { createNexusOrchestrator } = await import("../orchestrator.js");

describe("Orchestrator sub-agent wiring", () => {
  it("should pass subagents to createDeepAgent", () => {
    createNexusOrchestrator();
    expect(capturedParams).not.toBeNull();
    expect(capturedParams!.subagents).toBeDefined();
  });

  it("should include all 4 sub-agents", () => {
    createNexusOrchestrator();
    const subagents = capturedParams!.subagents as Array<{ name: string }>;
    expect(subagents).toHaveLength(4);
    const names = subagents.map((a) => a.name);
    expect(names).toContain("research");
    expect(names).toContain("code");
    expect(names).toContain("creative");
    expect(names).toContain("general-purpose");
  });

  it("should include research agent with tools", () => {
    createNexusOrchestrator();
    const subagents = capturedParams!.subagents as Array<{
      name: string;
      tools?: Array<{ name: string }>;
    }>;
    const research = subagents.find((a) => a.name === "research")!;
    expect(research.tools).toHaveLength(3);
  });

  it("should include code agent without custom tools", () => {
    createNexusOrchestrator();
    const subagents = capturedParams!.subagents as Array<{
      name: string;
      tools?: unknown[];
    }>;
    const code = subagents.find((a) => a.name === "code")!;
    expect(code.tools).toBeUndefined();
  });

  it("should include creative agent with tools", () => {
    createNexusOrchestrator();
    const subagents = capturedParams!.subagents as Array<{
      name: string;
      tools?: Array<{ name: string }>;
    }>;
    const creative = subagents.find((a) => a.name === "creative")!;
    expect(creative.tools).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/orchestrator-subagents.test.ts`
Expected: FAIL — subagents not passed to createDeepAgent yet

- [ ] **Step 3: Update the orchestrator system prompt**

In `apps/agents/src/nexus/prompts/orchestrator-system.ts`, update the `ORCHESTRATOR_SYSTEM_PROMPT` to include specific sub-agent delegation guidance. Replace the existing `## Delegation Guidelines` section:

Replace the existing content with:

```typescript
// apps/agents/src/nexus/prompts/orchestrator-system.ts

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
2. If the request is clear and single-domain, delegate to the appropriate sub-agent.
3. If the request is multi-step or multi-domain, create a plan with write_todos, then delegate.

## Sub-Agent Selection
Use the task tool to spawn sub-agents. Always prefer specialized agents over general-purpose:

- **research** — Web search, content extraction, site mapping. Use when you need current information, source gathering, or knowledge synthesis. Tools: tavily_search, tavily_extract, tavily_map.
- **code** — Code writing, execution, debugging in a sandboxed Linux environment. Use for building applications, scripts, data processing, file formatting. Tools: execute (shell), filesystem tools.
- **creative** — Image generation via Gemini Imagen. Use for illustrations, diagrams, hero images, icons, visual assets. Tools: generate_image, filesystem tools.
- **general-purpose** — Miscellaneous tasks only. Use when no specialized agent fits (text rewriting, simple calculations). Has filesystem tools only.

## Delegation Guidelines
- Provide detailed task descriptions — sub-agents have NO context from this conversation
- Tell each sub-agent its workspace: "/home/gem/workspace/{research|code|creative}/task_{id}/"
- Tell sub-agents where to read input files from other agents if needed
- Sub-agents return concise summaries (< 500 words). Full data is in the filesystem.
- After sub-agents complete, read their output files to verify quality before synthesizing

## Multi-Agent Coordination
When a task requires multiple sub-agents:
1. Plan the work order with write_todos (which tasks can run in parallel, which depend on others)
2. Spawn independent tasks first
3. Wait for results, then spawn dependent tasks that reference earlier outputs
4. Example: Research first → Code reads research findings → Creative generates visuals

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

- [ ] **Step 4: Update orchestrator.ts to wire subagents**

In `apps/agents/src/nexus/orchestrator.ts`, add the `subagents` import and pass it to `createDeepAgent`:

Add this import at the top:
```typescript
import { nexusSubagents } from "./agents/index.js";
```

Then update the `createDeepAgent` call to include `subagents`:

```typescript
export function createNexusOrchestrator(sandboxUrl = "http://localhost:8080") {
  const sandbox = new AIOSandboxBackend(sandboxUrl);
  const backend = createNexusBackend(sandbox);

  return createDeepAgent({
    name: "nexus-orchestrator",
    model: "google-genai:gemini-3-flash-preview",
    systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT,
    middleware: [configurableModelMiddleware] as const,
    backend,
    subagents: [...nexusSubagents],
    memory: ["/memories/AGENTS.md"],
    skills: ["/skills/"],
  });
}
```

The full updated file:

```typescript
// apps/agents/src/nexus/orchestrator.ts
import { createDeepAgent } from "deepagents";
import { AIOSandboxBackend } from "./backend/aio-sandbox.js";
import { createNexusBackend } from "./backend/composite.js";
import { configurableModelMiddleware } from "./middleware/configurable-model.js";
import { ORCHESTRATOR_SYSTEM_PROMPT } from "./prompts/orchestrator-system.js";
import { nexusSubagents } from "./agents/index.js";
import type { NexusState } from "./state.js";

/**
 * Creates the Nexus orchestrator DeepAgent.
 *
 * The orchestrator is the central brain — it receives user prompts,
 * plans work via write_todos, and delegates to specialized sub-agents
 * (Research, Code, Creative) plus a controlled general-purpose fallback.
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
    model: "google-genai:gemini-3-flash-preview",
    systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT,
    middleware: [configurableModelMiddleware] as const,
    backend,
    subagents: [...nexusSubagents],
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

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/agents && npx vitest run src/nexus/__tests__/orchestrator-subagents.test.ts`
Expected: PASS — all 5 tests green

- [ ] **Step 6: Run all existing tests to verify no regressions**

Run: `cd apps/agents && npx vitest run --exclude "**/*integration*" --exclude "**/*tools-integration*"`
Expected: All unit tests pass (existing + new)

- [ ] **Step 7: Commit**

```bash
git add apps/agents/src/nexus/orchestrator.ts apps/agents/src/nexus/prompts/orchestrator-system.ts apps/agents/src/nexus/__tests__/orchestrator-subagents.test.ts
git commit -m "feat(orchestrator): wire sub-agents into createDeepAgent with updated system prompt"
```

---

### Task 7: Verify Full Test Suite

Run the complete test suite to confirm everything works together.

- [ ] **Step 1: Run all unit tests**

Run: `cd apps/agents && npx vitest run --exclude "**/*integration*" --exclude "**/*tools-integration*"`
Expected: All tests pass — existing Plan 1-3 tests + new Plan 4 tests

- [ ] **Step 2: Count new tests**

Verify the following new test files exist and pass:
- `research-agent.test.ts` — 11 tests
- `code-agent.test.ts` — 11 tests
- `creative-agent.test.ts` — 10 tests
- `agents-index.test.ts` — 8 tests
- `orchestrator-subagents.test.ts` — 5 tests

Total new tests: 45

- [ ] **Step 3: Verify TypeScript compilation**

Run: `cd apps/agents && npx tsc --noEmit`
Expected: No type errors

---

## Design Decisions

### Why override general-purpose instead of removing it?
DeepAgents always adds a GP subagent. We can't remove it, but by passing `name: "general-purpose"` we control its prompt and prevent it from having uncontrolled access to all orchestrator tools/skills.

### Why no custom tools on the Code agent?
The Code agent relies entirely on auto-provisioned sandbox tools (`execute`, `ls`, `read_file`, `write_file`, `edit_file`, `glob`, `grep`). These are provided automatically because the orchestrator uses an `AIOSandboxBackend` via `CompositeBackend`. All sub-agents sharing the same backend get these tools. There's no need to duplicate them.

### Why `[...nexusSubagents]` spread instead of passing directly?
The `nexusSubagents` array is `as const` (readonly). Spreading creates a mutable copy that satisfies the `SubAgent[]` type expected by `createDeepAgent`.

### Execute tool availability across all sub-agents
Since all sub-agents share the sandbox backend, `execute` is auto-provisioned for ALL agents — not just Code. This is acceptable because:
- Research and Creative system prompts don't mention `execute`, so the model rarely invokes it
- If a Research agent needs to run a quick script to process data, having `execute` available is helpful
- Filtering it out would require custom backend wrappers, adding complexity for minimal benefit
