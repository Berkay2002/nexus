---
created: 2026-04-12
updated: 2026-04-12
tags: [deepagents, memory, long-term-memory, persistence, store-backend]
sources: [raw/langchain/deepagents/memory.md]
---

# Long-Term Memory (DeepAgents)

Long-term memory in DeepAgents persists agent knowledge across conversation threads by storing memory files in a backend-controlled virtual filesystem. The durability guarantee comes entirely from the backend: [[store-backend]] (SQLite or platform store) gives cross-thread persistence; `StateBackend` gives only within-thread retention.

## Content

### Filesystem convention

By convention, memory files live under `/memories/` on the virtual filesystem. The path is not hardcoded by the framework — it becomes a durable store only when [[composite-backend]] routes `/memories/` to a [[store-backend]]:

```typescript
const agent = createDeepAgent({
  memory: ["/memories/AGENTS.md"],
  backend: new CompositeBackend(
    new StateBackend(),
    {
      "/memories/": new StoreBackend({
        namespace: (ctx) => [ctx.runtime.serverInfo.assistantId],
      }),
    },
  ),
});
```

Any path not matched by a `CompositeBackend` route falls through to the default backend (typically `StateBackend` — ephemeral).

### Bootstrap pattern

Memory files must exist in the store before the agent can read them. Pre-populate via `store.put` before invoking the agent:

```typescript
await store.put(
  ["my-agent"],           // namespace
  "/memories/AGENTS.md",  // key
  createFileData(`## Response style\n- Keep responses concise\n`),
);
```

For Nexus, skills are bootstrapped via `orchestrator.invoke({ files: nexusSkillFiles })` which seeds the `/skills/` route in the same way.

### Namespace design

The namespace array passed to `StoreBackend` determines isolation:

| Namespace | Isolation | Typical use |
|-----------|-----------|-------------|
| `[assistantId]` | Per-agent | Agent identity, shared across all users |
| `[userId]` | Per-user | User preferences, never leak between users |
| `[orgId]` | Per-org | Compliance policies (read-only) |
| `[assistantId, userId]` | Per-agent-per-user | Multi-agent deployment with user isolation |

For multiple agents in one deployment, include `assistantId` in the namespace to prevent agents from reading each other's memory.

### Update strategies

**Hot path (default):** The agent writes memory during the conversation using its `edit_file` tool. Changes are immediately available in the same thread and in subsequent threads. Adds latency to the conversation turn.

**Background consolidation (sleep-time compute):** A separate consolidation agent runs on a cron schedule, reads recent thread history via `client.threads.search`, extracts key facts, and merges them into the memory store. Memories are not available until the next conversation. The cron interval must match the consolidation agent's lookback window — mismatches either reprocess conversations (too frequent) or drop memories (too infrequent).

```typescript
// Register both agents in langgraph.json
// { "agent": "./src/agent.ts:agent", "consolidation_agent": "./src/consolidation-agent.ts:agent" }

// Schedule with LangSmith cron
const cronJob = await client.crons.create("consolidation_agent", {
  schedule: "0 */6 * * *",
  input: { messages: [{ role: "user", content: "Consolidate recent memories." }] },
});
```

### Concurrent writes

Concurrent writes to the **same file** from multiple threads produce last-write-wins conflicts. For user-scoped memory this is rare. For agent-scoped or org-scoped memory, mitigate by using background consolidation to serialize writes, or split memory into separate per-topic files.

### Security: read-only enforcement

Shared memory (org policies, developer skills) should be write-protected. Use policy hooks on the backend to reject agent `edit_file` calls targeting protected paths. The agent can still read the files but cannot modify them.

Principle: **default to user scope** unless sharing is explicitly required. Never let user A write to memory that user B reads without human-in-the-loop validation.

### Nexus configuration

```
CompositeBackend
  default     → AIOSandboxBackend   (ephemeral workspace)
  /memories/  → StoreBackend(SQLite) (long-term agent memory)
  /skills/    → StoreBackend(SQLite) (skill files)
```

The Nexus orchestrator seeds skills at startup and relies on the `/memories/` route for any state the agent persists across task invocations.

## Related

- [[memory]]
- [[store-backend]]
- [[composite-backend]]
- [[skills]]
- [[context-engineering]]

## Sources

- `raw/langchain/deepagents/memory.md` — scoped memory patterns, bootstrap examples, background consolidation, namespace design, concurrent write considerations
