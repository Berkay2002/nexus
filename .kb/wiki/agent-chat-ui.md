---
created: 2026-04-12
updated: 2026-04-12
tags: [agent-chat-ui, langchain, frontend, next-js, chat-interface]
sources: [raw/langchain/deepagents/agent-chat-ui.md]
---

# Agent Chat UI

Agent Chat UI is an open-source Next.js application by LangChain-AI that provides a conversational interface for any LangGraph agent. It handles [[streaming]] of agent output, renders tool calls and interrupts out of the box, and supports advanced debugging workflows. Nexus was scaffolded using `npx create-agent-chat-app` and retains several infrastructure pieces from this scaffold.

## Overview

Agent Chat UI sits at `github.com/langchain-ai/agent-chat-ui`. It connects to a LangGraph server (local or deployed) and provides a chat interface without requiring UI code to be written from scratch. It is designed to be adapted — the scaffold is a starting point, not a black box.

Key features:

- **Real-time chat** — [[streaming]] responses from any LangGraph graph via the [[use-stream-hook]]
- **Tool call visualization** — tool invocations and results are rendered as structured UI cards automatically
- **Interrupt rendering** — displays interrupted thread state and allows the user to resume
- **Time-travel debugging** — navigate to any prior state in a thread and fork from it
- **State forking** — branch from any message, enabling comparison of different agent paths
- **Generative UI** — supports [[ai-elements]] for LLM-generated interface components rendered inside the chat

## Quick start options

**Hosted:** Visit `agentchat.vercel.app`, enter your deployment URL or `http://localhost:2024`, and start chatting. No installation required.

**Scaffold (used by Nexus):**

```bash
npx create-agent-chat-app --project-name my-chat-ui
cd my-chat-ui
pnpm install && pnpm dev
```

**Clone directly:**

```bash
git clone https://github.com/langchain-ai/agent-chat-ui.git
cd agent-chat-ui
pnpm install && pnpm dev
```

## Connecting to an agent

After starting the UI, configure three values:

| Field | Description |
|---|---|
| Graph ID | Graph name from `graphs` key in `langgraph.json` |
| Deployment URL | Agent server endpoint — `http://localhost:2024` for local dev |
| LangSmith API key | Optional; not required for local agents |

Once connected, the UI automatically fetches and displays any interrupted threads associated with that agent.

## Nexus scaffold origin

Nexus was bootstrapped with `npx create-agent-chat-app`. The following scaffold infrastructure pieces are preserved in `apps/web/` and must not be discarded during UI rewrites:

- `src/providers/Stream.tsx` — `useStream` hook integration, thread state management
- `src/providers/client.ts` — LangGraph SDK client setup
- `src/providers/Thread.tsx` — thread list management
- `src/components/ui/` — shadcn/ui base component library

The scaffold's chat thread view and branding have been replaced by Nexus's landing page and execution view, but the streaming infrastructure above remains from the original Agent Chat UI foundation. The [[deep-agents-overview]] and subagent features (`filterSubagentMessages`, `stream.subagents`) required upgrading `useStream` from `@langchain/langgraph-sdk/react` to `@langchain/react`, which is the version that exposes these APIs.

## Message visibility

Tool call and result messages are rendered by default. To hide specific message types, configure the `Hiding Messages in the Chat` setting documented in the upstream README.

## Related

- [[use-stream-hook]]
- [[ai-elements]]
- [[streaming]]
- [[deep-agents-overview]]
- [[create-deep-agent]]

## Sources

- `raw/langchain/deepagents/agent-chat-ui.md` — Agent Chat UI reference: features, quick start, local development, agent connection config, scaffold origin
