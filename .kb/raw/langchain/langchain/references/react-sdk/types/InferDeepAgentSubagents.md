# InferDeepAgentSubagents

> **Type Alias** in `@langchain/react`

📖 [View in docs](https://reference.langchain.com/javascript/langchain-react/InferDeepAgentSubagents)

Extract the Subagents array type from a DeepAgent.

## Signature

```javascript
InferDeepAgentSubagents: ExtractDeepAgentConfig<T> extends never ? never : ExtractDeepAgentConfig<T>["Subagents"]
```

## Examples

```ts
const agent = createDeepAgent({ subagents: [researcher, writer] as const });
type Subagents = InferDeepAgentSubagents<typeof agent>;
// Subagents is the readonly tuple of subagent definitions
```

---

[View source on GitHub](https://github.com/langchain-ai/langgraphjs/blob/5a0d0d0155aee7d5d171a61ebdb4d0c26ca6462d/libs/sdk-react/sdk/src/ui/types.ts#L508)