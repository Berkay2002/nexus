# ChatAnthropic

> **Class** in `@langchain/anthropic`

📖 [View in docs](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic)

Anthropic chat model integration.

Setup:
Install `@langchain/anthropic` and set an environment variable named `ANTHROPIC_API_KEY`.

```bash
npm install @langchain/anthropic
export ANTHROPIC_API_KEY="your-api-key"
```

## [Constructor args](https://api.js.langchain.com/classes/langchain_anthropic.ChatAnthropic.html#constructor)

## [Runtime args](https://api.js.langchain.com/interfaces/langchain_anthropic.ChatAnthropicCallOptions.html)

Runtime args can be passed as the second argument to any of the base runnable methods `.invoke`. `.stream`, `.batch`, etc.
They can also be passed via `.bind`, or the second arg in `.bindTools`, like shown in the examples below:

```typescript
// When calling `.bind`, call options should be passed via the first argument
const llmWithArgsBound = llm.bindTools([...]).withConfig({
  stop: ["\n"],
});

// When calling `.bindTools`, call options should be passed via the second argument
const llmWithTools = llm.bindTools(
  [...],
  {
    tool_choice: "auto",
  }
);
```

## Examples

<details open>
<summary><strong>Instantiate</strong></summary>

```typescript
import { ChatAnthropic } from '@langchain/anthropic';

const llm = new ChatAnthropic({
  model: "claude-sonnet-4-5-20250929",
  temperature: 0,
  maxTokens: undefined,
  maxRetries: 2,
  // apiKey: "...",
  // baseUrl: "...",
  // other params...
});
```
</details>

<br />

<details>
<summary><strong>Invoking</strong></summary>

```typescript
const input = `Translate "I love programming" into French.`;

// Models also accept a list of chat messages or a formatted prompt
const result = await llm.invoke(input);
console.log(result);
```

```txt
AIMessage {
  "id": "msg_01QDpd78JUHpRP6bRRNyzbW3",
  "content": "Here's the translation to French:\n\nJ'adore la programmation.",
  "response_metadata": {
    "id": "msg_01QDpd78JUHpRP6bRRNyzbW3",
    "model": "claude-sonnet-4-5-20250929",
    "stop_reason": "end_turn",
    "stop_sequence": null,
    "usage": {
      "input_tokens": 25,
      "output_tokens": 19
    },
    "type": "message",
    "role": "assistant"
  },
  "usage_metadata": {
    "input_tokens": 25,
    "output_tokens": 19,
    "total_tokens": 44
  }
}
```
</details>

<br />

<details>
<summary><strong>Streaming Chunks</strong></summary>

```typescript
for await (const chunk of await llm.stream(input)) {
  console.log(chunk);
}
```

```txt
AIMessageChunk {
  "id": "msg_01N8MwoYxiKo9w4chE4gXUs4",
  "content": "",
  "additional_kwargs": {
    "id": "msg_01N8MwoYxiKo9w4chE4gXUs4",
    "type": "message",
    "role": "assistant",
    "model": "claude-sonnet-4-5-20250929"
  },
  "usage_metadata": {
    "input_tokens": 25,
    "output_tokens": 1,
    "total_tokens": 26
  }
}
AIMessageChunk {
  "content": "",
}
AIMessageChunk {
  "content": "Here",
}
AIMessageChunk {
  "content": "'s",
}
AIMessageChunk {
  "content": " the translation to",
}
AIMessageChunk {
  "content": " French:\n\nJ",
}
AIMessageChunk {
  "content": "'adore la programmation",
}
AIMessageChunk {
  "content": ".",
}
AIMessageChunk {
  "content": "",
  "additional_kwargs": {
    "stop_reason": "end_turn",
    "stop_sequence": null
  },
  "usage_metadata": {
    "input_tokens": 0,
    "output_tokens": 19,
    "total_tokens": 19
  }
}
```
</details>

<br />

<details>
<summary><strong>Aggregate Streamed Chunks</strong></summary>

```typescript
import { AIMessageChunk } from '@langchain/core/messages';
import { concat } from '@langchain/core/utils/stream';

const stream = await llm.stream(input);
let full: AIMessageChunk | undefined;
for await (const chunk of stream) {
  full = !full ? chunk : concat(full, chunk);
}
console.log(full);
```

