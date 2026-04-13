const SANDBOX_URL = process.env.SANDBOX_URL ?? "http://localhost:8080";

export interface SandboxHttpResult {
  ok: boolean;
  status: number;
  data: unknown;
  rawText: string;
}

export interface SandboxBinaryResult {
  ok: boolean;
  status: number;
  bytes: Uint8Array | null;
  headers: Record<string, string>;
  errorText: string;
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

function buildUrl(path: string): string {
  return `${normalizeBaseUrl(SANDBOX_URL)}${path}`;
}

export async function sandboxPostJson(
  path: string,
  body: unknown,
): Promise<SandboxHttpResult> {
  const response = await fetch(buildUrl(path), {
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

export async function sandboxGet(path: string): Promise<SandboxHttpResult> {
  const response = await fetch(buildUrl(path), {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  const rawText = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    data: parseJsonSafe(rawText),
    rawText,
  };
}

export async function sandboxDelete(path: string): Promise<SandboxHttpResult> {
  const response = await fetch(buildUrl(path), {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });

  const rawText = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    data: parseJsonSafe(rawText),
    rawText,
  };
}

export async function sandboxGetBinary(
  path: string,
): Promise<SandboxBinaryResult> {
  const response = await fetch(buildUrl(path), { method: "GET" });
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    return {
      ok: false,
      status: response.status,
      bytes: null,
      headers,
      errorText,
    };
  }

  const buffer = await response.arrayBuffer();
  return {
    ok: true,
    status: response.status,
    bytes: new Uint8Array(buffer),
    headers,
    errorText: "",
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

export function normalizeBinaryError(result: SandboxBinaryResult): string {
  const text = result.errorText.trim();
  return text
    ? `Sandbox API error (${result.status}): ${text}`
    : `Sandbox API error (${result.status})`;
}

export function encodePathSegment(value: string): string {
  return encodeURIComponent(value);
}
