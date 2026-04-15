import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, openSync, rmSync, writeFileSync, closeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  __resetCredentialCacheForTesting,
  isClaudeOAuthToken,
  loadClaudeOAuthCredential,
  loadCodexCliCredential,
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
