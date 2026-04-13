const SANDBOX_URL = process.env.SANDBOX_URL ?? "http://localhost:8080";

export interface SandboxHttpResult {
  ok: boolean;
  status: number;
  data: unknown;
  rawText: string;
}

function normalizeBaseUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function parseJsonSafe(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    return text;
  }
}

export async function sandboxPostJson(
  path: string,
  body: unknown,
): Promise<SandboxHttpResult> {
  const response = await fetch(`${normalizeBaseUrl(SANDBOX_URL)}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const rawText = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    data: parseJsonSafe(rawText),
    rawText,
  };
}

export function normalizeApiError(result: SandboxHttpResult): string {
  const body = toRecord(result.data);
  const message =
    typeof body?.message === "string"
      ? body.message
      : typeof body?.detail === "string"
        ? body.detail
        : result.rawText.trim();

  return message
    ? `Sandbox API error (${result.status}): ${message}`
    : `Sandbox API error (${result.status})`;
}
