---
globs: apps/web/**
---

# Frontend Rules

## Skills for Frontend Work

- **Building UI components/pages** → `frontend-design` — avoids generic AI aesthetics, produces distinctive dark-themed components
- **Before new UI features** → `brainstorming` — explore layout options and user flow before coding
- **Debugging UI issues** → `systematic-debugging` — trace streaming data flow before guessing at fixes

## Preserve Agent Chat UI Infrastructure
When modifying `apps/web/`, always preserve:
- `src/providers/Stream.tsx`, `Thread.tsx`, `client.ts` — LangGraph connectivity
- `src/components/ui/` — shadcn/ui base components
- `components.json` — shadcn/ui configuration

## Streaming API
Use `useStream` from `@langchain/langgraph-sdk/react`, NOT `@langchain/react`.
- Always set `filterSubagentMessages: true`
- Use `stream.values?.todos` (optional chaining — values can be undefined initially)
- Use `stream.isLoading` for synthesis indicator and submit button state
- Submit with `{ streamSubgraphs: true }`

## AI Elements
Components are installed as editable source files in `src/components/ai-elements/`. They are NOT an external dependency — modify them freely to match the Nexus dark theme.

## Model Badges
`SubagentStreamInterface` has no `model` field. Derive model names from `toolCall.args.subagent_type` using a static mapping (research → Pro, code → Pro, creative → flash-image-preview).

## Dark Theme
All UI uses a dark theme inspired by Perplexity Computer. Dark backgrounds, subtle borders, muted text for secondary content.
