---
created: 2026-04-12
updated: 2026-04-12
tags: [langgraph, context-engineering, state]
sources: [raw/langchain/deepagents/context.md]
---

# Dynamic Runtime Context

Dynamic runtime context is LangGraph's mechanism for **mutable, single-run context** — data that evolves during one invocation and is discarded when the run ends. It is managed through the LangGraph **state object**, which acts as short-term memory for the duration of a run.

## What It Covers

Anything that changes as the agent executes belongs here:

- Conversation history (the `messages` list that grows with every turn)
- Intermediate tool-call results
- Values derived from LLM outputs mid-run
- Custom fields like a `userName` injected at invocation but read inside middleware

## State Schema

Define state by extending LangGraph's schema primitives. In a workflow:

```typescript
import { StateGraph, StateSchema, MessagesValue } from "@langchain/langgraph";
import { z } from "zod/v4";

const CustomState = new StateSchema({
  messages: MessagesValue,
  extraField: z.number(),
});

const builder = new StateGraph(CustomState)
  .addNode("node", async (state) => {
    return { extraField: state.extraField + 1 };
  });
```

In an agent with [[context-engineering]] middleware:

```typescript
const CustomState = z.object({ userName: z.string() });

const personalizedPrompt = createMiddleware({
  name: "PersonalizedPrompt",
  stateSchema: CustomState,
  wrapModelCall: (request, handler) => {
    const userName = request.state.userName || "User";
    return handler({ ...request, systemPrompt: `User's name is ${userName}` });
  },
});
```

## Lifetime and Persistence

By default, state is scoped only to a single run and is lost when the invocation completes. To persist state across invocations (making it behave like [[cross-conversation-context]]), enable LangGraph's memory/checkpointer feature. With a checkpointer configured and a `thread_id` in [[config-runtime-context]], the state is saved and reloaded on each call to the same thread.

## Tools Can Read and Mutate State

Tools receive the current state and can return partial state updates, not just tool outputs. This lets a tool write results directly into the state for subsequent nodes or middleware to consume.

## Related

- [[context-overview]]
- [[config-runtime-context]]
- [[cross-conversation-context]]
- [[context-engineering]]

## Sources

- `raw/langchain/deepagents/context.md` — state schema examples (agent and workflow), middleware state access pattern
