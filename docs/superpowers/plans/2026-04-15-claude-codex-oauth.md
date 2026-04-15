# Claude OAuth + Codex CLI Providers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two new chat-model providers to Nexus: Claude Code OAuth (reuses a Claude Max subscription via `sk-ant-oat` tokens) and Codex CLI (reuses a ChatGPT Plus/Pro subscription via `~/.codex/auth.json`).

**Architecture:** New `credentials.ts` module loads tokens from env / FD / CLI files. `ClaudeOAuthChatAnthropic` subclasses `@langchain/anthropic`'s `ChatAnthropic` and uses the `createClient` hook to construct the underlying Anthropic SDK client with `authToken` instead of `apiKey`, plus an `invocationParams` override that prepends the billing-header system block and injects `metadata.user_id`. `CodexChatModel` is a from-scratch `BaseChatModel` that hits `chatgpt.com/backend-api/codex/responses` over SSE. Both plug into the existing `providerFactories` + `TIER_PRIORITY` registry with `claude-oauth` taking precedence over `anthropic` and `codex` appended to the `code` tier.

**Tech Stack:** TypeScript, `@langchain/anthropic` 1.3.26, `@langchain/core` 1.1.39, `@anthropic-ai/sdk` 0.74 (transitive), native `fetch` + `ReadableStream` for SSE, Vitest for tests.

