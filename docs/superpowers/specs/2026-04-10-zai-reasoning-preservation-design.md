# Z.AI Reasoning Preservation — Design

**Date:** 2026-04-10
**Status:** Approved, ready for implementation plan
**Owner:** Nexus agents team
**Supersedes:** Follow-up item tracked in memory note `project_zai_thinking_middleware.md`

## Problem

GLM-5.1 / GLM-4.7 on Z.AI have thinking enabled by default. Reasoning streams back on a non-standard `delta.reasoning_content` field, and the assistant message is expected to echo that field back verbatim on every subsequent turn (see https://docs.z.ai → Thinking Mode → Preserved Thinking).

LangChain's `@langchain/openai` **does** capture `reasoning_content` on the inbound path — it's stored on `AIMessage.additional_kwargs.reasoning_content` by both the streaming and non-streaming converters (`@langchain/openai/dist/converters/completions.js` lines 160, 175, 264). The bug is strictly **outbound**: `convertMessagesToCompletionsMessageParams` (same file, line 568) does not copy `additional_kwargs.reasoning_content` onto the assistant message param when serializing messages for the next request.

Consequences with thinking enabled:
1. Chain-of-thought continuity is lost between tool calls on every multi-turn agent.
2. On the GLM Coding Plan endpoint (`ZAI_BASE_URL=https://api.z.ai/api/coding/paas/v4`) preserved thinking is on by default, so dropping `reasoning_content` kills cache hits → higher latency and cost.
3. The degradation is silent — requests still succeed, output is just weaker than native z.ai usage.

To avoid silent regressions, `apps/agents/src/nexus/models/providers.ts` currently disables thinking with `modelKwargs: { thinking: { type: "disabled" } }`. This spec describes the work needed to re-enable it safely.

## Goals

- Round-trip `reasoning_content` verbatim on every multi-turn z.ai request.
- Zero behaviour change for OpenAI or any other provider.
- No dependency on upstream LangChain changes.
- Safe fallback: if anything unexpected happens, behave as today (no corruption of outbound requests).

## Non-Goals

- Rendering reasoning traces in the Nexus UI.
- OpenAI o-series reasoning round-trip (different field: `reasoning` / `reasoning_summary`, different contract).
- An upstream fix in `@langchain/openai`. Worth filing as a parallel issue, but not this spec's deliverable.

## Architecture

A thin `ChatOpenAI` subclass, used only by the `zai` provider factory, that intercepts the outbound request path just before the HTTP call and re-attaches `reasoning_content` to assistant message params.

```
resolveTier("deep-research")
  → providers.ts (zai factory)
    → new ZaiChatOpenAI({ ... })     ← subclass of ChatOpenAI
      → _generate / _streamResponseChunks
        → reasoningCtx.run(buildMap(messages), () => super._generate(...))
          → convertMessagesToCompletionsMessageParams  (LC internal, unchanged)
          → this.completionWithRetry(request)          ← overridden
            → inject reasoning_content onto request.messages
            → super.completionWithRetry(request)
              → openai.chat.completions.create(...)
```

No module-level patching, no fetch shim, no callback handler. All z.ai-specific logic lives in one file.

## File Layout

- `apps/agents/src/nexus/models/zai-chat-model.ts` — **new.** `ZaiChatOpenAI` subclass plus `buildReasoningMap`, `injectReasoningContent`, and the module-scoped `AsyncLocalStorage`.
- `apps/agents/src/nexus/models/providers.ts` — **modified.** `zai` factory uses `ZaiChatOpenAI` and drops `ZAI_DISABLE_THINKING`.
- `apps/agents/src/nexus/models/__tests__/zai-chat-model.test.ts` — **new.** Unit tests.
- `CLAUDE.md` — **modified.** Update the z.ai gotcha note.
- Memory note `project_zai_thinking_middleware.md` — **resolved.** Remove or mark resolved after merge.

## Mechanism

### 1. Inbound (capture) — no work

Upstream LC already handles this. Both code paths in `@langchain/openai/dist/converters/completions.js`:

- Non-streaming: `convertCompletionsMessageToBaseMessage` (line 158) reads `message.reasoning_content` and sets `additional_kwargs.reasoning_content` on the resulting `AIMessage` (line 175).
- Streaming: `convertCompletionsDeltaToBaseMessageChunk` (line ~250) reads `delta.reasoning_content` and sets `additional_kwargs.reasoning_content` on each `AIMessageChunk` (line 264). When chunks merge into a final `AIMessageChunk`, the reasoning string concatenates like normal `additional_kwargs`.

Verification task: confirm at test time that an `AIMessage` coming out of a z.ai call actually carries `additional_kwargs.reasoning_content`. If not, the inbound assumption is wrong and this spec needs a rework.

### 2. Outbound (echo)

`ZaiChatOpenAI extends ChatOpenAI` overrides three methods:

**`_generate(messages, options, runManager)`**
```ts
async _generate(messages, options, runManager) {
  const map = buildReasoningMap(messages);
  return reasoningCtx.run(map, () => super._generate(messages, options, runManager));
}
```

**`_streamResponseChunks(messages, options, runManager)`**
```ts
async *_streamResponseChunks(messages, options, runManager) {
  const map = buildReasoningMap(messages);
  // AsyncLocalStorage.run propagates through async generators in Node 18+.
  // We delegate to super and re-yield; the context covers the entire delegation.
  const gen = reasoningCtx.run(map, () => super._streamResponseChunks(messages, options, runManager));
  yield* gen;
}
```
If it turns out `AsyncLocalStorage.run` does not cover work performed inside the generator across `yield` boundaries on our Node version, fallback: eagerly consume super's generator inside `reasoningCtx.run(map, async () => { for await (...) buffer.push(...); })` then re-yield the buffer. Accepts buffering latency; still correct. Decide at implementation time based on a quick `node --version` + experiment.

**`completionWithRetry(request, requestOptions)`**
```ts
completionWithRetry(request, requestOptions) {
  const map = reasoningCtx.getStore();
  if (map) injectReasoningContent(request, map);
  return super.completionWithRetry(request, requestOptions);
}
```

### 3. `buildReasoningMap(messages)`

Walks the LC `messages` input in order. For every `AIMessage` (including `AIMessageChunk`), pushes `additional_kwargs.reasoning_content` (string) or `null`. Returns a plain array.

Order-alignment invariant: `convertMessagesToCompletionsMessageParams` is order-preserving via `flatMap`, and the only case where it emits an extra assistant param is `additional_kwargs.audio.id` (line 589), which we don't use on z.ai. So the Nth `AIMessage` in LC input maps to the Nth assistant-role param in the outbound request. The injector enforces this invariant defensively — see next section.

### 4. `injectReasoningContent(request, map)`

Walks `request.messages` with a local assistant-index counter. For each entry whose `role === "assistant"`, looks up `map[i++]`. If the value is a non-empty string, sets `entry.reasoning_content = value`. If counters disagree at the end (assistant count in request !== `map.length`), logs a single warning and returns without mutation — safer than corrupting the request.

Mutation is in place; the request object is single-use per call.

### 5. `AsyncLocalStorage`

```ts
import { AsyncLocalStorage } from "node:async_hooks";
const reasoningCtx = new AsyncLocalStorage<(string | null)[]>();
```

Module-scoped singleton. Scopes the reasoning array to one `_generate`/`_streamResponseChunks` call so concurrent requests never race. `completionWithRetry` on the same instance called without an active context (e.g., someone calls it directly) falls through unchanged.

### 6. Factory update

```ts
// providers.ts
import { ZaiChatOpenAI } from "./zai-chat-model.js";

zai: (id, opts) =>
  new ZaiChatOpenAI({
    model: id,
    apiKey: process.env.ZAI_API_KEY,
    configuration: {
      baseURL: process.env.ZAI_BASE_URL ?? ZAI_DEFAULT_BASE_URL,
    },
    ...(opts ?? {}),
  }) as unknown as BaseChatModel,
```

The `ZAI_DISABLE_THINKING` constant and its comment are deleted. Thinking inherits the GLM default (enabled).

If we want to be explicit rather than rely on the default, we can pass `modelKwargs: { thinking: { type: "enabled" } }`. Decide at implementation time based on what the z.ai docs recommend for the paid endpoint.

## Error Handling and Safety

- **Missing ALS context.** `completionWithRetry` override is a no-op passthrough. Any caller that reaches it outside our wrappers (including unit tests) behaves exactly like vanilla `ChatOpenAI`.
- **Assistant count mismatch.** `injectReasoningContent` logs a one-line warning (`[ZaiChatOpenAI] reasoning map/message count mismatch, skipping injection`) and returns without mutation. The request proceeds with thinking dropped on this turn — degraded but correct.
- **Non-string reasoning content.** Guard: only inject if `typeof value === "string" && value.length > 0`. Anything else is treated as null.
- **Other providers.** The subclass is only used by the `zai` factory; all other providers use stock `ChatOpenAI`/`ChatGoogle`/`ChatAnthropic` and are untouched.

## Testing

### Unit tests (`zai-chat-model.test.ts`, no API key required)

1. **`buildReasoningMap` ordering.** Input: `[SystemMessage, HumanMessage, AIMessage(r1), ToolMessage, AIMessage(no r), HumanMessage]`. Expected: `["r1", null]`.
2. **`buildReasoningMap` empty.** Input without AIMessage → `[]`.
3. **`injectReasoningContent` happy path.** Mock request with 2 assistant messages, map `["r1", "r2"]`. After call, assistant messages have the right `reasoning_content`; non-assistant messages unchanged.
4. **`injectReasoningContent` count mismatch.** Request has 1 assistant, map has 2 → warning emitted, request unchanged.
5. **`injectReasoningContent` null entries.** Map `[null, "r2"]`, 2 assistants → first unchanged, second gets `r2`.
6. **End-to-end with mocked `super.completionWithRetry`.** Subclass an instance, stub `super.completionWithRetry` on the prototype, invoke `_generate` with messages carrying reasoning, assert the stub received a request with injected `reasoning_content`.
7. **Context isolation.** Run two `_generate` calls concurrently with different reasoning arrays via `Promise.all`. Each captured request must contain its own reasoning, not the other's.
8. **No-op when context missing.** Call `completionWithRetry` directly (outside a wrapper) with a request containing an assistant message; assert it passes through to super unchanged.

### Integration test (`zai-chat-model.integration.test.ts`, gated on `ZAI_API_KEY`)

`describe.skipIf(!process.env.ZAI_API_KEY)` to skip when no key is present.

- Two-turn tool-call sequence against `https://api.z.ai/api/paas/v4` using a tiny tool (`get_time` or similar).
- Intercept the turn-2 outbound request via a fetch spy passed to `configuration.fetch`.
- Assert the serialized body contains, on the assistant message from turn 1, a `reasoning_content` field that is a non-empty string matching what came back in turn 1.

Run manually with `source .env && export ZAI_API_KEY && npx vitest run apps/agents/src/nexus/models/__tests__/zai-chat-model.integration.test.ts`.

## Documentation Updates

**`CLAUDE.md` gotcha list.** Replace the current z.ai paragraph ("Thinking is enabled by default on GLM-5.1 / GLM-4.7, but LangChain's ChatOpenAI silently drops `reasoning_content` between turns...") with something like:

> Z.AI GLM thinking is preserved automatically via `ZaiChatOpenAI` (a thin `ChatOpenAI` subclass at `apps/agents/src/nexus/models/zai-chat-model.ts`). It re-attaches `reasoning_content` to assistant messages on every outbound request so chain-of-thought and cache hits survive multi-turn tool calls. No per-call configuration needed.

**Memory note `project_zai_thinking_middleware.md`.** After merge, either delete it or rewrite as resolved with a pointer to the new file.

**Upstream follow-up.** File an issue on `langchain-ai/langchainjs` describing the outbound gap in `convertMessagesToCompletionsMessageParams`. Not blocking.

## Rollout

1. Land the subclass + tests behind no flag. The factory change flips thinking back on implicitly.
2. Run the integration test manually with a real z.ai key before merging.
3. Watch for degraded output on the `default` / `code` / `deep-research` tiers. If we see regressions, revert the factory to pass `modelKwargs: { thinking: { type: "disabled" } }` again — the subclass remains harmless.

## Risks

- **LC internal refactor.** If a future `@langchain/openai` version renames `completionWithRetry` or changes its signature, our override breaks. Mitigation: pin `@langchain/openai` in the monorepo override list and add a guard in the subclass constructor that checks `typeof super.completionWithRetry === "function"`.
- **ALS + async generator interaction.** Documented as a fallback in the mechanism section.
- **Undocumented z.ai contract drift.** If z.ai later changes the field name or contract, we need to re-read their docs. Low likelihood in the short term.

## Open Questions

- Should we explicitly pass `modelKwargs: { thinking: { type: "enabled" } }` in the `zai` factory, or rely on the GLM default? Leaning toward explicit for clarity, but depends on what the z.ai docs recommend for the paid `/api/coding/paas/v4` endpoint. Decide at implementation time.
- File the upstream LC issue now, or after our fix lands? Either works; doing it now is cheap.
