---
created: 2026-04-12
updated: 2026-04-12
tags: [ai-elements, frontend, react, chat-ui, components]
sources: [raw/langchain/deepagents/frontend/ai-elements.md]
---

# AI Elements Component Catalog

The full set of composable components shipped by [[ai-elements]]. Each component group is added as editable source files and targets a specific UI concern in an AI chat interface.

## Conversation

Manages the scrollable message list container. Provides automatic scroll-to-bottom behavior as new messages arrive.

| Sub-component | Purpose |
|---|---|
| `<Conversation>` | Outer wrapper; manages scroll state |
| `<ConversationContent>` | Inner container for the message list |
| `<ConversationScrollButton>` | Floating button to jump to latest message |

## Message

Renders a single chat turn — user or assistant.

| Sub-component | Purpose |
|---|---|
| `<Message from="user\|assistant">` | Wrapper with alignment and avatar styling |
| `<MessageContent>` | Text body of a turn |
| `<MessageResponse>` | Streaming-safe renderer for assistant text; handles partial tokens correctly |

## Tool

Collapsible block displaying a tool call's input and output inline in the message thread.

| Sub-component | Purpose |
|---|---|
| `<Tool defaultOpen>` | Outer wrapper with open/collapsed state |
| `<ToolHeader type={} state={}>` | Header showing tool name and execution state |
| `<ToolContent>` | Container for input/output sections |
| `<ToolInput input={args}>` | Renders tool call arguments (JSON) |
| `<ToolOutput output={} errorText={}>` | Renders tool result or error |

`state` on `ToolHeader` drives visual indicators (running, complete, error). Derive it from the tool call object returned by `getToolCalls(msg)`.

## Reasoning

Collapsible block for model thinking/reasoning tokens (e.g., GLM or Claude extended thinking output).

| Sub-component | Purpose |
|---|---|
| `<Reasoning>` | Outer wrapper with collapsed-by-default state |
| `<ReasoningTrigger>` | Toggle button |
| `<ReasoningContent>` | Text body of reasoning output |

## PromptInput

Composable input bar for submitting new messages.

| Sub-component | Purpose |
|---|---|
| `<PromptInput onSubmit={}>` | Form wrapper; `onSubmit` receives `{ text }` |
| `<PromptInputBody>` | Slot for the textarea |
| `<PromptInputTextarea placeholder={}>` | Auto-resizing text input |
| `<PromptInputFooter>` | Slot for action buttons |
| `<PromptInputSubmit status="ready\|streaming">` | Submit button; `streaming` shows stop/spinner state |

## Suggestion

Preset prompt chips displayed before the user sends their first message. Not shown in the wiring example but installed via `npx ai-elements@latest add suggestion`.

## Typical Composition Pattern

```tsx
<Conversation className="flex-1">
  <ConversationContent>
    {stream.messages.map((msg, i) => {
      if (HumanMessage.isInstance(msg)) {
        return (
          <Message key={i} from="user">
            <MessageContent>{msg.content as string}</MessageContent>
          </Message>
        );
      }
      if (AIMessage.isInstance(msg)) {
        return (
          <div key={i}>
            <Reasoning>
              <ReasoningTrigger />
              <ReasoningContent>{getReasoningText(msg)}</ReasoningContent>
            </Reasoning>
            {getToolCalls(msg).map((tc) => (
              <Tool key={tc.id} defaultOpen>
                <ToolHeader type={`tool-${tc.name}`} state={tc.state} />
                <ToolContent>
                  <ToolInput input={tc.args} />
                  {tc.output && <ToolOutput output={tc.output} errorText={undefined} />}
                </ToolContent>
              </Tool>
            ))}
            <Message from="assistant">
              <MessageContent>
                <MessageResponse>{getTextContent(msg)}</MessageResponse>
              </MessageContent>
            </Message>
          </div>
        );
      }
    })}
  </ConversationContent>
  <ConversationScrollButton />
</Conversation>

<PromptInput onSubmit={({ text }) => stream.submit({ messages: [{ type: "human", content: text }] })}>
  <PromptInputBody>
    <PromptInputTextarea placeholder="Ask me something..." />
  </PromptInputBody>
  <PromptInputFooter>
    <PromptInputSubmit status={stream.isLoading ? "streaming" : "ready"} />
  </PromptInputFooter>
</PromptInput>
```

## Related

- [[ai-elements]]
- [[use-stream-hook]]
- [[streaming]]
- [[deepagents-frontend-overview]]

## Sources

- `raw/langchain/deepagents/frontend/ai-elements.md` — component sub-component breakdown, prop shapes, full wiring example