```txt
AIMessageChunk {
  "id": "msg_01SBTb5zSGXfjUc7yQ8EKEEA",
  "content": "Here's the translation to French:\n\nJ'adore la programmation.",
  "additional_kwargs": {
    "id": "msg_01SBTb5zSGXfjUc7yQ8EKEEA",
    "type": "message",
    "role": "assistant",
    "model": "claude-sonnet-4-5-20250929",
    "stop_reason": "end_turn",
    "stop_sequence": null
  },
  "usage_metadata": {
    "input_tokens": 25,
    "output_tokens": 20,
    "total_tokens": 45
  }
}
```
</details>

<br />

<details>
<summary><strong>Bind tools</strong></summary>

```typescript
import { z } from 'zod';

const GetWeather = {
  name: "GetWeather",
  description: "Get the current weather in a given location",
  schema: z.object({
    location: z.string().describe("The city and state, e.g. San Francisco, CA")
  }),
}

const GetPopulation = {
  name: "GetPopulation",
  description: "Get the current population in a given location",
  schema: z.object({
    location: z.string().describe("The city and state, e.g. San Francisco, CA")
  }),
}

const llmWithTools = llm.bindTools([GetWeather, GetPopulation]);
const aiMsg = await llmWithTools.invoke(
  "Which city is hotter today and which is bigger: LA or NY?"
);
console.log(aiMsg.tool_calls);
```

```txt
[
  {
    name: 'GetWeather',
    args: { location: 'Los Angeles, CA' },
    id: 'toolu_01WjW3Dann6BPJVtLhovdBD5',
    type: 'tool_call'
  },
  {
    name: 'GetWeather',
    args: { location: 'New York, NY' },
    id: 'toolu_01G6wfJgqi5zRmJomsmkyZXe',
    type: 'tool_call'
  },
  {
    name: 'GetPopulation',
    args: { location: 'Los Angeles, CA' },
    id: 'toolu_0165qYWBA2VFyUst5RA18zew',
    type: 'tool_call'
  },
  {
    name: 'GetPopulation',
    args: { location: 'New York, NY' },
    id: 'toolu_01PGNyP33vxr13tGqr7i3rDo',
    type: 'tool_call'
  }
]
```
</details>

<br />

<details>
<summary><strong>Tool Search</strong></summary>

Tool search enables Claude to dynamically discover and load tools on-demand
instead of loading all tool definitions upfront. This is useful when you have
many tools but want to avoid the overhead of sending all definitions with every request.

```typescript
import { ChatAnthropic } from "@langchain/anthropic";

const model = new ChatAnthropic({
  model: "claude-sonnet-4-5-20250929",
});

const tools = [
  // Tool search server tool
  {
    type: "tool_search_tool_regex_20251119",
    name: "tool_search_tool_regex",
  },
  // Tools with defer_loading are loaded on-demand
  {
    name: "get_weather",
    description: "Get the current weather for a location",
    input_schema: {
      type: "object",
      properties: {
        location: { type: "string", description: "City name" },
        unit: {
          type: "string",
          enum: ["celsius", "fahrenheit"],
        },
      },
      required: ["location"],
    },
    defer_loading: true, // Tool is loaded on-demand
  },
  {
    name: "search_files",
    description: "Search through files in the workspace",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
      },
      required: ["query"],
    },
    defer_loading: true, // Tool is loaded on-demand
  },
];

const modelWithTools = model.bindTools(tools);
const response = await modelWithTools.invoke("What's the weather in San Francisco?");
```

You can also use the `tool()` helper with the `extras` field:

```typescript
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const getWeather = tool(
  async (input) => `Weather in ${input.location}`,
  {
    name: "get_weather",
    description: "Get weather for a location",
    schema: z.object({ location: z.string() }),
    extras: { defer_loading: true },
  }
);
```

**Note:** The required `advanced-tool-use-2025-11-20` beta header is automatically
appended to the request when using tool search tools.

**Best practices:**
- Tools with `defer_loading: true` are only loaded when Claude discovers them via search
- Keep your 3-5 most frequently used tools as non-deferred for optimal performance
- Both regex and bm25 variants search tool names, descriptions, and argument info

See the Claude docs
for more information.
</details>

<br />

<details>
<summary><strong>Structured Output</strong></summary>

ChatAnthropic supports structured output through two main approaches:

