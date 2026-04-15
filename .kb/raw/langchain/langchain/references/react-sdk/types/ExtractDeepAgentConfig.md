# ExtractDeepAgentConfig

> **Type Alias** in `@langchain/react`

📖 [View in docs](https://reference.langchain.com/javascript/langchain-react/ExtractDeepAgentConfig)

Extract the DeepAgentTypeConfig from a DeepAgent-like type.

## Signature

```javascript
ExtractDeepAgentConfig: T extends __type ? Config extends DeepAgentTypeConfigLike ? Config : never : never
```

## Examples

```ts
const agent = createDeepAgent({ subagents: [...] });
type Config = ExtractDeepAgentConfig<typeof agent>;
// Config includes { Subagents: [...] }
```

---

[View source on GitHub](https://github.com/langchain-ai/langgraphjs/blob/5a0d0d0155aee7d5d171a61ebdb4d0c26ca6462d/libs/sdk-react/sdk/src/ui/types.ts#L488)