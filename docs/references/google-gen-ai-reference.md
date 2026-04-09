# ChatGoogleGenerativeAI

> **Class** in `@langchain/google-genai`

📖 [View in docs](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI)

Google Generative AI chat model integration.

Setup:
Install `@langchain/google-genai` and set an environment variable named `GOOGLE_API_KEY`.

```bash
npm install @langchain/google-genai
export GOOGLE_API_KEY="your-api-key"
```

## [Constructor args](https://api.js.langchain.com/classes/langchain_google_genai.ChatGoogleGenerativeAI.html#constructor)

## [Runtime args](https://api.js.langchain.com/interfaces/langchain_google_genai.GoogleGenerativeAIChatCallOptions.html)

Runtime args can be passed as the second argument to any of the base runnable methods `.invoke`. `.stream`, `.batch`, etc.
They can also be passed via `.withConfig`, or the second arg in `.bindTools`, like shown in the examples below:

```typescript
// When calling `.withConfig`, call options should be passed via the first argument
const llmWithArgsBound = llm.withConfig({
  stop: ["\n"],
});

// When calling `.bindTools`, call options should be passed via the second argument
const llmWithTools = llm.bindTools(
  [...],
  {
    stop: ["\n"],
  }
);
```

## Examples

<details open>
<summary><strong>Instantiate</strong></summary>

```typescript
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-1.5-flash",
  temperature: 0,
  maxRetries: 2,
  // apiKey: "...",
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
  "content": "There are a few ways to translate \"I love programming\" into French, depending on the level of formality and nuance you want to convey:\n\n**Formal:**\n\n* **J'aime la programmation.** (This is the most literal and formal translation.)\n\n**Informal:**\n\n* **J'adore programmer.** (This is a more enthusiastic and informal translation.)\n* **J'aime beaucoup programmer.** (This is a slightly less enthusiastic but still informal translation.)\n\n**More specific:**\n\n* **J'aime beaucoup coder.** (This specifically refers to writing code.)\n* **J'aime beaucoup développer des logiciels.** (This specifically refers to developing software.)\n\nThe best translation will depend on the context and your intended audience. \n",
  "response_metadata": {
    "finishReason": "STOP",
    "index": 0,
    "safetyRatings": [
      {
        "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        "probability": "NEGLIGIBLE"
      },
      {
        "category": "HARM_CATEGORY_HATE_SPEECH",
        "probability": "NEGLIGIBLE"
      },
      {
        "category": "HARM_CATEGORY_HARASSMENT",
        "probability": "NEGLIGIBLE"
      },
      {
        "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
        "probability": "NEGLIGIBLE"
      }
    ]
  },
  "usage_metadata": {
    "input_tokens": 10,
    "output_tokens": 149,
    "total_tokens": 159
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
  "content": "There",
  "response_metadata": {
    "index": 0
  }
  "usage_metadata": {
    "input_tokens": 10,
    "output_tokens": 1,
    "total_tokens": 11
  }
}
AIMessageChunk {
  "content": " are a few ways to translate \"I love programming\" into French, depending on",
}
AIMessageChunk {
  "content": " the level of formality and nuance you want to convey:\n\n**Formal:**\n\n",
}
AIMessageChunk {
  "content": "* **J'aime la programmation.** (This is the most literal and formal translation.)\n\n**Informal:**\n\n* **J'adore programmer.** (This",
}
AIMessageChunk {
  "content": " is a more enthusiastic and informal translation.)\n* **J'aime beaucoup programmer.** (This is a slightly less enthusiastic but still informal translation.)\n\n**More",
}
AIMessageChunk {
  "content": " specific:**\n\n* **J'aime beaucoup coder.** (This specifically refers to writing code.)\n* **J'aime beaucoup développer des logiciels.** (This specifically refers to developing software.)\n\nThe best translation will depend on the context and",
}
AIMessageChunk {
  "content": " your intended audience. \n",
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
  "content": "There are a few ways to translate \"I love programming\" into French, depending on the level of formality and nuance you want to convey:\n\n**Formal:**\n\n* **J'aime la programmation.** (This is the most literal and formal translation.)\n\n**Informal:**\n\n* **J'adore programmer.** (This is a more enthusiastic and informal translation.)\n* **J'aime beaucoup programmer.** (This is a slightly less enthusiastic but still informal translation.)\n\n**More specific:**\n\n* **J'aime beaucoup coder.** (This specifically refers to writing code.)\n* **J'aime beaucoup développer des logiciels.** (This specifically refers to developing software.)\n\nThe best translation will depend on the context and your intended audience. \n",
  "usage_metadata": {
    "input_tokens": 10,
    "output_tokens": 277,
    "total_tokens": 287
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
    type: 'tool_call'
  },
  {
    name: 'GetWeather',
    args: { location: 'New York, NY' },
    type: 'tool_call'
  },
  {
    name: 'GetPopulation',
    args: { location: 'Los Angeles, CA' },
    type: 'tool_call'
  },
  {
    name: 'GetPopulation',
    args: { location: 'New York, NY' },
    type: 'tool_call'
  }
]
```
</details>

<br />

<details>
<summary><strong>Structured Output</strong></summary>

```typescript
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
  setup: "Why don\\'t cats play poker?",
  punchline: "Why don\\'t cats play poker? Because they always have an ace up their sleeve!"
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
The weather in the image appears to be clear and sunny. The sky is mostly blue with a few scattered white clouds, indicating fair weather. The bright sunlight is casting shadows on the green, grassy hill, suggesting it is a pleasant day with good visibility. There are no signs of rain or stormy conditions.
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
{ input_tokens: 10, output_tokens: 149, total_tokens: 159 }
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
  finishReason: 'STOP',
  index: 0,
  safetyRatings: [
    {
      category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
      probability: 'NEGLIGIBLE'
    },
    {
      category: 'HARM_CATEGORY_HATE_SPEECH',
      probability: 'NEGLIGIBLE'
    },
    { category: 'HARM_CATEGORY_HARASSMENT', probability: 'NEGLIGIBLE' },
    {
      category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
      probability: 'NEGLIGIBLE'
    }
  ]
}
```
</details>

