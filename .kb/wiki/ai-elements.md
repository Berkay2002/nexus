---
created: 2026-04-12
updated: 2026-04-12
tags: [ai-elements, frontend, shadcn, react, chat-ui]
sources: [raw/langchain/deepagents/frontend/ai-elements.md]
---

# AI Elements

A composable, shadcn/ui-based component library purpose-built for AI chat interfaces. Components are designed to wire directly to `stream.messages` from the [[use-stream-hook]] with minimal glue code.

## Philosophy: Editable Source Files

AI Elements does not ship as a locked npm dependency. Components are added to your project as editable source files via a CLI (shadcn/ui registry style). This means you can modify any component freely — change styles, add props, restructure composition — without forking a package.

In Nexus, AI Element source files live at `apps/web/src/components/ai-elements/` and are treated as project-owned code.

## Installation

```bash
npm install @langchain/react @ai-elements/react
npx ai-elements@latest add conversation message prompt-input tool reasoning suggestion
```

Each named argument adds the corresponding component group as source files.

## Integration with useStream

AI Elements components map directly to LangChain message types from `stream.messages`:

- `HumanMessage` instances → user `<Message from="user">` bubbles
- `AIMessage` instances → assistant responses, composed with `<Tool>`, `<Reasoning>`, and `<MessageResponse>`

Use `HumanMessage.isInstance(msg)` and `AIMessage.isInstance(msg)` (not `msg.getType()`) for proper TypeScript narrowing.

## Streaming Best Practices

- Use `<MessageResponse>` for assistant text — it handles partial streamed tokens correctly. Avoid rendering raw `msg.content` during an active stream.
- Wrap the message list in `<Conversation>` for automatic scroll management.
- Drive submit button state from `stream.isLoading` (pass `status="streaming"` vs `"ready"` to `<PromptInputSubmit>`).

## Related

- [[ai-elements-components]]
- [[use-stream-hook]]
- [[deepagents-frontend-overview]]
- [[streaming]]
- [[agent-chat-ui]]

## Sources

- `raw/langchain/deepagents/frontend/ai-elements.md` — component philosophy, installation, useStream wiring, best practices