**Spec:** `docs/superpowers/specs/2026-04-15-claude-codex-oauth-design.md`
**Reference code:** `docs/references/deerflow-oauth/{credential_loader.py,claude_provider.py,openai_codex_provider.py}` (Python originals from [deer-flow PR #1166](https://github.com/bytedance/deer-flow/pull/1166))

---

## File Structure

**New files:**
- `apps/agents/src/nexus/models/credentials.ts` — credential loader (env/FD/file), `isClaudeOAuthToken`, `OAUTH_ANTHROPIC_BETAS` constant
- `apps/agents/src/nexus/models/claude-oauth-chat-model.ts` — `ClaudeOAuthChatAnthropic` subclass
- `apps/agents/src/nexus/models/codex-chat-model.ts` — `CodexChatModel` subclass of `BaseChatModel`
- `apps/agents/src/nexus/models/__tests__/credentials.test.ts` — unit tests for loaders
- `apps/agents/src/nexus/models/__tests__/claude-oauth-chat-model.test.ts` — constructor + payload shaping tests
- `apps/agents/src/nexus/models/__tests__/codex-chat-model.test.ts` — message conversion, SSE parsing, response parsing tests
- `apps/agents/src/nexus/models/__tests__/claude-oauth-chat-model.integration.test.ts` — gated on `CLAUDE_CODE_OAUTH_TOKEN`
- `apps/agents/src/nexus/models/__tests__/codex-chat-model.integration.test.ts` — gated on `CODEX_ACCESS_TOKEN`

**Modified files:**
- `apps/agents/src/nexus/models/types.ts` — extend `ProviderId` union
- `apps/agents/src/nexus/models/availability.ts` — add `isClaudeOAuthAvailable`, `isCodexCliAvailable`, extend `isProviderAvailable` switch
- `apps/agents/src/nexus/models/providers.ts` — two new factory entries
- `apps/agents/src/nexus/models/registry.ts` — extend `MODEL_CATALOG` and `TIER_PRIORITY`
- `apps/agents/src/nexus/models/index.ts` — re-export new modules
- `apps/agents/src/nexus/preflight.ts` — print OAuth/Codex rows
- `CLAUDE.md` — add new env vars to runtime prerequisites

---

## Task 1 — Credential loader: types, helpers, Claude loader

**Files:**
- Create: `apps/agents/src/nexus/models/credentials.ts`
- Create: `apps/agents/src/nexus/models/__tests__/credentials.test.ts`

- [ ] **Step 1: Write failing tests for `loadClaudeOAuthCredential`**

Create `apps/agents/src/nexus/models/__tests__/credentials.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, openSync, rmSync, writeFileSync, writeSync, closeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  __resetCredentialCacheForTesting,
  isClaudeOAuthToken,
  loadClaudeOAuthCredential,
  OAUTH_ANTHROPIC_BETAS,
} from "../credentials.js";

const CLAUDE_ENV_VARS = [
  "CLAUDE_CODE_OAUTH_TOKEN",
  "ANTHROPIC_AUTH_TOKEN",
  "CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR",
  "CLAUDE_CODE_CREDENTIALS_PATH",
  "HOME",
  "USERPROFILE",
];

function clearClaudeEnv(): void {
  for (const v of CLAUDE_ENV_VARS) delete process.env[v];
}

describe("loadClaudeOAuthCredential", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "nexus-cred-"));
    clearClaudeEnv();
    process.env.HOME = tmp;
    __resetCredentialCacheForTesting();
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    clearClaudeEnv();
    __resetCredentialCacheForTesting();
  });

  it("loads from CLAUDE_CODE_OAUTH_TOKEN and trims whitespace", () => {
    process.env.CLAUDE_CODE_OAUTH_TOKEN = "  sk-ant-oat01-env  ";
    const cred = loadClaudeOAuthCredential();
    expect(cred).not.toBeNull();
    expect(cred!.accessToken).toBe("sk-ant-oat01-env");
    expect(cred!.source).toBe("claude-cli-env");
  });

  it("loads from ANTHROPIC_AUTH_TOKEN as fallback", () => {
    process.env.ANTHROPIC_AUTH_TOKEN = "sk-ant-oat01-anthropic-auth";
    const cred = loadClaudeOAuthCredential();
    expect(cred?.accessToken).toBe("sk-ant-oat01-anthropic-auth");
    expect(cred?.source).toBe("claude-cli-env");
  });

  it("loads from file descriptor", () => {
    const fdPath = join(tmp, "fd-source.txt");
    writeFileSync(fdPath, "sk-ant-oat01-fd");
    const fd = openSync(fdPath, "r");
    process.env.CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR = String(fd);
    try {
      const cred = loadClaudeOAuthCredential();
      expect(cred?.accessToken).toBe("sk-ant-oat01-fd");
      expect(cred?.source).toBe("claude-cli-fd");
    } finally {
      closeSync(fd);
    }
  });

  it("loads from CLAUDE_CODE_CREDENTIALS_PATH override", () => {
    const credPath = join(tmp, "cred.json");
    writeFileSync(credPath, JSON.stringify({
      claudeAiOauth: {
        accessToken: "sk-ant-oat01-override",
        refreshToken: "sk-ant-ort01-override",
        expiresAt: 4102444800000,
      },
    }));
    process.env.CLAUDE_CODE_CREDENTIALS_PATH = credPath;
    const cred = loadClaudeOAuthCredential();
    expect(cred?.accessToken).toBe("sk-ant-oat01-override");
    expect(cred?.refreshToken).toBe("sk-ant-ort01-override");
    expect(cred?.source).toBe("claude-cli-file");
  });

  it("falls back to default file when override path is a directory", () => {
    const overrideDir = join(tmp, "dir-override");
    mkdirSync(overrideDir);
    process.env.CLAUDE_CODE_CREDENTIALS_PATH = overrideDir;

    const defaultDir = join(tmp, ".claude");
    mkdirSync(defaultDir);
    writeFileSync(join(defaultDir, ".credentials.json"), JSON.stringify({
      claudeAiOauth: {
        accessToken: "sk-ant-oat01-default",
        expiresAt: 4102444800000,
      },
    }));

    const cred = loadClaudeOAuthCredential();
    expect(cred?.accessToken).toBe("sk-ant-oat01-default");
    expect(cred?.source).toBe("claude-cli-file");
  });

  it("returns null for expired token", () => {
    const credPath = join(tmp, "cred.json");
    writeFileSync(credPath, JSON.stringify({
      claudeAiOauth: {
        accessToken: "sk-ant-oat01-expired",
        expiresAt: Date.now() - 1000,
      },
    }));
    process.env.CLAUDE_CODE_CREDENTIALS_PATH = credPath;
    expect(loadClaudeOAuthCredential()).toBeNull();
  });

  it("returns null when nothing is set", () => {
    expect(loadClaudeOAuthCredential()).toBeNull();
  });
});

describe("isClaudeOAuthToken", () => {
  it("detects sk-ant-oat prefix", () => {
    expect(isClaudeOAuthToken("sk-ant-oat01-abc")).toBe(true);
    expect(isClaudeOAuthToken("sk-ant-api03-xyz")).toBe(false);
    expect(isClaudeOAuthToken("")).toBe(false);
  });
});

describe("OAUTH_ANTHROPIC_BETAS", () => {
  it("exports the required beta string", () => {
    expect(OAUTH_ANTHROPIC_BETAS).toBe(
      "oauth-2025-04-20,claude-code-20250219,interleaved-thinking-2025-05-14",
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/agents && npx vitest run src/nexus/models/__tests__/credentials.test.ts`
Expected: FAIL — `Cannot find module '../credentials.js'`

- [ ] **Step 3: Implement `credentials.ts` (Claude half only)**

Create `apps/agents/src/nexus/models/credentials.ts`:

```ts
import { readFileSync, readSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const OAUTH_ANTHROPIC_BETAS =
  "oauth-2025-04-20,claude-code-20250219,interleaved-thinking-2025-05-14";

export interface ClaudeOAuthCredential {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  source: "claude-cli-env" | "claude-cli-fd" | "claude-cli-file";
}

export interface CodexCliCredential {
  accessToken: string;
  accountId: string;
  source: "codex-cli-env" | "codex-cli-file";
}

export function isClaudeOAuthToken(token: string): boolean {
  return typeof token === "string" && token.includes("sk-ant-oat");
}

let _claudeCache: { cred: ClaudeOAuthCredential | null } | null = null;
let _codexCache: { cred: CodexCliCredential | null } | null = null;

export function __resetCredentialCacheForTesting(): void {
  _claudeCache = null;
  _codexCache = null;
}

function getHome(): string {
  return process.env.HOME ?? process.env.USERPROFILE ?? homedir();
}

function readJsonFile(path: string): Record<string, unknown> | null {
  try {
    const stat = statSync(path);
    if (!stat.isFile()) return null;
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readFromFileDescriptor(envName: string): string | null {
  const raw = process.env[envName];
  if (!raw) return null;
  const fd = Number.parseInt(raw, 10);
  if (!Number.isFinite(fd)) {
    console.warn(`[Nexus] ${envName} must be an integer file descriptor, got: ${raw}`);
    return null;
  }
  try {
    const buf = Buffer.alloc(1024 * 1024);
    const n = readSync(fd, buf, 0, buf.length, null);
    return buf.subarray(0, n).toString("utf8").trim() || null;
  } catch (err) {
    console.warn(`[Nexus] Failed to read ${envName}: ${(err as Error).message}`);
    return null;
  }
}

function extractClaudeOAuth(
  data: Record<string, unknown>,
): Omit<ClaudeOAuthCredential, "source"> | null {
  const oauth = data.claudeAiOauth as Record<string, unknown> | undefined;
  if (!oauth) return null;
  const accessToken = typeof oauth.accessToken === "string" ? oauth.accessToken : "";
  if (!accessToken) return null;
  return {
    accessToken,
    refreshToken: typeof oauth.refreshToken === "string" ? oauth.refreshToken : undefined,
    expiresAt: typeof oauth.expiresAt === "number" ? oauth.expiresAt : undefined,
  };
}

function isExpired(expiresAt: number | undefined): boolean {
  if (!expiresAt || expiresAt <= 0) return false;
  return Date.now() > expiresAt - 60_000;
}

function claudeCredentialPaths(): string[] {
  const paths: string[] = [];
  const override = process.env.CLAUDE_CODE_CREDENTIALS_PATH;
  if (override) paths.push(override);
  const defaultPath = join(getHome(), ".claude", ".credentials.json");
  if (!paths.includes(defaultPath)) paths.push(defaultPath);
  return paths;
}

export function loadClaudeOAuthCredential(): ClaudeOAuthCredential | null {
  if (_claudeCache) return _claudeCache.cred;

  const result = doLoadClaudeOAuthCredential();
  _claudeCache = { cred: result };
  return result;
}

function doLoadClaudeOAuthCredential(): ClaudeOAuthCredential | null {
  // 1. Direct env vars
  const directToken =
    process.env.CLAUDE_CODE_OAUTH_TOKEN?.trim() ||
    process.env.ANTHROPIC_AUTH_TOKEN?.trim();
  if (directToken) {
    return { accessToken: directToken, source: "claude-cli-env" };
  }

  // 2. File descriptor
  const fdToken = readFromFileDescriptor("CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR");
  if (fdToken) {
    return { accessToken: fdToken, source: "claude-cli-fd" };
  }

  // 3. File paths (override then default)
  for (const path of claudeCredentialPaths()) {
    const data = readJsonFile(path);
    if (!data) continue;
    const extracted = extractClaudeOAuth(data);
    if (!extracted) continue;
    if (isExpired(extracted.expiresAt)) {
      console.warn(
        "[Nexus] Claude Code OAuth token is expired. Run 'claude setup-token' to refresh.",
      );
      return null;
    }
    return { ...extracted, source: "claude-cli-file" };
  }

  return null;
}

// Codex loader added in Task 2.
export function loadCodexCliCredential(): CodexCliCredential | null {
  void _codexCache;
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/agents && npx vitest run src/nexus/models/__tests__/credentials.test.ts`
Expected: PASS (all `loadClaudeOAuthCredential`, `isClaudeOAuthToken`, `OAUTH_ANTHROPIC_BETAS` tests green)

- [ ] **Step 5: Commit**

```bash
git add apps/agents/src/nexus/models/credentials.ts apps/agents/src/nexus/models/__tests__/credentials.test.ts
git commit -m "feat(models): add Claude OAuth credential loader"
```

---

## Task 2 — Credential loader: Codex half

**Files:**
- Modify: `apps/agents/src/nexus/models/credentials.ts`
- Modify: `apps/agents/src/nexus/models/__tests__/credentials.test.ts`

- [ ] **Step 1: Append Codex tests**

Append to `apps/agents/src/nexus/models/__tests__/credentials.test.ts`:

```ts
describe("loadCodexCliCredential", () => {
  let tmp: string;
  const CODEX_ENV = ["CODEX_ACCESS_TOKEN", "CODEX_ACCOUNT_ID", "CODEX_AUTH_PATH", "HOME", "USERPROFILE"];

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "nexus-codex-"));
    for (const v of CODEX_ENV) delete process.env[v];
    process.env.HOME = tmp;
    __resetCredentialCacheForTesting();
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    for (const v of CODEX_ENV) delete process.env[v];
    __resetCredentialCacheForTesting();
  });

  it("loads from env vars when both are set", () => {
    process.env.CODEX_ACCESS_TOKEN = "codex-env-token";
    process.env.CODEX_ACCOUNT_ID = "acct_env";
    const cred = loadCodexCliCredential();
    expect(cred?.accessToken).toBe("codex-env-token");
    expect(cred?.accountId).toBe("acct_env");
    expect(cred?.source).toBe("codex-cli-env");
  });

  it("loads from nested tokens shape", () => {
    const authPath = join(tmp, "auth.json");
    writeFileSync(authPath, JSON.stringify({
      tokens: { access_token: "codex-access-token", account_id: "acct_123" },
    }));
    process.env.CODEX_AUTH_PATH = authPath;
    const cred = loadCodexCliCredential();
    expect(cred?.accessToken).toBe("codex-access-token");
    expect(cred?.accountId).toBe("acct_123");
    expect(cred?.source).toBe("codex-cli-file");
  });

  it("loads from legacy top-level shape", () => {
    const authPath = join(tmp, "auth.json");
    writeFileSync(authPath, JSON.stringify({ access_token: "legacy-token" }));
    process.env.CODEX_AUTH_PATH = authPath;
    const cred = loadCodexCliCredential();
    expect(cred?.accessToken).toBe("legacy-token");
    expect(cred?.accountId).toBe("");
  });

  it("returns null when auth.json is missing", () => {
    expect(loadCodexCliCredential()).toBeNull();
  });
});
```

Import `loadCodexCliCredential` from the existing `credentials.js` import at the top of the file.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/agents && npx vitest run src/nexus/models/__tests__/credentials.test.ts -t "loadCodexCliCredential"`
Expected: FAIL — all four cases return null

- [ ] **Step 3: Implement `loadCodexCliCredential`**

Replace the stub at the bottom of `apps/agents/src/nexus/models/credentials.ts` with:

```ts
export function loadCodexCliCredential(): CodexCliCredential | null {
  if (_codexCache) return _codexCache.cred;
  const result = doLoadCodexCliCredential();
  _codexCache = { cred: result };
  return result;
}

function doLoadCodexCliCredential(): CodexCliCredential | null {
  // 1. Env vars
  const envToken = process.env.CODEX_ACCESS_TOKEN?.trim();
  const envAccount = process.env.CODEX_ACCOUNT_ID?.trim();
  if (envToken) {
    return {
      accessToken: envToken,
      accountId: envAccount ?? "",
      source: "codex-cli-env",
    };
  }

  // 2. File paths
  const path = process.env.CODEX_AUTH_PATH ?? join(getHome(), ".codex", "auth.json");
  const data = readJsonFile(path);
  if (!data) return null;

  const tokens = (data.tokens as Record<string, unknown> | undefined) ?? {};
  const accessToken =
    (typeof data.access_token === "string" && data.access_token) ||
    (typeof data.token === "string" && data.token) ||
    (typeof tokens.access_token === "string" && tokens.access_token) ||
    "";
  if (!accessToken) return null;

  const accountId =
    (typeof data.account_id === "string" && data.account_id) ||
    (typeof tokens.account_id === "string" && tokens.account_id) ||
    "";

  return {
    accessToken,
    accountId,
    source: "codex-cli-file",
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/agents && npx vitest run src/nexus/models/__tests__/credentials.test.ts`
Expected: PASS — all Claude + Codex tests green

- [ ] **Step 5: Commit**

```bash
git add apps/agents/src/nexus/models/credentials.ts apps/agents/src/nexus/models/__tests__/credentials.test.ts
git commit -m "feat(models): add Codex CLI credential loader"
```

---

## Task 3 — Registry wiring: types + availability

**Files:**
- Modify: `apps/agents/src/nexus/models/types.ts`
- Modify: `apps/agents/src/nexus/models/availability.ts`

- [ ] **Step 1: Extend `ProviderId` union**

Replace line 8 of `apps/agents/src/nexus/models/types.ts`:

```ts
export type ProviderId =
  | "google"
  | "anthropic"
  | "openai"
  | "zai"
  | "claude-oauth"
  | "codex";
```

- [ ] **Step 2: Extend `availability.ts`**

Replace the content of `apps/agents/src/nexus/models/availability.ts`:

```ts
import { loadClaudeOAuthCredential, loadCodexCliCredential } from "./credentials.js";
import type { ProviderId } from "./types.js";

function hasEnv(name: string): boolean {
  const value = process.env[name];
  return typeof value === "string" && value.length > 0;
}

export function isGoogleAvailable(): boolean {
  return (
    hasEnv("GOOGLE_CLOUD_PROJECT") ||
    hasEnv("GOOGLE_API_KEY") ||
    hasEnv("GEMINI_API_KEY")
  );
}

export function isAnthropicAvailable(): boolean {
  return hasEnv("ANTHROPIC_API_KEY");
}

export function isOpenAIAvailable(): boolean {
  return hasEnv("OPENAI_API_KEY");
}

export function isZaiAvailable(): boolean {
  return hasEnv("ZAI_API_KEY");
}

export function isClaudeOAuthAvailable(): boolean {
  return loadClaudeOAuthCredential() !== null;
}

export function isCodexCliAvailable(): boolean {
  return loadCodexCliCredential() !== null;
}

export function isProviderAvailable(provider: ProviderId): boolean {
  switch (provider) {
    case "google":
      return isGoogleAvailable();
    case "anthropic":
      return isAnthropicAvailable();
    case "openai":
      return isOpenAIAvailable();
    case "zai":
      return isZaiAvailable();
    case "claude-oauth":
      return isClaudeOAuthAvailable();
    case "codex":
      return isCodexCliAvailable();
  }
}
```

- [ ] **Step 3: Run typecheck**

Run: `cd apps/agents && npx tsc --noEmit`
Expected: clean (no errors introduced by this change — `providers.ts` and `registry.ts` still compile because `providerFactories` is keyed by `ProviderId`; TS will emit errors for missing `claude-oauth`/`codex` keys — those are fixed in Task 11)

If the missing-key errors appear, note them and proceed — they get resolved in Task 11.

- [ ] **Step 4: Run existing tests**

Run: `cd apps/agents && npx vitest run src/nexus/models/__tests__/registry.test.ts`
Expected: existing registry tests still pass (these don't touch the new provider IDs)

- [ ] **Step 5: Commit**

```bash
git add apps/agents/src/nexus/models/types.ts apps/agents/src/nexus/models/availability.ts
git commit -m "feat(models): wire claude-oauth + codex into ProviderId + availability"
```

---

## Task 4 — `ClaudeOAuthChatAnthropic`: class + createClient hook

**Files:**
- Create: `apps/agents/src/nexus/models/claude-oauth-chat-model.ts`
- Create: `apps/agents/src/nexus/models/__tests__/claude-oauth-chat-model.test.ts`

**Context:** `@langchain/anthropic`'s `ChatAnthropic` exposes `createClient?: (options: ClientOptions) => Anthropic` (confirmed in `node_modules/@langchain/anthropic/dist/chat_models.d.ts:148`). The underlying `@anthropic-ai/sdk` client accepts `authToken` as a first-class constructor option (confirmed in `.../client.d.ts:36` and `:111`). When `authToken` is set, the SDK emits `Authorization: Bearer <token>` instead of `x-api-key`. This means we can configure OAuth auth via the `createClient` hook without any post-hoc client patching.

- [ ] **Step 1: Write failing test**

Create `apps/agents/src/nexus/models/__tests__/claude-oauth-chat-model.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ClaudeOAuthChatAnthropic } from "../claude-oauth-chat-model.js";
import { OAUTH_ANTHROPIC_BETAS } from "../credentials.js";

describe("ClaudeOAuthChatAnthropic", () => {
  it("constructs with an OAuth token without throwing", () => {
    const model = new ClaudeOAuthChatAnthropic({
      model: "claude-sonnet-4-6",
      oauthToken: "sk-ant-oat01-test",
    });
    expect(model).toBeInstanceOf(ClaudeOAuthChatAnthropic);
  });

  it("stores the OAuth token for later client construction", () => {
    const model = new ClaudeOAuthChatAnthropic({
      model: "claude-sonnet-4-6",
      oauthToken: "sk-ant-oat01-abc",
    });
    // internal field accessible via (model as any) — this is a white-box test
    expect((model as unknown as { oauthToken: string }).oauthToken).toBe(
      "sk-ant-oat01-abc",
    );
  });

  it("exposes the required anthropic-beta header string", () => {
    expect(OAUTH_ANTHROPIC_BETAS).toContain("oauth-2025-04-20");
    expect(OAUTH_ANTHROPIC_BETAS).toContain("claude-code-20250219");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/agents && npx vitest run src/nexus/models/__tests__/claude-oauth-chat-model.test.ts`
Expected: FAIL — `Cannot find module '../claude-oauth-chat-model.js'`

- [ ] **Step 3: Implement class (constructor + createClient only)**

Create `apps/agents/src/nexus/models/claude-oauth-chat-model.ts`:

```ts
import { ChatAnthropic, type ChatAnthropicInput } from "@langchain/anthropic";
import Anthropic from "@anthropic-ai/sdk";
import { OAUTH_ANTHROPIC_BETAS } from "./credentials.js";

export interface ClaudeOAuthChatAnthropicFields
  extends Omit<ChatAnthropicInput, "apiKey" | "anthropicApiKey"> {
  oauthToken: string;
}

export class ClaudeOAuthChatAnthropic extends ChatAnthropic {
  // Kept as a public field so tests can assert it and invocationParams can reach it.
  readonly oauthToken: string;

  constructor(fields: ClaudeOAuthChatAnthropicFields) {
    if (!fields.oauthToken) {
      throw new Error("ClaudeOAuthChatAnthropic requires a non-empty oauthToken");
    }

    const oauthToken = fields.oauthToken;

    super({
      ...fields,
      // ChatAnthropic validates apiKey is non-empty. Supply a placeholder —
      // the real credential is attached via createClient below.
      apiKey: "oauth-placeholder",
      clientOptions: {
        ...(fields.clientOptions ?? {}),
        defaultHeaders: {
          ...(fields.clientOptions?.defaultHeaders ?? {}),
          "anthropic-beta": OAUTH_ANTHROPIC_BETAS,
        },
      },
      createClient: (options) =>
        new Anthropic({
          ...options,
          apiKey: null,
          authToken: oauthToken,
        }),
    } as ChatAnthropicInput);

    this.oauthToken = oauthToken;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/agents && npx vitest run src/nexus/models/__tests__/claude-oauth-chat-model.test.ts`
Expected: PASS (3/3)

- [ ] **Step 5: Commit**

```bash
git add apps/agents/src/nexus/models/claude-oauth-chat-model.ts apps/agents/src/nexus/models/__tests__/claude-oauth-chat-model.test.ts
git commit -m "feat(models): add ClaudeOAuthChatAnthropic with createClient hook"
```

---

## Task 5 — `ClaudeOAuthChatAnthropic`: payload mutation (billing + metadata)

**Files:**
- Modify: `apps/agents/src/nexus/models/claude-oauth-chat-model.ts`
- Modify: `apps/agents/src/nexus/models/__tests__/claude-oauth-chat-model.test.ts`

- [ ] **Step 1: Append failing tests for payload shaping**

Append to `apps/agents/src/nexus/models/__tests__/claude-oauth-chat-model.test.ts`:

```ts
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

describe("ClaudeOAuthChatAnthropic payload shaping", () => {
  const model = new ClaudeOAuthChatAnthropic({
    model: "claude-sonnet-4-6",
    oauthToken: "sk-ant-oat01-abc",
  });

  function getPayload(messages: Array<SystemMessage | HumanMessage>): Record<string, unknown> {
    // invocationParams shapes params separately from messages. Since we need
    // to observe the mutation on the final request, call the internal shaping
    // method directly. ChatAnthropic exposes `invocationParams` publicly.
    return model.invocationParams() as Record<string, unknown>;
  }

  it("prepends the billing system block when no system is set", () => {
    const payload = getPayload([]);
    // After Task 5 implementation, invocationParams populates `system` with billing block first.
    const system = payload.system as Array<{ type: string; text: string }>;
    expect(Array.isArray(system)).toBe(true);
    expect(system[0].type).toBe("text");
    expect(system[0].text).toContain("x-anthropic-billing-header");
  });

  it("injects metadata.user_id as parseable JSON", () => {
    const payload = getPayload([]);
    const metadata = payload.metadata as { user_id: string };
    expect(typeof metadata?.user_id).toBe("string");
    const parsed = JSON.parse(metadata.user_id);
    expect(parsed).toHaveProperty("device_id");
    expect(parsed).toHaveProperty("account_uuid", "nexus");
    expect(parsed).toHaveProperty("session_id");
  });

  it("deduplicates billing blocks on repeated calls", () => {
    model.invocationParams();
    const payload = model.invocationParams() as Record<string, unknown>;
    const system = payload.system as Array<{ type: string; text: string }>;
    const billingBlocks = system.filter(
      (b) => typeof b.text === "string" && b.text.includes("x-anthropic-billing-header"),
    );
    expect(billingBlocks.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/agents && npx vitest run src/nexus/models/__tests__/claude-oauth-chat-model.test.ts -t "payload shaping"`
Expected: FAIL — billing block missing, metadata.user_id missing

- [ ] **Step 3: Implement `invocationParams` override**

Add imports at the top of `claude-oauth-chat-model.ts`:

```ts
import { createHash, randomUUID } from "node:crypto";
import { hostname } from "node:os";
```

Inside the `ClaudeOAuthChatAnthropic` class (after the constructor), add:

```ts
  private static readonly DEFAULT_BILLING_HEADER =
    "x-anthropic-billing-header: cc_version=2.1.85.351; cc_entrypoint=cli; cch=6c6d5;";

  private _sessionId = randomUUID();
  private _deviceId = createHash("sha256").update(`nexus-${hostname()}`).digest("hex");

  private get billingHeader(): string {
    return process.env.ANTHROPIC_BILLING_HEADER ?? ClaudeOAuthChatAnthropic.DEFAULT_BILLING_HEADER;
  }

  override invocationParams(
    options?: this["ParsedCallOptions"],
  ): ReturnType<ChatAnthropic["invocationParams"]> {
    const params = super.invocationParams(options) as Record<string, unknown>;
    this._applyOAuthBilling(params);
    this._applyOAuthMetadata(params);
    return params as ReturnType<ChatAnthropic["invocationParams"]>;
  }

  private _applyOAuthBilling(payload: Record<string, unknown>): void {
    const billingBlock = { type: "text" as const, text: this.billingHeader };
    const system = payload.system;

    if (Array.isArray(system)) {
      const filtered = system.filter(
        (b) =>
          !(
            b &&
            typeof b === "object" &&
            typeof (b as { text?: unknown }).text === "string" &&
            ((b as { text: string }).text as string).includes("x-anthropic-billing-header")
          ),
      );
      payload.system = [billingBlock, ...filtered];
    } else if (typeof system === "string") {
      if (system.includes("x-anthropic-billing-header")) {
        payload.system = [billingBlock];
      } else {
        payload.system = [billingBlock, { type: "text" as const, text: system }];
      }
    } else {
      payload.system = [billingBlock];
    }
  }

  private _applyOAuthMetadata(payload: Record<string, unknown>): void {
    const existing = (payload.metadata as Record<string, unknown> | undefined) ?? {};
    if (typeof existing.user_id === "string") {
      payload.metadata = existing;
      return;
    }
    payload.metadata = {
      ...existing,
      user_id: JSON.stringify({
        device_id: this._deviceId,
        account_uuid: "nexus",
        session_id: this._sessionId,
      }),
    };
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/agents && npx vitest run src/nexus/models/__tests__/claude-oauth-chat-model.test.ts`
Expected: PASS — all 6 tests green

- [ ] **Step 5: Commit**

```bash
git add apps/agents/src/nexus/models/claude-oauth-chat-model.ts apps/agents/src/nexus/models/__tests__/claude-oauth-chat-model.test.ts
git commit -m "feat(models): inject OAuth billing header and metadata.user_id"
```

---

## Task 6 — `CodexChatModel`: class skeleton + constructor

**Files:**
- Create: `apps/agents/src/nexus/models/codex-chat-model.ts`
- Create: `apps/agents/src/nexus/models/__tests__/codex-chat-model.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/agents/src/nexus/models/__tests__/codex-chat-model.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CodexChatModel } from "../codex-chat-model.js";

describe("CodexChatModel constructor", () => {
  it("rejects retryMaxAttempts < 1", () => {
    expect(
      () =>
        new CodexChatModel({
          accessToken: "token",
          accountId: "acct",
          retryMaxAttempts: 0,
        }),
    ).toThrow(/retryMaxAttempts must be >= 1/);
  });

  it("throws when accessToken is missing", () => {
    expect(() => new CodexChatModel({ accountId: "acct" })).toThrow(
      /Codex CLI credential not found/,
    );
  });

  it("defaults model to gpt-5.4", () => {
    const model = new CodexChatModel({ accessToken: "tok", accountId: "acct" });
    expect(model.model).toBe("gpt-5.4");
  });

  it("defaults reasoningEffort to medium", () => {
    const model = new CodexChatModel({ accessToken: "tok", accountId: "acct" });
    expect(model.reasoningEffort).toBe("medium");
  });

  it("strips maxTokens field from fields record", () => {
    const model = new CodexChatModel({
      accessToken: "tok",
      accountId: "acct",
      // @ts-expect-error intentional — factory may pass this through
      maxTokens: 1234,
    });
    expect((model as unknown as { maxTokens?: number }).maxTokens).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/agents && npx vitest run src/nexus/models/__tests__/codex-chat-model.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create class skeleton**

Create `apps/agents/src/nexus/models/codex-chat-model.ts`:

```ts
import { BaseChatModel, type BaseChatModelParams } from "@langchain/core/language_models/chat_models";
import type { BaseMessage } from "@langchain/core/messages";
import type { ChatResult } from "@langchain/core/outputs";
import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";

export type CodexReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh";

export interface CodexChatModelFields extends BaseChatModelParams {
  model?: string;
  reasoningEffort?: CodexReasoningEffort;
  thinkingEnabled?: boolean;
  retryMaxAttempts?: number;
  accessToken?: string;
  accountId?: string;
}

export class CodexChatModel extends BaseChatModel {
  model: string;
  reasoningEffort: CodexReasoningEffort;
  retryMaxAttempts: number;
  protected accessToken: string;
  protected accountId: string;

  constructor(fields: CodexChatModelFields = {}) {
    const { maxTokens: _dropMax, ...rest } = fields as CodexChatModelFields & {
      maxTokens?: number;
    };
    super(rest);

    this.retryMaxAttempts = rest.retryMaxAttempts ?? 3;
    if (this.retryMaxAttempts < 1) {
      throw new Error("retryMaxAttempts must be >= 1");
    }

    if (!rest.accessToken) {
      throw new Error("Codex CLI credential not found");
    }

    this.accessToken = rest.accessToken;
    this.accountId = rest.accountId ?? "";
    this.model = rest.model ?? "gpt-5.4";

    const thinkingEnabled = rest.thinkingEnabled ?? true;
    if (!thinkingEnabled) {
      this.reasoningEffort = "none";
    } else {
      this.reasoningEffort = rest.reasoningEffort ?? "medium";
    }
  }

  _llmType(): string {
    return "codex-responses";
  }

  async _generate(
    _messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    throw new Error("CodexChatModel._generate not implemented yet (Task 11)");
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/agents && npx vitest run src/nexus/models/__tests__/codex-chat-model.test.ts`
Expected: PASS (5/5)

- [ ] **Step 5: Commit**

```bash
git add apps/agents/src/nexus/models/codex-chat-model.ts apps/agents/src/nexus/models/__tests__/codex-chat-model.test.ts
git commit -m "feat(models): scaffold CodexChatModel constructor"
```

---

## Task 7 — `CodexChatModel`: `_convertMessages`

**Files:**
- Modify: `apps/agents/src/nexus/models/codex-chat-model.ts`
- Modify: `apps/agents/src/nexus/models/__tests__/codex-chat-model.test.ts`

- [ ] **Step 1: Append failing tests**

Append to `apps/agents/src/nexus/models/__tests__/codex-chat-model.test.ts`:

```ts
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";

describe("CodexChatModel._convertMessages", () => {
  const model = new CodexChatModel({ accessToken: "tok", accountId: "acct" });

  it("concatenates multiple system messages with \\n\\n", () => {
    const { instructions, input } = (
      model as unknown as {
        _convertMessages: (msgs: BaseMessage[]) => { instructions: string; input: unknown[] };
      }
    )._convertMessages([
      new SystemMessage("First system prompt."),
      new SystemMessage("Second system prompt."),
      new HumanMessage("Hello"),
    ]);
    expect(instructions).toBe("First system prompt.\n\nSecond system prompt.");
    expect(input).toEqual([{ role: "user", content: "Hello" }]);
  });

  it("flattens structured text blocks", () => {
    const { instructions, input } = (
      model as unknown as {
        _convertMessages: (msgs: BaseMessage[]) => { instructions: string; input: unknown[] };
      }
    )._convertMessages([
      new HumanMessage({ content: [{ type: "text", text: "Hello from blocks" }] }),
    ]);
    expect(instructions).toBe("You are a helpful assistant.");
    expect(input).toEqual([{ role: "user", content: "Hello from blocks" }]);
  });

  it("converts AIMessage with tool_calls into function_call items", () => {
    const ai = new AIMessage({
      content: "calling tool",
      tool_calls: [{ name: "bash", args: { cmd: "ls" }, id: "call_1", type: "tool_call" }],
    });
    const { input } = (
      model as unknown as {
        _convertMessages: (msgs: BaseMessage[]) => { instructions: string; input: unknown[] };
      }
    )._convertMessages([ai]);
    expect(input).toEqual([
      { role: "assistant", content: "calling tool" },
      {
        type: "function_call",
        name: "bash",
        arguments: JSON.stringify({ cmd: "ls" }),
        call_id: "call_1",
      },
    ]);
  });

  it("converts ToolMessage into function_call_output", () => {
    const tm = new ToolMessage({
      content: "file1\nfile2",
      tool_call_id: "call_1",
    });
    const { input } = (
      model as unknown as {
        _convertMessages: (msgs: BaseMessage[]) => { instructions: string; input: unknown[] };
      }
    )._convertMessages([tm]);
    expect(input).toEqual([
      { type: "function_call_output", call_id: "call_1", output: "file1\nfile2" },
    ]);
  });
});
```

Add import at the top of the test file:

```ts
import type { BaseMessage } from "@langchain/core/messages";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/agents && npx vitest run src/nexus/models/__tests__/codex-chat-model.test.ts -t "_convertMessages"`
Expected: FAIL — method does not exist

- [ ] **Step 3: Implement `_convertMessages` and `_normalizeContent`**

Add imports at the top of `codex-chat-model.ts`:

```ts
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
```

Add inside the `CodexChatModel` class (after `_llmType`):

```ts
  static _normalizeContent(content: unknown): string {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .map((item) => CodexChatModel._normalizeContent(item))
        .filter((s) => s.length > 0)
        .join("\n");
    }
    if (content && typeof content === "object") {
      const obj = content as Record<string, unknown>;
      for (const key of ["text", "output"]) {
        const value = obj[key];
        if (typeof value === "string") return value;
      }
      if (obj.content !== undefined) return CodexChatModel._normalizeContent(obj.content);
      try {
        return JSON.stringify(obj);
      } catch {
        return String(obj);
      }
    }
    try {
      return JSON.stringify(content);
    } catch {
      return String(content);
    }
  }

  _convertMessages(messages: BaseMessage[]): {
    instructions: string;
    input: Array<Record<string, unknown>>;
  } {
    const instructionParts: string[] = [];
    const input: Array<Record<string, unknown>> = [];

    for (const msg of messages) {
      if (msg instanceof SystemMessage) {
        const text = CodexChatModel._normalizeContent(msg.content);
        if (text) instructionParts.push(text);
      } else if (msg instanceof HumanMessage) {
        input.push({ role: "user", content: CodexChatModel._normalizeContent(msg.content) });
      } else if (msg instanceof AIMessage) {
        const text = CodexChatModel._normalizeContent(msg.content);
        if (text) input.push({ role: "assistant", content: text });
        for (const tc of msg.tool_calls ?? []) {
          input.push({
            type: "function_call",
            name: tc.name,
            arguments:
              typeof tc.args === "object" && tc.args !== null
                ? JSON.stringify(tc.args)
                : String(tc.args ?? ""),
            call_id: tc.id ?? "",
          });
        }
      } else if (msg instanceof ToolMessage) {
        input.push({
          type: "function_call_output",
          call_id: msg.tool_call_id,
          output: CodexChatModel._normalizeContent(msg.content),
        });
      }
    }

    const instructions = instructionParts.length > 0
      ? instructionParts.join("\n\n")
      : "You are a helpful assistant.";

    return { instructions, input };
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/agents && npx vitest run src/nexus/models/__tests__/codex-chat-model.test.ts`
Expected: PASS — all constructor + `_convertMessages` tests green

- [ ] **Step 5: Commit**

```bash
git add apps/agents/src/nexus/models/codex-chat-model.ts apps/agents/src/nexus/models/__tests__/codex-chat-model.test.ts
git commit -m "feat(models): convert LC messages to Codex Responses API input"
```

---

## Task 8 — `CodexChatModel`: `_convertTools` + `bindTools`

**Files:**
- Modify: `apps/agents/src/nexus/models/codex-chat-model.ts`
- Modify: `apps/agents/src/nexus/models/__tests__/codex-chat-model.test.ts`

- [ ] **Step 1: Append failing tests**

Append to `apps/agents/src/nexus/models/__tests__/codex-chat-model.test.ts`:

```ts
describe("CodexChatModel._convertTools", () => {
  const model = new CodexChatModel({ accessToken: "tok", accountId: "acct" });

  it("flattens wrapped function-calling tool shape", () => {
    const tools = [
      {
        type: "function",
        function: {
          name: "bash",
          description: "Run a shell command",
          parameters: { type: "object", properties: { cmd: { type: "string" } } },
        },
      },
    ];
    const result = (
      model as unknown as { _convertTools: (t: unknown[]) => unknown[] }
    )._convertTools(tools);
    expect(result).toEqual([
      {
        type: "function",
        name: "bash",
        description: "Run a shell command",
        parameters: { type: "object", properties: { cmd: { type: "string" } } },
      },
    ]);
  });

  it("passes through already-flat tools", () => {
    const tools = [
      { type: "function", name: "search", description: "Search the web", parameters: {} },
    ];
    const result = (
      model as unknown as { _convertTools: (t: unknown[]) => unknown[] }
    )._convertTools(tools);
    expect(result).toEqual(tools);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/agents && npx vitest run src/nexus/models/__tests__/codex-chat-model.test.ts -t "_convertTools"`
Expected: FAIL — method missing

- [ ] **Step 3: Implement `_convertTools` and `bindTools`**

Add to the `CodexChatModel` class:

```ts
  _convertTools(tools: unknown[]): Array<Record<string, unknown>> {
    const result: Array<Record<string, unknown>> = [];
    for (const tool of tools) {
      if (!tool || typeof tool !== "object") continue;
      const t = tool as Record<string, unknown>;
      if (t.type === "function" && t.function && typeof t.function === "object") {
        const fn = t.function as Record<string, unknown>;
        result.push({
          type: "function",
          name: fn.name,
          description: fn.description ?? "",
          parameters: fn.parameters ?? {},
        });
      } else if (typeof t.name === "string") {
        result.push({
          type: "function",
          name: t.name,
          description: t.description ?? "",
          parameters: t.parameters ?? {},
        });
      }
    }
    return result;
  }

  override bindTools(
    tools: Parameters<BaseChatModel["bindTools"]>[0],
    kwargs?: Partial<this["ParsedCallOptions"]>,
  ): ReturnType<BaseChatModel["bindTools"]> {
    const formatted: Array<Record<string, unknown>> = [];
    for (const t of tools) {
      if (t && typeof t === "object") {
        if ("lc_serializable" in t || "name" in t) {
          // StructuredTool-ish; convert via convertToOpenAIFunction upstream
          // For simplicity, accept raw { name, description, schema } dicts too
          const asAny = t as unknown as {
            name?: string;
            description?: string;
            schema?: unknown;
          };
          if (typeof asAny.name === "string") {
            formatted.push({
              type: "function",
              name: asAny.name,
              description: asAny.description ?? "",
              parameters: asAny.schema ?? { type: "object", properties: {} },
            });
            continue;
          }
        }
        formatted.push(...this._convertTools([t]));
      }
    }
    return this.withConfig({ tools: formatted, ...(kwargs ?? {}) } as unknown as Partial<
      this["ParsedCallOptions"]
    >);
  }
```

**Note on `bindTools` fidelity:** this implementation accepts both raw OpenAI-function dicts and simple `{ name, description, schema }` shapes. If the orchestrator binds LangChain `StructuredTool` instances directly, they'll fall through the `name in t` branch and use their `schema` as the parameters object. If that turns out to be insufficient during integration testing (Task 14), swap in `convertToOpenAIFunction` from `@langchain/core/utils/function_calling`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/agents && npx vitest run src/nexus/models/__tests__/codex-chat-model.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/agents/src/nexus/models/codex-chat-model.ts apps/agents/src/nexus/models/__tests__/codex-chat-model.test.ts
git commit -m "feat(models): add Codex tool conversion and bindTools"
```

---

## Task 9 — `CodexChatModel`: SSE parser + stream reader + merge

**Files:**
- Modify: `apps/agents/src/nexus/models/codex-chat-model.ts`
- Modify: `apps/agents/src/nexus/models/__tests__/codex-chat-model.test.ts`

- [ ] **Step 1: Append failing parser tests**

Append to `apps/agents/src/nexus/models/__tests__/codex-chat-model.test.ts`:

```ts
import { CodexChatModel as CodexCls } from "../codex-chat-model.js";

describe("CodexChatModel SSE parser", () => {
  it("returns null for [DONE] marker", () => {
    expect(CodexCls._parseSseDataLine("data: [DONE]")).toBeNull();
  });

  it("returns null for event: lines", () => {
    expect(CodexCls._parseSseDataLine("event: response.completed")).toBeNull();
  });

  it("returns null for non-data lines", () => {
    expect(CodexCls._parseSseDataLine("")).toBeNull();
    expect(CodexCls._parseSseDataLine(": heartbeat")).toBeNull();
  });

  it("returns null for malformed JSON payload", () => {
    expect(CodexCls._parseSseDataLine("data: not-json")).toBeNull();
  });

  it("parses valid JSON payload", () => {
    expect(
      CodexCls._parseSseDataLine('data: {"type":"response.completed"}'),
    ).toEqual({ type: "response.completed" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/agents && npx vitest run src/nexus/models/__tests__/codex-chat-model.test.ts -t "SSE parser"`
Expected: FAIL — static method missing

- [ ] **Step 3: Implement parser + streaming + merge**

Add to the `CodexChatModel` class:

```ts
  static readonly BASE_URL = "https://chatgpt.com/backend-api/codex";

  static _parseSseDataLine(line: string): Record<string, unknown> | null {
    if (!line.startsWith("data:")) return null;
    const raw = line.slice(5).trim();
    if (!raw || raw === "[DONE]") return null;
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  protected async _streamResponse(
    headers: Record<string, string>,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const resp = await fetch(`${CodexChatModel.BASE_URL}/responses`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const err = new Error(
        `Codex API returned ${resp.status}: ${resp.statusText}`,
      ) as Error & { status: number; response: Response };
      err.status = resp.status;
      err.response = resp;
      throw err;
    }
    if (!resp.body) throw new Error("Codex API returned empty body");

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let completed: Record<string, unknown> | null = null;
    const streamedItems = new Map<number, Record<string, unknown>>();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIdx).replace(/\r$/, "");
        buffer = buffer.slice(newlineIdx + 1);
        const data = CodexChatModel._parseSseDataLine(line);
        if (!data) continue;

        const eventType = data.type;
        if (eventType === "response.output_item.done") {
          const idx = data.output_index;
          const item = data.item;
          if (typeof idx === "number" && item && typeof item === "object") {
            streamedItems.set(idx, item as Record<string, unknown>);
          }
        } else if (eventType === "response.completed") {
          completed = data.response as Record<string, unknown>;
        }
      }
    }

    if (!completed) {
      throw new Error("Codex API stream ended without response.completed event");
    }

    // Merge streamed items into completed.output if output is empty or has gaps
    if (streamedItems.size > 0) {
      const existing = Array.isArray(completed.output)
        ? [...(completed.output as Array<Record<string, unknown> | null>)]
        : [];
      const maxIdx = Math.max(
        ...Array.from(streamedItems.keys()),
        existing.length - 1,
      );
      while (existing.length <= maxIdx) existing.push(null);
      for (const [idx, item] of streamedItems) {
        if (!existing[idx] || typeof existing[idx] !== "object") {
          existing[idx] = item;
        }
      }
      completed = {
        ...completed,
        output: existing.filter(
          (x): x is Record<string, unknown> => x !== null && typeof x === "object",
        ),
      };
    }

    return completed;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/agents && npx vitest run src/nexus/models/__tests__/codex-chat-model.test.ts`
Expected: PASS (constructor + _convertMessages + _convertTools + SSE parser all green)

- [ ] **Step 5: Commit**

```bash
git add apps/agents/src/nexus/models/codex-chat-model.ts apps/agents/src/nexus/models/__tests__/codex-chat-model.test.ts
git commit -m "feat(models): add Codex SSE parser and stream reader"
```

---

## Task 10 — `CodexChatModel`: `_parseResponse`

**Files:**
- Modify: `apps/agents/src/nexus/models/codex-chat-model.ts`
- Modify: `apps/agents/src/nexus/models/__tests__/codex-chat-model.test.ts`

- [ ] **Step 1: Append failing tests**

Append to `apps/agents/src/nexus/models/__tests__/codex-chat-model.test.ts`:

```ts
describe("CodexChatModel._parseResponse", () => {
  const model = new CodexChatModel({ accessToken: "tok", accountId: "acct" });

  it("parses valid tool_calls", () => {
    const result = (
      model as unknown as { _parseResponse: (r: unknown) => { generations: Array<{ message: AIMessage }> } }
    )._parseResponse({
      model: "gpt-5.4",
      output: [
        {
          type: "function_call",
          name: "bash",
          arguments: JSON.stringify({ cmd: "pwd" }),
          call_id: "tc-1",
        },
      ],
      usage: {},
    });
    const msg = result.generations[0].message;
    expect(msg.tool_calls).toEqual([
      { name: "bash", args: { cmd: "pwd" }, id: "tc-1", type: "tool_call" },
    ]);
  });

  it("routes malformed tool arguments to invalid_tool_calls", () => {
    const result = (
      model as unknown as {
        _parseResponse: (r: unknown) => { generations: Array<{ message: AIMessage }> };
      }
    )._parseResponse({
      model: "gpt-5.4",
      output: [
        { type: "function_call", name: "bash", arguments: "{invalid", call_id: "tc-1" },
      ],
      usage: {},
    });
    const msg = result.generations[0].message;
    expect(msg.tool_calls).toEqual([]);
    expect(msg.invalid_tool_calls?.length).toBe(1);
    expect(msg.invalid_tool_calls?.[0]?.name).toBe("bash");
    expect(msg.invalid_tool_calls?.[0]?.id).toBe("tc-1");
    expect(msg.invalid_tool_calls?.[0]?.error).toMatch(/parse/i);
  });

  it("extracts reasoning content into additional_kwargs", () => {
    const result = (
      model as unknown as {
        _parseResponse: (r: unknown) => { generations: Array<{ message: AIMessage }> };
      }
    )._parseResponse({
      model: "gpt-5.4",
      output: [
        {
          type: "reasoning",
          summary: [{ type: "summary_text", text: "Thinking about it..." }],
        },
        {
          type: "message",
          content: [{ type: "output_text", text: "Here is the answer." }],
        },
      ],
      usage: {},
    });
    const msg = result.generations[0].message;
    expect(msg.content).toBe("Here is the answer.");
    expect(msg.additional_kwargs?.reasoning_content).toBe("Thinking about it...");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/agents && npx vitest run src/nexus/models/__tests__/codex-chat-model.test.ts -t "_parseResponse"`
Expected: FAIL — method missing

- [ ] **Step 3: Implement `_parseResponse`**

Add imports at the top of `codex-chat-model.ts`:

```ts
import { AIMessage as AI, HumanMessage as HM, SystemMessage as SM, ToolMessage as TM } from "@langchain/core/messages";
import type { ChatGeneration } from "@langchain/core/outputs";
```

(Keep the existing imports — the aliases are to avoid collision with any existing use.)

Add inside the class:

```ts
  _parseResponse(response: Record<string, unknown>): ChatResult {
    let content = "";
    let reasoning = "";
    const toolCalls: Array<{ name: string; args: Record<string, unknown>; id: string; type: "tool_call" }> = [];
    const invalidToolCalls: Array<{
      type: "invalid_tool_call";
      name: string;
      args: string;
      id: string;
      error: string;
    }> = [];

    const output = Array.isArray(response.output) ? (response.output as Array<Record<string, unknown>>) : [];
    for (const item of output) {
      if (item.type === "reasoning") {
        const summary = Array.isArray(item.summary) ? (item.summary as Array<unknown>) : [];
        for (const s of summary) {
          if (typeof s === "string") {
            reasoning += s;
          } else if (s && typeof s === "object") {
            const obj = s as Record<string, unknown>;
            if (obj.type === "summary_text" && typeof obj.text === "string") {
              reasoning += obj.text;
            }
          }
        }
      } else if (item.type === "message") {
        const parts = Array.isArray(item.content) ? (item.content as Array<Record<string, unknown>>) : [];
        for (const part of parts) {
          if (part.type === "output_text" && typeof part.text === "string") {
            content += part.text;
          }
        }
      } else if (item.type === "function_call") {
        const rawArgs = typeof item.arguments === "string" ? item.arguments : "{}";
        const name = typeof item.name === "string" ? item.name : "";
        const callId = typeof item.call_id === "string" ? item.call_id : "";
        try {
          const parsed = JSON.parse(rawArgs) as unknown;
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            toolCalls.push({
              name,
              args: parsed as Record<string, unknown>,
              id: callId,
              type: "tool_call",
            });
          } else {
            invalidToolCalls.push({
              type: "invalid_tool_call",
              name,
              args: rawArgs,
              id: callId,
              error: "Tool arguments must decode to a JSON object.",
            });
          }
        } catch (e) {
          invalidToolCalls.push({
            type: "invalid_tool_call",
            name,
            args: rawArgs,
            id: callId,
            error: `Failed to parse tool arguments: ${(e as Error).message}`,
          });
        }
      }
    }

    const usage = (response.usage as Record<string, unknown> | undefined) ?? {};
    const message = new AI({
      content,
      tool_calls: toolCalls,
      invalid_tool_calls: invalidToolCalls,
      additional_kwargs: reasoning ? { reasoning_content: reasoning } : {},
      response_metadata: {
        model: response.model ?? this.model,
        usage,
      },
    });

    return {
      generations: [{ message, text: content } as ChatGeneration],
      llmOutput: {
        tokenUsage: {
          promptTokens: (usage.input_tokens as number) ?? 0,
          completionTokens: (usage.output_tokens as number) ?? 0,
          totalTokens: (usage.total_tokens as number) ?? 0,
        },
        model_name: response.model ?? this.model,
      },
    };
  }
```

Remove the duplicate `AI/HM/SM/TM` aliases — use the already-imported `AIMessage`, `HumanMessage`, `SystemMessage`, `ToolMessage` instead. Keep the `ChatGeneration` type import.

Updated import block at top of `codex-chat-model.ts`:

```ts
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { BaseChatModel, type BaseChatModelParams } from "@langchain/core/language_models/chat_models";
import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import type { ChatGeneration, ChatResult } from "@langchain/core/outputs";
```

Replace all `AI({...})` in `_parseResponse` with `new AIMessage({...})`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/agents && npx vitest run src/nexus/models/__tests__/codex-chat-model.test.ts`
Expected: PASS — all tests including `_parseResponse` green

- [ ] **Step 5: Commit**

```bash
git add apps/agents/src/nexus/models/codex-chat-model.ts apps/agents/src/nexus/models/__tests__/codex-chat-model.test.ts
git commit -m "feat(models): parse Codex responses into LC ChatResult"
```

---

## Task 11 — `CodexChatModel`: `_generate` + retry + `_callCodexApi`

**Files:**
- Modify: `apps/agents/src/nexus/models/codex-chat-model.ts`

- [ ] **Step 1: Implement `_callCodexApi` with retries**

Add to the `CodexChatModel` class:

```ts
  protected _buildHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      "ChatGPT-Account-ID": this.accountId,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      originator: "codex_cli_rs",
    };
  }

  protected _buildPayload(
    messages: BaseMessage[],
    tools?: Array<Record<string, unknown>>,
  ): Record<string, unknown> {
    const { instructions, input } = this._convertMessages(messages);
    const payload: Record<string, unknown> = {
      model: this.model,
      instructions,
      input,
      store: false,
      stream: true,
      reasoning:
        this.reasoningEffort === "none"
          ? { effort: "none" }
          : { effort: this.reasoningEffort, summary: "detailed" },
    };
    if (tools && tools.length > 0) {
      payload.tools = this._convertTools(tools);
    }
    return payload;
  }

  protected async _callCodexApi(
    messages: BaseMessage[],
    tools?: Array<Record<string, unknown>>,
  ): Promise<Record<string, unknown>> {
    const headers = this._buildHeaders();
    const payload = this._buildPayload(messages, tools);

    let lastError: unknown = null;
    for (let attempt = 1; attempt <= this.retryMaxAttempts; attempt++) {
      try {
        return await this._streamResponse(headers, payload);
      } catch (err) {
        lastError = err;
        const status = (err as { status?: number }).status;
        const retryable = status === 429 || status === 500 || status === 529;
        if (!retryable || attempt >= this.retryMaxAttempts) throw err;
        const base = 2000 * Math.pow(2, attempt - 1);
        const jitter = Math.floor(base * 0.2);
        let waitMs = base + jitter;
        const retryAfter = (err as { response?: Response }).response?.headers?.get?.(
          "Retry-After",
        );
        if (retryAfter) {
          const parsed = Number.parseInt(retryAfter, 10);
          if (Number.isFinite(parsed)) waitMs = parsed * 1000;
        }
        console.warn(
          `[CodexChatModel] HTTP ${status}, retrying ${attempt}/${this.retryMaxAttempts} after ${waitMs}ms`,
        );
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }
    throw lastError;
  }

  override async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    const tools = (options as unknown as { tools?: Array<Record<string, unknown>> }).tools;
    const response = await this._callCodexApi(messages, tools);
    return this._parseResponse(response);
  }
```

Replace the stub `_generate` thrown error from Task 6 with this real implementation (the `override` keyword above replaces it).

- [ ] **Step 2: Run existing tests to verify no regressions**

Run: `cd apps/agents && npx vitest run src/nexus/models/__tests__/codex-chat-model.test.ts`
Expected: PASS — all existing tests still green (no new unit test for `_generate`; it's covered by integration test in Task 14)

- [ ] **Step 3: Run full typecheck**

Run: `cd apps/agents && npx tsc --noEmit 2>&1 | grep -v "db/index.ts\|tools-integration\|meta-router\|aio-sandbox.test"`
Expected: no NEW errors from `codex-chat-model.ts` or `claude-oauth-chat-model.ts`. Pre-existing errors in `db/index.ts` and integration test files are OK (see `CLAUDE.md` "Verification pass-bar").

- [ ] **Step 4: Commit**

```bash
git add apps/agents/src/nexus/models/codex-chat-model.ts
git commit -m "feat(models): implement CodexChatModel._generate with retries"
```

---

## Task 12 — Provider factories

**Files:**
- Modify: `apps/agents/src/nexus/models/providers.ts`

- [ ] **Step 1: Add factory entries**

Replace the content of `apps/agents/src/nexus/models/providers.ts`:

```ts
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatGoogle } from "@langchain/google/node";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import { ZaiChatOpenAI } from "./zai-chat-model.js";
import { ClaudeOAuthChatAnthropic } from "./claude-oauth-chat-model.js";
import { CodexChatModel } from "./codex-chat-model.js";
import { loadClaudeOAuthCredential, loadCodexCliCredential } from "./credentials.js";
import type { ProviderId } from "./types.js";

export interface ModelBuildOptions {
  temperature?: number;
  maxTokens?: number;
}

const ZAI_DEFAULT_BASE_URL = "https://api.z.ai/api/paas/v4";

export const providerFactories: Record<
  ProviderId,
  (id: string, opts?: ModelBuildOptions) => BaseChatModel
> = {
  google: (id, opts) =>
    new ChatGoogle({ model: id, ...(opts ?? {}) }) as unknown as BaseChatModel,
  anthropic: (id, opts) =>
    new ChatAnthropic({ model: id, ...(opts ?? {}) }) as unknown as BaseChatModel,
  openai: (id, opts) =>
    new ChatOpenAI({ model: id, ...(opts ?? {}) }) as unknown as BaseChatModel,
  zai: (id, opts) =>
    new ZaiChatOpenAI({
      model: id,
      apiKey: process.env.ZAI_API_KEY,
      configuration: {
        baseURL: process.env.ZAI_BASE_URL ?? ZAI_DEFAULT_BASE_URL,
      },
      ...(opts ?? {}),
    }) as unknown as BaseChatModel,
  "claude-oauth": (id, opts) => {
    const cred = loadClaudeOAuthCredential();
    if (!cred) {
      throw new Error(
        "Claude OAuth credential not found. Set CLAUDE_CODE_OAUTH_TOKEN or run 'claude setup-token'.",
      );
    }
    return new ClaudeOAuthChatAnthropic({
      model: id,
      oauthToken: cred.accessToken,
      ...(opts ?? {}),
    }) as unknown as BaseChatModel;
  },
  codex: (id, opts) => {
    const cred = loadCodexCliCredential();
    if (!cred) {
      throw new Error(
        "Codex CLI credential not found. Set CODEX_ACCESS_TOKEN + CODEX_ACCOUNT_ID or log in via `codex`.",
      );
    }
    // Codex endpoint rejects max_tokens; strip it from opts.
    const { maxTokens: _dropMax, ...rest } = (opts ?? {}) as ModelBuildOptions;
    return new CodexChatModel({
      model: id,
      accessToken: cred.accessToken,
      accountId: cred.accountId,
      ...rest,
    }) as unknown as BaseChatModel;
  },
};
```

- [ ] **Step 2: Run typecheck**

Run: `cd apps/agents && npx tsc --noEmit 2>&1 | grep -v "db/index.ts\|tools-integration\|meta-router\|aio-sandbox.test"`
Expected: no new errors

- [ ] **Step 3: Run existing registry tests**

Run: `cd apps/agents && npx vitest run src/nexus/models/__tests__/registry.test.ts`
Expected: existing tests pass

- [ ] **Step 4: Commit**

```bash
git add apps/agents/src/nexus/models/providers.ts
git commit -m "feat(models): wire claude-oauth and codex provider factories"
```

---

## Task 13 — Registry: model catalog + tier priority

**Files:**
- Modify: `apps/agents/src/nexus/models/registry.ts`
- Modify: `apps/agents/src/nexus/models/__tests__/registry.test.ts`

- [ ] **Step 1: Write failing tests for new tier priority**

Read the current `registry.test.ts` first to see its style, then append:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadClaudeOAuthCredential, loadCodexCliCredential, __resetCredentialCacheForTesting } from "../credentials.js";
import { getTierDefault, resolveTier, TIER_PRIORITY } from "../registry.js";

describe("registry — Claude OAuth + Codex wiring", () => {
  const ENV_BACKUP = { ...process.env };

  afterEach(() => {
    process.env = { ...ENV_BACKUP };
    __resetCredentialCacheForTesting();
  });

  it("includes claude-oauth before anthropic in every tier that has anthropic", () => {
    for (const tier of ["classifier", "default", "code", "deep-research"] as const) {
      const priority = TIER_PRIORITY[tier];
      const oauthIdx = priority.indexOf("claude-oauth");
      const anthropicIdx = priority.indexOf("anthropic");
      if (anthropicIdx === -1) continue;
      expect(oauthIdx).toBeGreaterThanOrEqual(0);
      expect(oauthIdx).toBeLessThan(anthropicIdx);
    }
  });

  it("appends codex to the code tier priority", () => {
    expect(TIER_PRIORITY.code).toContain("codex");
  });

  it("resolves code tier to anthropic when Claude OAuth is absent", () => {
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    delete process.env.CLAUDE_CODE_CREDENTIALS_PATH;
    delete process.env.CODEX_ACCESS_TOKEN;
    process.env.ANTHROPIC_API_KEY = "sk-ant-api03-test";
    __resetCredentialCacheForTesting();

    const descriptor = getTierDefault("code");
    expect(descriptor?.provider).toBe("anthropic");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/agents && npx vitest run src/nexus/models/__tests__/registry.test.ts -t "Claude OAuth"`
Expected: FAIL — `claude-oauth` not in `TIER_PRIORITY`

- [ ] **Step 3: Update `registry.ts`**

Modify `apps/agents/src/nexus/models/registry.ts`:

**(a) Insert catalog entries** after the Anthropic block (after the `"claude-opus-4-6"` entry, before OpenAI):

```ts
  // Claude OAuth — same models as Anthropic, different auth path.
  {
    provider: "claude-oauth",
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5 (OAuth)",
    tiers: ["classifier", "default"],
    capabilities: { tools: true, images: false },
  },
  {
    provider: "claude-oauth",
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6 (OAuth)",
    tiers: ["default", "code", "deep-research"],
    capabilities: { tools: true, images: false },
  },
  {
    provider: "claude-oauth",
    id: "claude-opus-4-6",
    label: "Claude Opus 4.6 (OAuth)",
    tiers: ["code", "deep-research"],
    capabilities: { tools: true, images: false },
  },
```

**(b) Insert Codex catalog entry** after the Z.AI block (after `"glm-5.1"`):

```ts
  // Codex (ChatGPT Plus/Pro subscription via OAuth)
  {
    provider: "codex",
    id: "gpt-5.4",
    label: "GPT-5.4 (Codex)",
    tiers: ["code"],
    capabilities: { tools: true, images: false },
  },
```

**(c) Update `TIER_PRIORITY`** (replace lines 105-111):

```ts
export const TIER_PRIORITY: Record<Tier, ProviderId[]> = {
  classifier: ["claude-oauth", "google", "anthropic", "openai", "zai"],
  default: ["claude-oauth", "anthropic", "openai", "zai", "google"],
  code: ["claude-oauth", "anthropic", "google", "openai", "zai", "codex"],
  "deep-research": ["claude-oauth", "google", "anthropic", "openai", "zai"],
  image: ["google"],
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/agents && npx vitest run src/nexus/models/__tests__/registry.test.ts`
Expected: PASS — all tests (existing + new) green

- [ ] **Step 5: Commit**

```bash
git add apps/agents/src/nexus/models/registry.ts apps/agents/src/nexus/models/__tests__/registry.test.ts
git commit -m "feat(models): add claude-oauth and codex to MODEL_CATALOG + TIER_PRIORITY"
```

---

## Task 14 — Preflight reporting

**Files:**
- Modify: `apps/agents/src/nexus/preflight.ts`

- [ ] **Step 1: Extend `PROVIDERS`, `PROVIDER_KEY_HINT`, and add OAuth status detail**

Modify `apps/agents/src/nexus/preflight.ts`:

Replace line 65:
```ts
const PROVIDERS: ProviderId[] = ["google", "anthropic", "claude-oauth", "openai", "zai", "codex"];
```

Replace lines 67-72:
```ts
const PROVIDER_KEY_HINT: Record<ProviderId, string> = {
  google: "GEMINI_API_KEY / GOOGLE_API_KEY / GOOGLE_CLOUD_PROJECT",
  anthropic: "ANTHROPIC_API_KEY not set",
  openai: "OPENAI_API_KEY not set",
  zai: "ZAI_API_KEY not set",
  "claude-oauth": "no Claude OAuth credential (run 'claude setup-token')",
  codex: "no Codex CLI credential (run 'codex login')",
};
```

Add import near the top (after existing imports from `./models/index.js`):

```ts
import { loadClaudeOAuthCredential, loadCodexCliCredential } from "./models/credentials.js";
```

Replace the providers-loop block (lines 91-103) with:

```ts
  // --- Providers ---
  console.log("[Nexus] Providers:");
  for (const provider of PROVIDERS) {
    const available = isProviderAvailable(provider);
    const mark = available ? "[OK]" : "[--]";
    let hint = "";
    if (provider === "google" && available) {
      hint = ` (${googleMode})`;
    } else if (provider === "claude-oauth" && available) {
      const cred = loadClaudeOAuthCredential();
      hint = cred ? ` (source: ${cred.source}, caching: off)` : "";
    } else if (provider === "codex" && available) {
      const cred = loadCodexCliCredential();
      const masked = cred?.accountId
        ? `${cred.accountId.slice(0, 8)}${cred.accountId.length > 8 ? "..." : ""}`
        : "unknown";
      hint = ` (account: ${masked})`;
    } else if (!available) {
      hint = ` (${PROVIDER_KEY_HINT[provider]})`;
    }
    const label = provider.padEnd(14);
    console.log(`  ${label}${mark}${hint}`);
  }
```

Note the `padEnd(14)` increase (was 10) to fit `"claude-oauth"`.

- [ ] **Step 2: Run existing tests**

Run: `cd apps/agents && npx vitest run`
Expected: existing tests still pass — no tests directly assert preflight output

- [ ] **Step 3: Manual sanity check**

Run: `cd apps/agents && npx tsx -e "import('./src/nexus/preflight.js').then(m => m.logPreflight())"`

Expected output contains rows like:
```
[Nexus] Providers:
  google        [OK] (api-key)
  anthropic     [OK]
  claude-oauth  [--] (no Claude OAuth credential (run 'claude setup-token'))
  openai        [--] (OPENAI_API_KEY not set)
  zai           [--] (ZAI_API_KEY not set)
  codex         [--] (no Codex CLI credential (run 'codex login'))
```

(Exact rows depend on what env vars are set locally — verify the `claude-oauth` and `codex` rows appear at all, with correct hint text.)

- [ ] **Step 4: Commit**

```bash
git add apps/agents/src/nexus/preflight.ts
git commit -m "feat(preflight): report Claude OAuth and Codex CLI status"
```

---

## Task 15 — Integration test scaffolding + CLAUDE.md docs + final verification

**Files:**
- Create: `apps/agents/src/nexus/models/__tests__/claude-oauth-chat-model.integration.test.ts`
- Create: `apps/agents/src/nexus/models/__tests__/codex-chat-model.integration.test.ts`
- Modify: `apps/agents/src/nexus/models/index.ts`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Extend `models/index.ts` re-exports**

Read the existing `apps/agents/src/nexus/models/index.ts` and append:

```ts
export { ClaudeOAuthChatAnthropic } from "./claude-oauth-chat-model.js";
export { CodexChatModel } from "./codex-chat-model.js";
export {
  loadClaudeOAuthCredential,
  loadCodexCliCredential,
  isClaudeOAuthToken,
  OAUTH_ANTHROPIC_BETAS,
  type ClaudeOAuthCredential,
  type CodexCliCredential,
} from "./credentials.js";
```

- [ ] **Step 2: Create gated integration test for Claude OAuth**

Create `apps/agents/src/nexus/models/__tests__/claude-oauth-chat-model.integration.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { ClaudeOAuthChatAnthropic } from "../claude-oauth-chat-model.js";
import { loadClaudeOAuthCredential } from "../credentials.js";

const HAS_CRED =
  !!process.env.CLAUDE_CODE_OAUTH_TOKEN ||
  !!process.env.ANTHROPIC_AUTH_TOKEN ||
  loadClaudeOAuthCredential() !== null;

describe.skipIf(!HAS_CRED)("ClaudeOAuthChatAnthropic integration", () => {
  it("round-trips a single message through the OAuth endpoint", async () => {
    const cred = loadClaudeOAuthCredential();
    if (!cred) throw new Error("precondition: credential should exist");
    const model = new ClaudeOAuthChatAnthropic({
      model: "claude-haiku-4-5",
      oauthToken: cred.accessToken,
      maxTokens: 64,
    });
    const response = await model.invoke([new HumanMessage("Reply with the single word: ok")]);
    expect(typeof response.content).toBe("string");
    expect((response.content as string).toLowerCase()).toContain("ok");
  }, 30_000);
});
```

- [ ] **Step 3: Create gated integration test for Codex**

Create `apps/agents/src/nexus/models/__tests__/codex-chat-model.integration.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { HumanMessage } from "@langchain/core/messages";
import { CodexChatModel } from "../codex-chat-model.js";
import { loadCodexCliCredential } from "../credentials.js";

const HAS_CRED = loadCodexCliCredential() !== null || !!process.env.CODEX_ACCESS_TOKEN;

describe.skipIf(!HAS_CRED)("CodexChatModel integration", () => {
  it("round-trips a single message through the ChatGPT Codex endpoint", async () => {
    const cred = loadCodexCliCredential();
    if (!cred) throw new Error("precondition: credential should exist");
    const model = new CodexChatModel({
      model: "gpt-5.4",
      accessToken: cred.accessToken,
      accountId: cred.accountId,
      reasoningEffort: "none",
    });
    const response = await model.invoke([new HumanMessage("Reply with the single word: ok")]);
    expect(typeof response.content).toBe("string");
    expect((response.content as string).toLowerCase()).toContain("ok");
  }, 60_000);
});
```

- [ ] **Step 4: Update CLAUDE.md runtime prerequisites**

Read `CLAUDE.md` and in the "Runtime prerequisites" section, after the line listing `GEMINI_API_KEY / ANTHROPIC_API_KEY / ...`, add two bullet points:

```markdown
- **Claude OAuth** (optional — reuses a Claude Max subscription instead of the API-key billing path): set `CLAUDE_CODE_OAUTH_TOKEN` or drop an exported credentials file at `~/.claude/.credentials.json`. When present, it takes priority over `ANTHROPIC_API_KEY` in all tier resolutions. Prompt caching is disabled on the OAuth path due to the 4-block `cache_control` cap — use the API-key path if you need caching.
- **Codex CLI** (optional — reuses a ChatGPT Plus/Pro subscription): set `CODEX_ACCESS_TOKEN` + `CODEX_ACCOUNT_ID`, or log in via `codex` CLI to populate `~/.codex/auth.json`. Only wired into the `code` tier; does not compete with Anthropic/Google in `default`.
```

Also append to the "Verification pass-bar" list of expected-to-skip integration tests:

```markdown
- `apps/agents/src/nexus/models/__tests__/claude-oauth-chat-model.integration.test.ts` (gated on Claude OAuth credential)
- `apps/agents/src/nexus/models/__tests__/codex-chat-model.integration.test.ts` (gated on Codex CLI credential)
```

- [ ] **Step 5: Final verification — full test + lint + typecheck**

Run in parallel:
- `cd apps/agents && npm run lint`
- `cd apps/agents && npx tsc --noEmit 2>&1 | grep -v "db/index.ts\|tools-integration\|meta-router\|aio-sandbox.test"`
- `cd apps/agents && npx vitest run src/nexus/models/__tests__/`

Expected:
- Lint: clean
- Typecheck: no new errors (pre-existing `db/index.ts` errors are permitted per CLAUDE.md)
- Vitest: all unit tests green; integration tests skipped (no creds) or green (creds present)

- [ ] **Step 6: Manual preflight smoke test**

With a fake OAuth token set, run:
```bash
CLAUDE_CODE_OAUTH_TOKEN="sk-ant-oat01-fake-test-token" cd apps/agents && npx tsx -e "import('./src/nexus/preflight.js').then(m => m.logPreflight())"
```

Expected: preflight prints `claude-oauth  [OK] (source: claude-cli-env, caching: off)` and does not crash.

- [ ] **Step 7: Commit**

```bash
git add apps/agents/src/nexus/models/__tests__/claude-oauth-chat-model.integration.test.ts \
        apps/agents/src/nexus/models/__tests__/codex-chat-model.integration.test.ts \
        apps/agents/src/nexus/models/index.ts \
        CLAUDE.md
git commit -m "feat(models): add integration tests and document OAuth env vars"
```

---

## Self-Review

**Spec coverage** — every section of `2026-04-15-claude-codex-oauth-design.md`:
- Component 1 (credentials) → Tasks 1, 2
- Component 2 (Claude OAuth transport) → Tasks 4, 5
- Component 3 (Codex transport) → Tasks 6, 7, 8, 9, 10, 11
- Component 4 (registry wiring) → Tasks 3, 12, 13, 14
- Testing section → unit tests in Tasks 1-13, integration tests in Task 15
- Verification section → Task 15 step 5 + step 6
- Follow-ups (docker, keychain helper, refresh flow) → out of scope, documented in spec as follow-ups

**Placeholder scan**: no TBDs, no "implement later", no "similar to Task N" without code. Every code step shows the complete code. No vague "add error handling" steps.

**Type consistency checks**:
- `ClaudeOAuthCredential` shape — defined once in Task 1, referenced via import in Task 4 (tests) and Task 12 (factory).
- `CodexCliCredential` shape — defined in Task 1, consumed in Task 12 factory.
- `CodexChatModelFields` — defined in Task 6, extended usage in Tasks 7-11 is consistent (same field names: `accessToken`, `accountId`, `model`, `reasoningEffort`, `retryMaxAttempts`, `thinkingEnabled`).
- `retryMaxAttempts` (camelCase) used consistently in Task 6 constructor and Task 11 retry loop. Error message uses the same casing: `"retryMaxAttempts must be >= 1"`.
- `_parseSseDataLine` as a static method in Task 9 + Task 10 both reference `CodexChatModel._parseSseDataLine` / `CodexCls._parseSseDataLine` — consistent.
- `_convertMessages` return type `{ instructions: string; input: Array<Record<string, unknown>> }` — same in Task 7 definition and Task 11 `_buildPayload` consumer.
- `TIER_PRIORITY` uses `"claude-oauth"` (hyphen) consistently in all tier arrays.
- Billing header env var: `ANTHROPIC_BILLING_HEADER` — used in Task 5 only, no collisions.
- Cache reset function: `__resetCredentialCacheForTesting` — defined in Task 1, imported in Tasks 1, 2, 13.

No inconsistencies found.

**Scope check**: Each task is 2-5 minutes of focused work. Tasks 7, 9, and 10 are the largest (significant code) but each still produces a single testable unit. Not decomposable further without fragmenting the file across many commits.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-15-claude-codex-oauth.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
