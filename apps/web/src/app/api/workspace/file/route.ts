// apps/web/src/app/api/workspace/file/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  getWorkspaceRootForThread,
  remapWorkspacePath,
} from "@/lib/workspace-paths";

const SANDBOX_URL = process.env.SANDBOX_URL ?? "http://localhost:8080";
const WORKSPACE_ROOT = "/home/gem/workspace/";

function isAllowedWorkspacePath(path: string): boolean {
  return path.startsWith(WORKSPACE_ROOT) && !path.includes("..");
}

function ensureDirectoryPath(path: string): string {
  return path.endsWith("/") ? path : `${path}/`;
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatBytes(size: number | undefined): string {
  if (typeof size !== "number" || !Number.isFinite(size)) return "";
  if (size < 1024) return `${size} B`;
  const kb = size / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

async function renderDirectoryListing(
  path: string,
  threadId?: string,
): Promise<Response> {
  const listUrl = new URL("/v1/file/list", SANDBOX_URL);

  let sandboxResponse: Response;
  try {
    sandboxResponse = await fetch(listUrl.toString(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        path,
        include_size: true,
        sort_by: "name",
      }),
    });
  } catch {
    return NextResponse.json(
      { error: `Sandbox unreachable at ${SANDBOX_URL}.` },
      { status: 502 },
    );
  }

  const payload = await sandboxResponse.json().catch(() => null) as
    | {
        success?: boolean;
        message?: string;
        data?: {
          path?: string;
          files?: Array<{
            name: string;
            path: string;
            is_directory: boolean;
            size?: number;
          }>;
        };
      }
    | null;

  if (!sandboxResponse.ok || !payload?.success) {
    return NextResponse.json(
      {
        error: "Failed to list directory from sandbox.",
        status: sandboxResponse.status,
        details: payload?.message ?? "Unknown error",
      },
      { status: 502 },
    );
  }

  const files = payload.data?.files ?? [];
  const safePath = escapeHtml(path);
  const rows = files
    .map((entry) => {
      const entryPath = entry.is_directory
        ? ensureDirectoryPath(entry.path)
        : entry.path;
      const params = new URLSearchParams({ path: entryPath });
      if (threadId) params.set("threadId", threadId);
      const href = `/api/workspace/file?${params.toString()}`;
      const icon = entry.is_directory ? "[DIR]" : "[FILE]";
      const size = entry.is_directory ? "" : formatBytes(entry.size);
      return `<li><a href="${href}">${icon} ${escapeHtml(entry.name)}</a>${size ? ` <span>(${escapeHtml(size)})</span>` : ""}</li>`;
    })
    .join("\n");

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Workspace Directory</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 24px; line-height: 1.4; }
      h1 { margin: 0 0 8px; font-size: 18px; }
      p { margin: 0 0 16px; color: #666; word-break: break-all; }
      ul { margin: 0; padding-left: 20px; }
      li { margin: 6px 0; }
      a { color: #0b63ce; text-decoration: none; }
      a:hover { text-decoration: underline; }
      span { color: #666; }
    </style>
  </head>
  <body>
    <h1>Directory Listing</h1>
    <p>${safePath}</p>
    <ul>
      ${rows || "<li>(empty directory)</li>"}
    </ul>
  </body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: NextRequest) {
  const filePath = request.nextUrl.searchParams.get("path") ?? "";
  const threadId = request.nextUrl.searchParams.get("threadId") ?? undefined;
  const download = request.nextUrl.searchParams.get("download") === "1";

  if (!filePath || !isAllowedWorkspacePath(filePath)) {
    return NextResponse.json(
      { error: "Invalid or disallowed workspace path." },
      { status: 400 },
    );
  }

  const workspaceRoot = getWorkspaceRootForThread(threadId);
  const resolvedPath = remapWorkspacePath(filePath, workspaceRoot);
  if (!isAllowedWorkspacePath(resolvedPath)) {
    return NextResponse.json(
      { error: "Resolved path is outside workspace root." },
      { status: 400 },
    );
  }

  if (resolvedPath.endsWith("/")) {
    if (download) {
      return NextResponse.json(
        { error: "Cannot download a directory. Open it to browse files." },
        { status: 400 },
      );
    }
    return renderDirectoryListing(resolvedPath, threadId);
  }

  const proxyUrl = new URL("/v1/file/download", SANDBOX_URL);
  proxyUrl.searchParams.set("path", resolvedPath);

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

    // If the sandbox says this path is a directory, render it as a listing
    // instead of surfacing a hard error.
    if (
      !download &&
      details.includes("is not a file")
    ) {
      return renderDirectoryListing(ensureDirectoryPath(resolvedPath), threadId);
    }

    return NextResponse.json(
      {
        error: "Failed to read file from sandbox.",
        status: sandboxResponse.status,
        details,
      },
      { status: 502 },
    );
  }

  const filename = extractName(resolvedPath);
  const sandboxContentType = sandboxResponse.headers.get("content-type");
  const guessedContentType = guessMimeType(resolvedPath);
  const contentType =
    sandboxContentType && sandboxContentType !== "application/octet-stream"
      ? sandboxContentType
      : guessedContentType;

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
