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
