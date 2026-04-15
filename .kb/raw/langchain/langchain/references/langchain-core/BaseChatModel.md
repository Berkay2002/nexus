# BaseChatModel

> **Class** in `@langchain/core`

📖 [View in docs](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel)

Base class for chat models. It extends the BaseLanguageModel class and
provides methods for generating chat based on input messages.

## Signature

```javascript
class BaseChatModel
```

## Extends

- `BaseLanguageModel<OutputMessageType, CallOptions>`

## Constructors

- [`constructor()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/constructor)

## Properties

- `cache`
- `callbacks`
- `caller`
- `disableStreaming`
- `lc_kwargs`
- `lc_namespace`
- `lc_runnable`
- `lc_serializable`
- `metadata`
- `name`
- `outputVersion`
- `ParsedCallOptions`
- `tags`
- `verbose`
- `callKeys`
- `lc_aliases`
- `lc_attributes`
- `lc_id`
- `lc_secrets`
- `lc_serializable_keys`
- `profile`

## Methods

- [`_addVersion()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/_addVersion)
- [`_batchWithConfig()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/_batchWithConfig)
- [`_callWithConfig()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/_callWithConfig)
- [`_combineLLMOutput()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/_combineLLMOutput)
- [`_generate()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/_generate)
- [`_generateCached()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/_generateCached)
- [`_getOptionsList()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/_getOptionsList)
- [`_getSerializedCacheKeyParametersForCall()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/_getSerializedCacheKeyParametersForCall)
- [`_identifyingParams()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/_identifyingParams)
- [`_llmType()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/_llmType)
- [`_modelType()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/_modelType)
- [`_separateRunnableConfigFromCallOptions()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/_separateRunnableConfigFromCallOptions)
- [`_separateRunnableConfigFromCallOptionsCompat()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/_separateRunnableConfigFromCallOptionsCompat)
- [`_streamIterator()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/_streamIterator)
- [`_streamLog()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/_streamLog)
- [`_streamResponseChunks()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/_streamResponseChunks)
- [`_transformStreamWithConfig()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/_transformStreamWithConfig)
- [`assign()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/assign)
- [`asTool()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/asTool)
- [`batch()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/batch)
- [`bindTools()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/bindTools)
- [`generate()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/generate)
- [`generatePrompt()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/generatePrompt)
- [`getGraph()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/getGraph)
- [`getLsParams()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/getLsParams)
- [`getLsParamsWithDefaults()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/getLsParamsWithDefaults)
- [`getName()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/getName)
- [`getNumTokens()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/getNumTokens)
- [`invocationParams()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/invocationParams)
- [`invoke()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/invoke)
- [`pick()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/pick)
- [`pipe()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/pipe)
- [`serialize()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/serialize)
- [`stream()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/stream)
- [`streamEvents()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/streamEvents)
- [`streamLog()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/streamLog)
- [`toJSON()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/toJSON)
- [`toJSONNotImplemented()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/toJSONNotImplemented)
- [`transform()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/transform)
- [`withConfig()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/withConfig)
- [`withFallbacks()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/withFallbacks)
- [`withListeners()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/withListeners)
- [`withRetry()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/withRetry)
- [`withStructuredOutput()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/withStructuredOutput)
- [`_convertInputToPromptValue()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/_convertInputToPromptValue)
- [`deserialize()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/deserialize)
- [`isRunnable()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/isRunnable)
- [`lc_name()`](https://reference.langchain.com/javascript/langchain-core/language_models/chat_models/BaseChatModel/lc_name)

---

[View source on GitHub](https://github.com/langchain-ai/langchainjs/blob/0c799481f691e046a4533588fc96e190669fa16e/libs/langchain-core/src/language_models/chat_models.ts#L210)