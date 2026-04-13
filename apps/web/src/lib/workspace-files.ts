// apps/web/src/lib/workspace-files.ts

import {
  getWorkspaceRootForThread,
  remapWorkspacePath,
} from "@/lib/workspace-paths";

const WORKSPACE_PATH_REGEX = /\/home\/gem\/workspace\/[\w./-]+/g;

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((part: any) => part?.type === "text")
      .map((part: any) => String(part?.text ?? ""))
      .join("\n");
  }
  return "";
}

function tryParseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function addMatchesFromString(raw: string, out: Set<string>) {
  const matches = raw.match(WORKSPACE_PATH_REGEX) ?? [];
  for (const match of matches) {
    const cleaned = match.replace(/[)\],.;:!?]+$/g, "");
    if (cleaned.startsWith("/home/gem/workspace/")) out.add(cleaned);
  }
}

function collectFromUnknown(value: unknown, out: Set<string>) {
  const parsed = tryParseJson(value);

  if (typeof parsed === "string") {
    addMatchesFromString(parsed, out);
    return;
  }

  if (Array.isArray(parsed)) {
    for (const item of parsed) collectFromUnknown(item, out);
    return;
  }

  if (parsed && typeof parsed === "object") {
    const record = parsed as Record<string, unknown>;

    // Fast-path common keys used by tools.
    for (const key of ["path", "file", "file_path", "filename"]) {
      const candidate = record[key];
      if (typeof candidate === "string") addMatchesFromString(candidate, out);
    }

    for (const value of Object.values(record)) {
      collectFromUnknown(value, out);
    }
  }
}

function collectFromMessage(message: any, out: Set<string>) {
  collectFromUnknown(extractText(message?.content), out);
  collectFromUnknown(message?.content, out);
  collectFromUnknown(message?.additional_kwargs, out);
  collectFromUnknown(message?.response_metadata, out);
  collectFromUnknown(message?.artifact, out);
  collectFromUnknown(message?.result, out);

  const toolCalls: any[] =
    message?.tool_calls ?? message?.additional_kwargs?.tool_calls ?? [];
  for (const call of toolCalls) {
    collectFromUnknown(call?.args, out);
    collectFromUnknown(call?.arguments, out);
  }
}

export function collectWorkspaceOutputPaths(
  messages: any[],
  subagents: any[],
  threadId?: string,
): string[] {
  const paths = new Set<string>();

  for (const message of messages) {
    collectFromMessage(message, paths);
  }

  for (const subagent of subagents) {
    const subMessages: any[] = subagent?.messages ?? [];
    for (const message of subMessages) {
      collectFromMessage(message, paths);
    }
    collectFromUnknown(subagent?.result, paths);
    collectFromUnknown(subagent?.toolCall?.args, paths);
  }

  const workspaceRoot = getWorkspaceRootForThread(threadId);
  const remapped = new Set<string>();
  for (const path of paths) {
    remapped.add(remapWorkspacePath(path, workspaceRoot));
  }

  return [...remapped].sort((a, b) => a.localeCompare(b));
}