<br />

<details>
<summary><strong>Document Messages</strong></summary>

This example will show you how to pass documents such as PDFs to Google
Generative AI through messages.

```typescript
const pdfPath = "/Users/my_user/Downloads/invoice.pdf";
const pdfBase64 = await fs.readFile(pdfPath, "base64");

const response = await llm.invoke([
  ["system", "Use the provided documents to answer the question"],
  [
    "user",
    [
      {
        type: "application/pdf", // If the `type` field includes a single slash (`/`), it will be treated as inline data.
        data: pdfBase64,
      },
      {
        type: "text",
        text: "Summarize the contents of this PDF",
      },
    ],
  ],
]);

console.log(response.content);
```

```txt
This is a billing invoice from Twitter Developers for X API Basic Access. The transaction date is January 7, 2025,
and the amount is $194.34, which has been paid. The subscription period is from January 7, 2025 21:02 to February 7, 2025 00:00 (UTC).
The tax is $0.00, with a tax rate of 0%. The total amount is $194.34. The payment was made using a Visa card ending in 7022,
expiring in 12/2026. The billing address is Brace Sproul, 1234 Main Street, San Francisco, CA, US 94103. The company being billed is
X Corp, located at 865 FM 1209 Building 2, Bastrop, TX, US 78602. Terms and conditions apply.
```
</details>

<br />

## Signature

```javascript
class ChatGoogleGenerativeAI
```

## Extends

- `BaseChatModel<GoogleGenerativeAIChatCallOptions, AIMessageChunk>`

## Implements

- `GoogleGenerativeAIChatInput`

## Constructors

- [`constructor()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/constructor)

## Properties

- `apiKey`
- `cache`
- `callbacks`
- `caller`
- `convertSystemMessageToHumanContent`
- `disableStreaming`
- `json`
- `lc_kwargs`
- `lc_namespace`
- `lc_runnable`
- `lc_serializable`
- `maxOutputTokens`
- `metadata`
- `model`
- `name`
- `outputVersion`
- `ParsedCallOptions`
- `safetySettings`
- `stopSequences`
- `streaming`
- `streamUsage`
- `tags`
- `temperature`
- `thinkingConfig`
- `topK`
- `topP`
- `verbose`
- `_isMultimodalModel`
- `callKeys`
- `computeUseSystemInstruction`
- `lc_aliases`
- `lc_attributes`
- `lc_id`
- `lc_secrets`
- `lc_serializable_keys`
- `profile`
- `useSystemInstruction`

## Methods

- [`_addVersion()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/_addVersion)
- [`_batchWithConfig()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/_batchWithConfig)
- [`_callWithConfig()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/_callWithConfig)
- [`_combineLLMOutput()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/_combineLLMOutput)
- [`_generate()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/_generate)
- [`_generateCached()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/_generateCached)
- [`_getOptionsList()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/_getOptionsList)
- [`_getSerializedCacheKeyParametersForCall()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/_getSerializedCacheKeyParametersForCall)
- [`_identifyingParams()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/_identifyingParams)
- [`_llmType()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/_llmType)
- [`_modelType()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/_modelType)
- [`_separateRunnableConfigFromCallOptions()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/_separateRunnableConfigFromCallOptions)
- [`_separateRunnableConfigFromCallOptionsCompat()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/_separateRunnableConfigFromCallOptionsCompat)
- [`_streamIterator()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/_streamIterator)
- [`_streamLog()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/_streamLog)
- [`_streamResponseChunks()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/_streamResponseChunks)
- [`_transformStreamWithConfig()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/_transformStreamWithConfig)
- [`assign()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/assign)
- [`asTool()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/asTool)
- [`batch()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/batch)
- [`bindTools()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/bindTools)
- [`completionWithRetry()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/completionWithRetry)
- [`generate()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/generate)
- [`generatePrompt()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/generatePrompt)
- [`getGraph()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/getGraph)
- [`getLsParams()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/getLsParams)
- [`getLsParamsWithDefaults()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/getLsParamsWithDefaults)
- [`getName()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/getName)
- [`getNumTokens()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/getNumTokens)
- [`invocationParams()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/invocationParams)
- [`invoke()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/invoke)
- [`pick()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/pick)
- [`pipe()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/pipe)
- [`serialize()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/serialize)
- [`stream()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/stream)
- [`streamEvents()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/streamEvents)
- [`streamLog()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/streamLog)
- [`toJSON()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/toJSON)
- [`toJSONNotImplemented()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/toJSONNotImplemented)
- [`transform()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/transform)
- [`useCachedContent()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/useCachedContent)
- [`withConfig()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/withConfig)
- [`withFallbacks()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/withFallbacks)
- [`withListeners()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/withListeners)
- [`withRetry()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/withRetry)
- [`withStructuredOutput()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/withStructuredOutput)
- [`_convertInputToPromptValue()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/_convertInputToPromptValue)
- [`deserialize()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/deserialize)
- [`isRunnable()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/isRunnable)
- [`lc_name()`](https://reference.langchain.com/javascript/langchain-google-genai/ChatGoogleGenerativeAI/lc_name)

---

[View source on GitHub](https://github.com/langchain-ai/langchainjs/blob/9a65edff01f3cd4db79ff6d8cabec4acf9bc9b3a/libs/providers/langchain-google-genai/src/chat_models.ts#L594)