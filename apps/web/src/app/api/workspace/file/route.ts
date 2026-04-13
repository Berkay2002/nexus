// apps/web/src/app/api/workspace/file/route.ts
import { NextRequest, NextResponse } from "next/server";

const SANDBOX_URL = process.env.SANDBOX_URL ?? "http://localhost:8080";
const WORKSPACE_ROOT = "/home/gem/workspace/";

function isAllowedWorkspacePath(path: string): boolean {
  return path.startsWith(WORKSPACE_ROOT) && !path.includes("..");
}

function guessMimeType(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".md")) return "text/markdown; charset=utf-8";
  if (lower.endsWith(".json")) return "application/json; charset=utf-8";
  if (lower.endsWith(".txt")) return "text/plain; charset=utf-8";
  if (lower.endsWith(".html")) return "text/html; charset=utf-8";
  return "application/octet-stream";
}

function extractName(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "file";
}

export async function GET(request: NextRequest) {
  const filePath = request.nextUrl.searchParams.get("path") ?? "";
  const download = request.nextUrl.searchParams.get("download") === "1";

  if (!filePath || !isAllowedWorkspacePath(filePath)) {
    return NextResponse.json(
      { error: "Invalid or disallowed workspace path." },
      { status: 400 },
    );
  }

  const proxyUrl = new URL("/v1/file/download", SANDBOX_URL);
  proxyUrl.searchParams.set("path", filePath);

  let sandboxResponse: Response;
  try {
    sandboxResponse = await fetch(proxyUrl.toString(), { method: "GET" });
  } catch {
    return NextResponse.json(
      { error: `Sandbox unreachable at ${SANDBOX_URL}.` },
      { status: 502 },
    );
  }

  if (!sandboxResponse.ok || !sandboxResponse.body) {
    const details = await sandboxResponse.text().catch(() => "");
    return NextResponse.json(
      {
        error: "Failed to read file from sandbox.",
        status: sandboxResponse.status,
        details,
      },
      { status: 502 },
    );
  }

  const filename = extractName(filePath);
  const contentType =
    sandboxResponse.headers.get("content-type") ?? guessMimeType(filePath);

  const headers = new Headers();
  headers.set("content-type", contentType);
  headers.set(
    "content-disposition",
    `${download ? "attachment" : "inline"}; filename="${filename}"`,
  );

  return new Response(sandboxResponse.body, {
    status: 200,
    headers,
  });
}
