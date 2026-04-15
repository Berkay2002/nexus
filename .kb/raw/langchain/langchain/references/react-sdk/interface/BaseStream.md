# BaseStream

> **Interface** in `@langchain/react`

📖 [View in docs](https://reference.langchain.com/javascript/langchain-react/BaseStream)

Base stream interface shared by all stream types.

Contains core properties for state management, messaging, and stream control
that are common to CompiledStateGraph, ReactAgent, and DeepAgent streams.

This interface provides the foundation that all stream types build upon:
- State management (`values`, `isLoading`, `error`)
- Message handling (`messages`)
- Interrupt handling (`interrupt`)
- Stream lifecycle (`submit`, `stop`)
- Branching and history (`branch`, `history`)

## Signature

```javascript
interface BaseStream
```

## Properties

- `assistantId`
- `branch`
- `client`
- `error`
- `experimental_branchTree`
- `getMessagesMetadata`
- `history`
- `interrupt`
- `interrupts`
- `isLoading`
- `isThreadLoading`
- `joinStream`
- `messages`
- `queue`
- `setBranch`
- `stop`
- `submit`
- `switchThread`
- `toolProgress`
- `values`

## Examples

```typescript
// BaseStream is not used directly - use one of the specialized interfaces:
// - UseGraphStream for CompiledStateGraph
// - UseAgentStream for ReactAgent (createAgent)
// - UseDeepAgentStream for DeepAgent (createDeepAgent)
```

---

[View source on GitHub](https://github.com/langchain-ai/langgraphjs/blob/5a0d0d0155aee7d5d171a61ebdb4d0c26ca6462d/libs/sdk-react/sdk/src/ui/stream/base.ts#L37)