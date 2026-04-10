---
globs: apps/web/**
---

# Frontend Rules

## Skills for Frontend Work

- **Building UI components/pages** → `frontend-design` — avoids generic AI aesthetics, produces distinctive dark-themed components
- **Before new UI features** → `brainstorming` — explore layout options and user flow before coding
- **Debugging UI issues** → `systematic-debugging` — trace streaming data flow before guessing at fixes

## Preserve Core Infrastructure
When modifying `apps/web/`, always preserve:
- `src/providers/Stream.tsx`, `Thread.tsx`, `client.ts` — LangGraph connectivity
- `src/components/ui/` — shadcn/ui base components
- `components.json` — shadcn/ui configuration

## Streaming API
Use `useStream` from `@langchain/react` (NOT `@langchain/langgraph-sdk/react` — it lacks subagent features like `filterSubagentMessages`, `stream.subagents`, `getSubagentsByMessage`).
- Always set `filterSubagentMessages: true` (requires `as any` on options — typed on `AnyStreamOptions` but not `UseStreamOptions`)
- Use `stream.values?.todos` (optional chaining — values can be undefined initially)
- Use `stream.isLoading` for synthesis indicator and submit button state
- Submit with `{ streamSubgraphs: true }`

## useNexusStream Hook
`src/hooks/use-nexus-stream.ts` wraps `useStreamContext` and exposes a clean API:
- `submitPrompt(text)` — creates human message, ensures tool responses, submits with subgraph streaming
- `subagents` — Map<string, SubagentStreamInterface> from the stream (cast via `as any`)
- `getSubagentsByMessage(messageId)` — returns subagents for a given message
- Use this hook in execution view components rather than accessing `useStreamContext` directly

## Component Organization
- `src/components/landing/` — Landing page (logo, tagline, prompt input)
- `src/components/execution/` — Execution view (todo panel, agent status, subagent cards, prompt bar, synthesis indicator)
- `src/components/thread/` — Scaffold thread/chat components (from Agent Chat UI)
- `src/components/ai-elements/` — Editable AI Element source files (not an external dependency)
- `src/components/ui/` — shadcn/ui base components
- `src/lib/subagent-utils.ts` — Subagent type definitions and helper functions

## Model Badges
`SubagentStreamInterface` has no `model` field. Derive model names from `toolCall.args.subagent_type` using a static mapping (research → Pro, code → Pro, creative → flash-image-preview).

## Dark Theme
All UI uses a dark theme inspired by Perplexity Computer. Dark backgrounds, subtle borders, muted text for secondary content.
