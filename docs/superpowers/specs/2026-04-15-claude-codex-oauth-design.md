# Claude Code OAuth + Codex CLI Providers

**Date:** 2026-04-15
**Status:** Design approved, ready for implementation plan
**Reference:** [deer-flow PR #1166](https://github.com/bytedance/deer-flow/pull/1166), local copies under `docs/references/deerflow-oauth/`

## Context

Nexus resolves chat models through `apps/agents/src/nexus/models/registry.ts`, which today supports four providers — Anthropic, OpenAI, Google, and Z.AI — all authenticated via plain API keys in env vars. Users with a Claude Max subscription or a ChatGPT Plus/Pro plan already hold OAuth credentials (Claude Code CLI, Codex CLI) that would let them run inference on those plans instead of being billed on pay-as-you-go API keys. Deer-flow shipped the Python version of this feature in PR #1166; we port it to TS so Nexus users can:

1. Use a Claude Code OAuth token (`sk-ant-oat...`) with `ChatAnthropic` via `Authorization: Bearer` + billing-header system block, instead of the standard `x-api-key` path.
2. Use a Codex CLI OAuth token to reach `chatgpt.com/backend-api/codex/responses` via a new custom `BaseChatModel`.

Both strategies fall back gracefully if the credential is absent — existing API-key flows remain unchanged. This is strictly additive.

## Scope

**In scope**
- New credential loader module that reads env, FD, override path, and default CLI credential files.
- `ClaudeOAuthChatAnthropic` — subclass of `@langchain/anthropic`'s `ChatAnthropic` that swaps auth mechanism and injects billing plumbing.
- `CodexChatModel` — from-scratch `BaseChatModel` subclass implementing the ChatGPT Codex Responses API over SSE.
- Registry wiring: two new provider IDs (`claude-oauth`, `codex`), tier-priority updates, preflight reporting.
- Unit tests mirroring the Deer-flow test surface.

**Out of scope**
- OAuth token refresh flow. We only read tokens; expired tokens log a warning and return `null`. Users re-run `claude setup-token` / `codex login`.
- macOS Keychain probing. Deer-flow dropped Keychain support in #1166 in favor of explicit handoff; we follow suit.
- UI changes beyond preflight log additions.
- Docker compose credential mounts (can be a follow-up — see "Follow-ups").

## Architecture

```
apps/agents/src/nexus/models/
├── credentials.ts            (NEW) — credential loaders
├── claude-oauth-chat-model.ts (NEW) — ChatAnthropic subclass
├── codex-chat-model.ts       (NEW) — BaseChatModel subclass
├── types.ts                  (MOD) — add "claude-oauth" | "codex" to ProviderId
├── availability.ts           (MOD) — add isClaudeOAuthAvailable(), isCodexCliAvailable()
├── providers.ts              (MOD) — add two new factories
└── registry.ts               (MOD) — extend MODEL_CATALOG, TIER_PRIORITY
apps/agents/src/nexus/preflight.ts (MOD) — print OAuth/CLI auth status
```

Each component has one clear purpose, communicates through well-defined interfaces, and can be tested in isolation. The credential layer is a pure function layer with zero side effects at import time — the rest of the stack sees cached dataclasses.

## Component 1 — Credential loader (`models/credentials.ts`)

Pure-function module. No module-level IO; callers invoke the loaders at startup or at provider factory time.

### Types

```ts
export interface ClaudeOAuthCredential {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;  // epoch ms
  source: "claude-cli-env" | "claude-cli-fd" | "claude-cli-file";
}

export interface CodexCliCredential {
  accessToken: string;
  accountId: string;
  source: "codex-cli-env" | "codex-cli-file";
}

export function loadClaudeOAuthCredential(): ClaudeOAuthCredential | null;
export function loadCodexCliCredential(): CodexCliCredential | null;
export function isClaudeOAuthToken(token: string): boolean;
export const OAUTH_ANTHROPIC_BETAS: string;
```

### Claude loader — lookup order

Mirrors Deer-flow's `load_claude_code_credential` (`credential_loader.py:136-188`):

1. `CLAUDE_CODE_OAUTH_TOKEN` env
2. `ANTHROPIC_AUTH_TOKEN` env
3. `CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR` — numeric FD read via `fs.readSync(fd, buffer, 0, 1024*1024, null)`
4. `CLAUDE_CODE_CREDENTIALS_PATH` env override (skipped if value is missing, not a file, or malformed)
5. `${HOME}/.claude/.credentials.json` (or `os.homedir()` on Windows)

### File shape

```json
{
  "claudeAiOauth": {
    "accessToken": "sk-ant-oat01-...",
    "refreshToken": "sk-ant-ort01-...",
    "expiresAt": 1773430695128,
    "scopes": ["user:inference"]
  }
}
```

### Required edge-case behaviors (locked in by Deer-flow tests)

- **Whitespace trim**: `CLAUDE_CODE_OAUTH_TOKEN="  sk-ant-oat01-env  "` must yield `"sk-ant-oat01-env"`.
- **Override falls back**: if `CLAUDE_CODE_CREDENTIALS_PATH` points to a directory or missing file, silently fall back to the default path — not an error.
- **Empty file / missing field**: missing `claudeAiOauth.accessToken` returns `null`.
- **Expiry check**: if `expiresAt` is set and `Date.now() > expiresAt - 60_000`, log a warning and return `null`.
- **`isClaudeOAuthToken(token)`**: returns `true` iff the string contains `"sk-ant-oat"`. Used downstream to distinguish OAuth tokens from API keys if a user pastes one into `ANTHROPIC_API_KEY` by mistake.
- **`OAUTH_ANTHROPIC_BETAS`** constant: `"oauth-2025-04-20,claude-code-20250219,interleaved-thinking-2025-05-14"`.

### Codex loader — lookup order

Mirrors Deer-flow's `load_codex_cli_credential` (`credential_loader.py:190-210`):

1. `CODEX_ACCESS_TOKEN` + `CODEX_ACCOUNT_ID` env (both must be present; source `codex-cli-env`)
2. `CODEX_AUTH_PATH` env override
3. `${HOME}/.codex/auth.json` (or Windows equivalent)

### File shape (two supported variants)

**Current (nested):**
```json
{ "tokens": { "access_token": "...", "account_id": "acct_123" } }
```

**Legacy (top-level):**
```json
{ "access_token": "...", "token": "...", "account_id": "..." }
```

Read order: `data.access_token` → `data.token` → `data.tokens.access_token`. `account_id` read from top-level first, then `tokens.account_id`. Missing `account_id` is not an error — defaults to `""`.

### Caching

Results are cached per process on first call, invalidated never (lifetime matches the LangGraph server process). Test hooks reset the cache via an exported `__resetCredentialCacheForTesting()` function.

## Component 2 — Claude OAuth transport (`models/claude-oauth-chat-model.ts`)

Subclass of `ChatAnthropic` from `@langchain/anthropic`. Parallel to how `ZaiChatOpenAI` subclasses `ChatOpenAI` (see `models/zai-chat-model.ts:176-195` for the client-patching pattern).

### Class surface

```ts
interface ClaudeOAuthChatAnthropicFields extends ChatAnthropicFields {
  oauthToken: string;
}

export class ClaudeOAuthChatAnthropic extends ChatAnthropic {
  constructor(fields: ClaudeOAuthChatAnthropicFields) { ... }
}
```

### What the constructor does

1. Call `super({ ...fields, apiKey: "placeholder" })` — `ChatAnthropic` validates that `apiKey` is non-empty, so we pass a placeholder. The real token goes onto the Anthropic SDK client below.
2. Inject beta headers via `clientOptions.defaultHeaders`:
   - `"anthropic-beta": OAUTH_ANTHROPIC_BETAS`
3. Patch the inner `@anthropic-ai/sdk` client (accessed via `(this as any).batchClient` or the same field `ZaiChatOpenAI` uses): clear `client.apiKey`, set `client.authToken = oauthToken`. The SDK's auth method check prefers `authToken` and emits `Authorization: Bearer <token>` instead of `x-api-key`. Verify by reading `node_modules/@anthropic-ai/sdk/src/client.ts` before merging — if the field name differs, adapt.
4. Override `withConfig()` to re-wrap as `ClaudeOAuthChatAnthropic` (mirrors `zai-chat-model.ts:227` pattern) so tool binding doesn't silently downgrade to vanilla `ChatAnthropic`.

### Payload shaping — override `invocationParams` or equivalent hook

Before dispatching to the SDK, mutate the request payload:

**1. Inject billing system block (required — endpoint rejects OAuth requests without it)**

```ts
const billingBlock = {
  type: "text",
  text: OAUTH_BILLING_HEADER, // default: "x-anthropic-billing-header: cc_version=2.1.85.351; cc_entrypoint=cli; cch=6c6d5;"
};
```

The block must be the first entry in `payload.system`. If `system` is a string, wrap it. If `system` is an array, filter out any existing billing block and prepend. Matches Deer-flow's `_apply_oauth_billing` exactly (`claude_provider.py:165-189`). Env override: `ANTHROPIC_BILLING_HEADER`.

**2. Inject `metadata.user_id` (required — endpoint rejects OAuth requests without it)**

Generate once per instance:
```ts
const hostname = os.hostname();
const deviceId = crypto.createHash("sha256").update(`nexus-${hostname}`).digest("hex");
const sessionId = crypto.randomUUID();
payload.metadata ??= {};
payload.metadata.user_id ??= JSON.stringify({
  device_id: deviceId,
  account_uuid: "nexus",
  session_id: sessionId,
});
```

Matches `claude_provider.py:192-207`.

**3. Disable prompt caching**

OAuth tokens have a hard cap of 4 `cache_control` blocks per request. Threading that limit through the caller is too brittle for v1, so set `enable_prompt_caching = false` unconditionally when auth is OAuth. Document this as a known cost regression vs API-key mode. Users who need caching should keep using `ANTHROPIC_API_KEY`.

**4. Strip any stray `cache_control` blocks** before the outbound request, in case something upstream added them (middleware, etc.). Mirrors Deer-flow's `_strip_cache_control` (`claude_provider.py:230-252`).

### Retry semantics

Inherit `ChatAnthropic`'s built-in retry config from `@langchain/anthropic`. Do not reimplement exponential backoff — Deer-flow did it manually because they were overriding `_generate`/`_agenerate` for auth patching; we don't need to.

## Component 3 — Codex transport (`models/codex-chat-model.ts`)

A from-scratch `BaseChatModel` subclass. The ChatGPT Codex endpoint is wire-incompatible with Chat Completions — it's Responses API with mandatory SSE streaming and flattened tool shapes — so subclassing `ChatOpenAI` is not an option.

### Class surface

```ts
export interface CodexChatModelFields extends BaseChatModelParams {
  model?: string;              // default: "gpt-5.4"
  reasoningEffort?: "none" | "low" | "medium" | "high" | "xhigh";  // default: "medium"
  thinkingEnabled?: boolean;   // default: true; when false forces reasoningEffort to "none"
  retryMaxAttempts?: number;   // default: 3, must be >= 1
  accessToken?: string;        // injected by factory; fallback to loadCodexCliCredential()
  accountId?: string;
}

export class CodexChatModel extends BaseChatModel {
  _llmType() { return "codex-responses"; }
  async _generate(messages, options, runManager): Promise<ChatResult>;
  bindTools(tools, kwargs): Runnable<BaseLanguageModelInput, AIMessageChunk>;
}
```

### Endpoint & headers

```
POST https://chatgpt.com/backend-api/codex/responses
Authorization: Bearer <accessToken>
ChatGPT-Account-ID: <accountId>
Content-Type: application/json
Accept: text/event-stream
originator: codex_cli_rs
```

### Payload shape

```ts
{
  model: this.model,
  instructions: string,
  input: InputItem[],
  store: false,
  stream: true,
  reasoning: this.reasoningEffort === "none"
    ? { effort: "none" }
    : { effort: this.reasoningEffort, summary: "detailed" },
  tools?: ConvertedTool[],
}
```

**Critical**: `max_tokens` and `max_output_tokens` must NOT appear in the payload. The ChatGPT Codex endpoint rejects them. Confirmed by Deer-flow `factory.py:67`: `model_settings_from_config.pop("max_tokens", None)`. The constructor must silently drop these fields from any `CodexChatModelFields` it receives.

### Message conversion (`_convertMessages`)

```
LangChain BaseMessage[] → { instructions: string, input: InputItem[] }
```

| LangChain | Codex input item |
|---|---|
| `SystemMessage` | appended to `instructions`, joined with `\n\n` |
| `HumanMessage` | `{ role: "user", content: normalizeContent(msg.content) }` |
| `AIMessage.content` | `{ role: "assistant", content: normalizeContent(msg.content) }` (only if non-empty) |
| `AIMessage.tool_calls[i]` | `{ type: "function_call", name, arguments: JSON.stringify(args), call_id: id }` |
| `ToolMessage` | `{ type: "function_call_output", call_id: msg.tool_call_id, output: normalizeContent(msg.content) }` |

`normalizeContent` helper flattens LangChain structured content blocks:
- string → string
- `Array<{type: "text", text: string}>` → join on `\n`
- `{text: string}` | `{output: string}` | `{content: ...}` → recurse
- fallback → `JSON.stringify` or `String(x)`

Matches `openai_codex_provider.py:108-137`.

When `instructions` is empty after walking all system messages, default to `"You are a helpful assistant."` (matches Deer-flow's behavior in `_convert_messages` and locks in test `test_codex_provider_flattens_structured_text_blocks`).

### Tool conversion (`_convertTools`)

Codex Responses API uses a **flattened** tool shape — not the Chat Completions wrapper:

```ts
// Codex format (correct):
{ type: "function", name, description, parameters }

// Chat Completions format (WRONG for Codex):
{ type: "function", function: { name, description, parameters } }
```

Convert via `convertToOpenAIFunction` from `@langchain/core/utils/function_calling` for the JSON Schema shape, then unwrap one level.

### `bindTools()`

Return a `RunnableBinding` that injects `tools` into `_generate` kwargs. Pattern matches `ChatAnthropic.bindTools` — accept `StructuredTool[]`, `ToolDefinition[]`, and raw dicts; route through `_convertTools`.

### SSE streaming

Use native `fetch` (Node 20+). After `POST`, read `response.body.getReader()`, decode with `TextDecoder`, split on `\n`, track a buffer for incomplete lines, and parse lines matching `^data: `.

**Parser edge cases (locked in by Deer-flow tests):**
- Skip lines starting with `event:` (return `null`)
- Skip lines with `data: [DONE]`
- Skip non-JSON payloads without throwing (log at debug, continue)
- Skip empty `data:` lines

**Events to handle:**
- `response.output_item.done` → store `item` under `data.output_index` in a `streamedOutputItems` map. Codex sometimes ends the stream with an empty `response.output`, and these events are the only source of truth for message content.
- `response.completed` → capture `data.response` and stop reading.

### Post-stream merge

After the stream closes:
```ts
if (!completedResponse) throw new Error("Codex API stream ended without response.completed event");
// Merge streamedOutputItems into completedResponse.output
const merged = [...(completedResponse.output ?? [])];
const maxIndex = Math.max(...streamedOutputItems.keys(), merged.length - 1);
while (merged.length <= maxIndex) merged.push(null);
for (const [idx, item] of streamedOutputItems) {
  if (typeof merged[idx] !== "object" || merged[idx] === null) merged[idx] = item;
}
completedResponse.output = merged.filter(x => typeof x === "object" && x !== null);
```

Matches `openai_codex_provider.py:228-249`.

### Response parsing (`_parseResponse`)

Walk `response.output[]`:
- `type: "reasoning"` → concatenate `summary[].text` into `additional_kwargs.reasoning_content`
- `type: "message"` → concatenate `content[].output_text.text` into `AIMessage.content`
- `type: "function_call"` → JSON.parse `arguments` with try/catch; success → `tool_calls` entry; failure → `invalid_tool_calls` entry with `{ type, name, args, id, error }` shape

Return:
```ts
new AIMessage({
  content,
  tool_calls,
  invalid_tool_calls,
  additional_kwargs: reasoning_content ? { reasoning_content } : {},
  response_metadata: {
    model: response.model ?? this.model,
    usage: response.usage,
  },
});
```

### Retry semantics

Retry on HTTP `429`, `500`, `529`. Other status codes throw immediately. Backoff: `2000 * 2^(attempt-1)` ms with 20% jitter, honoring `Retry-After` header when present. Max 3 attempts (configurable via `retryMaxAttempts`, must be `>= 1`).

## Component 4 — Registry wiring

### `models/types.ts`

```ts
export type ProviderId = "google" | "anthropic" | "openai" | "zai" | "claude-oauth" | "codex";
```

### `models/availability.ts`

```ts
export function isClaudeOAuthAvailable(): boolean {
  return loadClaudeOAuthCredential() !== null;
}
export function isCodexCliAvailable(): boolean {
  return loadCodexCliCredential() !== null;
}
```

Extend `isProviderAvailable(provider: ProviderId)` switch with the two new cases.

### `models/providers.ts`

```ts
"claude-oauth": (id, opts) => {
  const cred = loadClaudeOAuthCredential();
  if (!cred) throw new Error("Claude OAuth credential not found");
  return new ClaudeOAuthChatAnthropic({
    model: id,
    oauthToken: cred.accessToken,
    ...(opts ?? {}),
  }) as unknown as BaseChatModel;
},
"codex": (id, opts) => {
  const cred = loadCodexCliCredential();
  if (!cred) throw new Error("Codex CLI credential not found");
  const { maxTokens: _omitMax, ...rest } = (opts ?? {}) as Record<string, unknown>;
  return new CodexChatModel({
    model: id,
    accessToken: cred.accessToken,
    accountId: cred.accountId,
    ...rest,
  }) as unknown as BaseChatModel;
},
```

### `models/registry.ts`

**MODEL_CATALOG additions** — for every existing `provider: "anthropic"` entry, add a twin entry with `provider: "claude-oauth"` and the same `id` and tiers. This way the OAuth path can serve every model the API-key path can. One new Codex entry:

```ts
{ provider: "codex", id: "gpt-5.4", tiers: ["code"] }
```

**TIER_PRIORITY changes:**

```ts
// For every tier that contains "anthropic", insert "claude-oauth" immediately before it:
default:       ["claude-oauth", "anthropic", "google", "openai", "zai"]
code:          ["claude-oauth", "anthropic", "zai", "codex"]
deep-research: ["claude-oauth", "anthropic", "google"]
classifier:    ["claude-oauth", "anthropic", "google", "openai"]
image:         ["google"] // unchanged
```

When `isClaudeOAuthAvailable()` is false, `resolveTier` skips `claude-oauth` and falls through to `anthropic`, preserving existing behavior. When Codex credential is missing, `code` tier still has three options ahead of it.

### `nexus/preflight.ts`

Add two new rows printed alongside existing provider status:

```
[Nexus] Providers:
  anthropic        [OK]
  claude-oauth     [OK] (source: env, caching: off)
  openai           [OK]
  zai              [--]
  google           [OK] (api-key)
  codex            [OK] (account: acct_123...)
```

Rows for `claude-oauth` and `codex` only appear when their respective loaders return non-null. Mask `accountId` to first 8 chars + `...`.

## Testing

Unit tests live in `apps/agents/src/nexus/models/__tests__/`. Three new files parallel to existing ones:

### `credentials.test.ts`

Mirrors `test_credential_loader.py`:
- `loadClaudeOAuthCredential` from direct env var (with whitespace trim)
- `loadClaudeOAuthCredential` from `ANTHROPIC_AUTH_TOKEN` env
- `loadClaudeOAuthCredential` from file descriptor (use `fs.openSync` on a tmp file)
- `loadClaudeOAuthCredential` from override path
- `loadClaudeOAuthCredential` ignores directory path → falls back to default
- `loadClaudeOAuthCredential` falls back to default file when override is invalid
- `loadClaudeOAuthCredential` returns `null` for expired token
- `loadCodexCliCredential` from nested `tokens` shape
- `loadCodexCliCredential` from legacy top-level shape
- `loadCodexCliCredential` returns `null` when no token present
- Reset cache between tests via `__resetCredentialCacheForTesting()`

### `claude-oauth-chat-model.test.ts`

- Constructor injects `anthropic-beta` header
- Constructor rejects missing `oauthToken`
- `invocationParams` places billing block first in `system` array
- `invocationParams` de-duplicates existing billing blocks
- `invocationParams` injects `metadata.user_id` with parseable JSON
- `invocationParams` strips all `cache_control` entries from `system`, `messages`, and `tools`
- `withConfig()` returns a `ClaudeOAuthChatAnthropic` instance (not base `ChatAnthropic`)

### `codex-chat-model.test.ts`

Mirrors `test_cli_auth_providers.py`:
- `new CodexChatModel({ retryMaxAttempts: 0 })` throws `"retry_max_attempts must be >= 1"`
- `new CodexChatModel({})` throws when credential loader returns null
- `_convertMessages` concatenates multiple system messages with `\n\n`
- `_convertMessages` flattens structured text blocks
- `_convertMessages` with empty instructions falls back to `"You are a helpful assistant."`
- `_parseResponse` marks invalid tool arguments as `invalid_tool_calls`
- `_parseResponse` parses valid tool arguments into `tool_calls`
- `_parseResponse` extracts reasoning content into `additional_kwargs.reasoning_content`
- SSE parser skips `[DONE]`, `event:` lines, non-JSON frames
- Tool conversion produces flattened shape (no nested `function` wrapper)
- Constructor strips `maxTokens` from the payload

### Integration smoke test (gated)

Add `codex-chat-model.integration.test.ts` following the existing `zai-chat-model.integration.test.ts` pattern — skipped unless `CODEX_ACCESS_TOKEN` + `CODEX_ACCOUNT_ID` are present. Sends a one-shot message and asserts the response has non-empty content.

Same for `claude-oauth-chat-model.integration.test.ts` — skipped unless `CLAUDE_CODE_OAUTH_TOKEN` is set.

Both integration tests live alongside the existing integration tests listed in `CLAUDE.md`'s "Verification pass-bar" section, and should be treated the same way: expected to skip locally when creds are absent, not a regression when they do.

## Verification

End-to-end sanity checks before calling this done:

1. **Lint + typecheck**: `cd apps/agents && npm run lint && npx tsc --noEmit` — clean.
2. **Unit tests**: `cd apps/agents && npm test` — all three new test files pass, existing tests unaffected.
3. **Preflight output**: start the dev server with no OAuth tokens set. `claude-oauth` and `codex` rows do not appear. Existing provider rows unchanged.
4. **Preflight output (env)**: `CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-fake npm run dev` → preflight prints `claude-oauth [OK] (source: env, caching: off)`. Invalid token doesn't crash startup.
5. **Preflight output (file)**: drop a valid `~/.claude/.credentials.json` with a real token, start server, confirm preflight picks it up.
6. **Tier resolution**: with OAuth token set, call `resolveTier("default")` — confirm return is a `ClaudeOAuthChatAnthropic` instance (not `ChatAnthropic`).
7. **Live Claude OAuth test**: with a real token, submit a short prompt through the orchestrator. Confirm the response comes back, no 4xx errors in agent logs, and the request actually used `Authorization: Bearer` (check via a local Anthropic SDK proxy or outbound traffic capture if needed).
8. **Live Codex test**: same — with `CODEX_ACCESS_TOKEN` + `CODEX_ACCOUNT_ID` set, route a short prompt through the `code` tier with `claude-oauth` and `anthropic` disabled (e.g. via `configurable.models.code = "codex:gpt-5.4"`), confirm response.
9. **Fallback preserved**: with no OAuth creds, submit a prompt — existing API-key path works as before. Run existing tests in `models/__tests__` to confirm no regressions.

## Follow-ups (out of this spec)

- Docker compose: bind-mount `~/.claude` and `~/.codex` as directories (not single-file binds) into the agents container. Matches Deer-flow's `docker-compose.yaml` change in #1166.
- macOS Keychain helper: port Deer-flow's `scripts/export_claude_code_oauth.py` as an optional utility for Mac users. Not needed on Windows/Linux.
- Token refresh flow: call Anthropic's `/oauth/token/refresh` endpoint when `refreshToken` is present and `expiresAt` is past. Non-trivial; separate spec.
- Streaming follow-up: `CodexChatModel._streamResponseChunks()` already emits token-level chunks from the Codex SSE response in this design (implemented as part of Task 16 — `response.output_text.delta`, `response.reasoning_summary_text.delta`, `response.function_call_arguments.delta`, `response.output_item.added/done`, and `response.completed` are all handled directly in the generator). Any later follow-up should focus on downstream streaming parity / UX validation (for example, confirming LangGraph → frontend propagation semantics), not on adding `_streamResponseChunks()` itself.
- Copy the four additional reference files from Deer-flow PR #1166 (`factory.py`, `test_cli_auth_providers.py`, `test_credential_loader.py`, and the `scripts/export_claude_code_oauth.py` helper) into `docs/references/deerflow-oauth/` alongside the three already dropped.

## Files touched (summary)

**New**
- `apps/agents/src/nexus/models/credentials.ts`
- `apps/agents/src/nexus/models/claude-oauth-chat-model.ts`
- `apps/agents/src/nexus/models/codex-chat-model.ts`
- `apps/agents/src/nexus/models/__tests__/credentials.test.ts`
- `apps/agents/src/nexus/models/__tests__/claude-oauth-chat-model.test.ts`
- `apps/agents/src/nexus/models/__tests__/codex-chat-model.test.ts`
- `apps/agents/src/nexus/models/__tests__/claude-oauth-chat-model.integration.test.ts` (gated)
- `apps/agents/src/nexus/models/__tests__/codex-chat-model.integration.test.ts` (gated)

**Modified**
- `apps/agents/src/nexus/models/types.ts`
- `apps/agents/src/nexus/models/availability.ts`
- `apps/agents/src/nexus/models/providers.ts`
- `apps/agents/src/nexus/models/registry.ts`
- `apps/agents/src/nexus/models/index.ts` (re-exports)
- `apps/agents/src/nexus/preflight.ts`
- `CLAUDE.md` — add OAuth env vars to the runtime prerequisites section