1. **Function Calling with `withStructuredOutput()`**: Uses Anthropic's tool calling
   under the hood to constrain outputs to a specific schema.
2. **JSON Schema Mode**: Uses Anthropic's native JSON schema support for direct
   structured output without tool calling overhead.

**Using withStructuredOutput (Function Calling)**

This method leverages Anthropic's tool calling capabilities to ensure the model
returns data matching your schema:

```typescript
import { z } from 'zod';

const Joke = z.object({
  setup: z.string().describe("The setup of the joke"),
  punchline: z.string().describe("The punchline to the joke"),
  rating: z.number().optional().describe("How funny the joke is, from 1 to 10")
}).describe('Joke to tell user.');

const structuredLlm = llm.withStructuredOutput(Joke, { name: "Joke" });
const jokeResult = await structuredLlm.invoke("Tell me a joke about cats");
console.log(jokeResult);
```

```txt
{
  setup: "Why don't cats play poker in the jungle?",
  punchline: 'Too many cheetahs!',
  rating: 7
}
```

**Using JSON Schema Mode**

For more direct control, you can use Anthropic's native JSON schema support by
passing `method: "jsonSchema"`:

```typescript
import { z } from 'zod';

const RecipeSchema = z.object({
  recipeName: z.string().describe("Name of the recipe"),
  ingredients: z.array(z.string()).describe("List of ingredients needed"),
  steps: z.array(z.string()).describe("Cooking steps in order"),
  prepTime: z.number().describe("Preparation time in minutes")
});

const structuredLlm = llm.withStructuredOutput(RecipeSchema, {
  method: "jsonSchema"
});

const recipe = await structuredLlm.invoke(
  "Give me a simple recipe for chocolate chip cookies"
);
console.log(recipe);
```

```txt
{
  recipeName: 'Classic Chocolate Chip Cookies',
  ingredients: [
    '2 1/4 cups all-purpose flour',
    '1 cup butter, softened',
    ...
  ],
  steps: [
    'Preheat oven to 375°F',
    'Mix butter and sugars until creamy',
    ...
  ],
  prepTime: 15
}
```
</details>

<br />

<details>
<summary><strong>Multimodal</strong></summary>

```typescript
import { HumanMessage } from '@langchain/core/messages';

const imageUrl = "https://example.com/image.jpg";
const imageData = await fetch(imageUrl).then(res => res.arrayBuffer());
const base64Image = Buffer.from(imageData).toString('base64');

const message = new HumanMessage({
  content: [
    { type: "text", text: "describe the weather in this image" },
    {
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${base64Image}` },
    },
  ]
});

const imageDescriptionAiMsg = await llm.invoke([message]);
console.log(imageDescriptionAiMsg.content);
```

```txt
The weather in this image appears to be beautiful and clear. The sky is a vibrant blue with scattered white clouds, suggesting a sunny and pleasant day. The clouds are wispy and light, indicating calm conditions without any signs of storms or heavy weather. The bright green grass on the rolling hills looks lush and well-watered, which could mean recent rainfall or good growing conditions. Overall, the scene depicts a perfect spring or early summer day with mild temperatures, plenty of sunshine, and gentle breezes - ideal weather for enjoying the outdoors or for plant growth.
```
</details>

<br />

<details>
<summary><strong>Usage Metadata</strong></summary>

```typescript
const aiMsgForMetadata = await llm.invoke(input);
console.log(aiMsgForMetadata.usage_metadata);
```

```txt
{ input_tokens: 25, output_tokens: 19, total_tokens: 44 }
```
</details>

<br />

<details>
<summary><strong>Stream Usage Metadata</strong></summary>

```typescript
const streamForMetadata = await llm.stream(
  input,
  {
    streamUsage: true
  }
);
let fullForMetadata: AIMessageChunk | undefined;
for await (const chunk of streamForMetadata) {
  fullForMetadata = !fullForMetadata ? chunk : concat(fullForMetadata, chunk);
}
console.log(fullForMetadata?.usage_metadata);
```

```txt
{ input_tokens: 25, output_tokens: 20, total_tokens: 45 }
```
</details>

<br />

<details>
<summary><strong>Response Metadata</strong></summary>

```typescript
const aiMsgForResponseMetadata = await llm.invoke(input);
console.log(aiMsgForResponseMetadata.response_metadata);
```

```txt
{
  id: 'msg_01STxeQxJmp4sCSpioD6vK3L',
  model: 'claude-sonnet-4-5-20250929',
  stop_reason: 'end_turn',
  stop_sequence: null,
  usage: { input_tokens: 25, output_tokens: 19 },
  type: 'message',
  role: 'assistant'
}
```
</details>

<br />

## Signature

```javascript
class ChatAnthropic
```

## Extends

- `ChatAnthropicMessages`

## Constructors

- [`constructor()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/constructor)

## Properties

- `anthropicApiKey`
- `apiKey`
- `apiUrl`
- `batchClient`
- `betas`
- `cache`
- `callbacks`
- `caller`
- `clientOptions`
- `contextManagement`
- `createClient`
- `disableStreaming`
- `inferenceGeo`
- `invocationKwargs`
- `lc_kwargs`
- `lc_namespace`
- `lc_runnable`
- `lc_serializable`
- `maxTokens`
- `metadata`
- `model`
- `modelName`
- `name`
- `outputConfig`
- `outputVersion`
- `ParsedCallOptions`
- `stopSequences`
- `streaming`
- `streamingClient`
- `streamUsage`
- `tags`
- `temperature`
- `thinking`
- `topK`
- `topP`
- `verbose`
- `callKeys`
- `lc_aliases`
- `lc_attributes`
- `lc_id`
- `lc_secrets`
- `lc_serializable_keys`
- `profile`

## Methods

- [`_addVersion()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/_addVersion)
- [`_batchWithConfig()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/_batchWithConfig)
- [`_callWithConfig()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/_callWithConfig)
- [`_combineLLMOutput()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/_combineLLMOutput)
- [`_generateCached()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/_generateCached)
- [`_getOptionsList()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/_getOptionsList)
- [`_getSerializedCacheKeyParametersForCall()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/_getSerializedCacheKeyParametersForCall)
- [`_llmType()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/_llmType)
- [`_modelType()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/_modelType)
- [`_separateRunnableConfigFromCallOptions()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/_separateRunnableConfigFromCallOptions)
- [`_separateRunnableConfigFromCallOptionsCompat()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/_separateRunnableConfigFromCallOptionsCompat)
- [`_streamIterator()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/_streamIterator)
- [`_streamLog()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/_streamLog)
- [`_streamResponseChunks()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/_streamResponseChunks)
- [`_transformStreamWithConfig()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/_transformStreamWithConfig)
- [`assign()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/assign)
- [`asTool()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/asTool)
- [`batch()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/batch)
- [`bindTools()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/bindTools)
- [`createStreamWithRetry()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/createStreamWithRetry)
- [`formatStructuredToolToAnthropic()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/formatStructuredToolToAnthropic)
- [`generate()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/generate)
- [`generatePrompt()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/generatePrompt)
- [`getGraph()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/getGraph)
- [`getLsParams()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/getLsParams)
- [`getLsParamsWithDefaults()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/getLsParamsWithDefaults)
- [`getName()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/getName)
- [`getNumTokens()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/getNumTokens)
- [`identifyingParams()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/identifyingParams)
- [`invocationParams()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/invocationParams)
- [`invoke()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/invoke)
- [`pick()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/pick)
- [`pipe()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/pipe)
- [`serialize()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/serialize)
- [`stream()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/stream)
- [`streamEvents()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/streamEvents)
- [`streamLog()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/streamLog)
- [`toJSON()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/toJSON)
- [`toJSONNotImplemented()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/toJSONNotImplemented)
- [`transform()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/transform)
- [`withConfig()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/withConfig)
- [`withFallbacks()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/withFallbacks)
- [`withListeners()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/withListeners)
- [`withRetry()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/withRetry)
- [`withStructuredOutput()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/withStructuredOutput)
- [`_convertInputToPromptValue()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/_convertInputToPromptValue)
- [`deserialize()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/deserialize)
- [`isRunnable()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/isRunnable)
- [`lc_name()`](https://reference.langchain.com/javascript/langchain-anthropic/ChatAnthropic/lc_name)

---

[View source on GitHub](https://github.com/langchain-ai/langchainjs/blob/2301260ae90ead5c5f725c8dae1487b6722607e2/libs/providers/langchain-anthropic/src/chat_models.ts#L1724)