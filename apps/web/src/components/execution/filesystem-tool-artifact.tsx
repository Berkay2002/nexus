"use client";

import {
  Artifact,
  ArtifactContent,
  ArtifactDescription,
  ArtifactHeader,
  ArtifactTitle,
} from "@/components/ai-elements/artifact";
import { CodeBlock } from "@/components/ai-elements/code-block";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ChevronDown, FileIcon, FolderIcon } from "lucide-react";
import type { BundledLanguage } from "shiki";

type FilesystemToolName = "write_file" | "edit_file" | "read_file" | "ls";

type LsEntry = { path: string; isDir: boolean; size?: number };

type LsParseResult = {
  entries: LsEntry[];
  error?: string;
  empty?: boolean;
  truncated?: boolean;
};

function parseLsOutput(output: string | undefined): LsParseResult | null {
  if (!output) return null;
  const trimmed = output.trim();
  if (!trimmed) return null;

  if (/^Error listing files:/i.test(trimmed)) {
    return {
      entries: [],
      error: trimmed.replace(/^Error listing files:\s*/i, ""),
    };
  }
  if (/^No files found in/i.test(trimmed)) {
    return { entries: [], empty: true };
  }

  const entries: LsEntry[] = [];
  let truncated = false;
  for (const raw of trimmed.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (/truncat/i.test(line) && !/\(\d+ bytes\)/.test(line)) {
      truncated = true;
      continue;
    }
    const dirMatch = line.match(/^(.+?)\s*\(directory\)\s*$/);
    if (dirMatch) {
      entries.push({ path: dirMatch[1], isDir: true });
      continue;
    }
    const fileMatch = line.match(/^(.+?)\s*\((\d+)\s*bytes\)\s*$/);
    if (fileMatch) {
      entries.push({
        path: fileMatch[1],
        isDir: false,
        size: Number(fileMatch[2]),
      });
      continue;
    }
    entries.push({ path: line, isDir: false });
  }
  return { entries, truncated };
}

function basename(p: string): string {
  const cleaned = p.replace(/\/+$/, "");
  const idx = cleaned.lastIndexOf("/");
  return idx >= 0 ? cleaned.slice(idx + 1) || cleaned : cleaned;
}

function parseJson(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getPath(args: unknown, output: string | undefined): string | undefined {
  const argsRecord = toRecord(args);
  const parsedOutput = output ? toRecord(parseJson(output)) : null;

  const pathCandidate =
    argsRecord?.file_path ??
    argsRecord?.path ??
    parsedOutput?.file_path ??
    parsedOutput?.path;

  return typeof pathCandidate === "string" ? pathCandidate : undefined;
}

function getOutputSize(output: string | undefined): number | undefined {
  if (!output) return undefined;

  const parsed = toRecord(parseJson(output));
  const byteCandidate = parsed?.bytes ?? parsed?.size ?? parsed?.file_size;
  if (typeof byteCandidate === "number" && Number.isFinite(byteCandidate)) {
    return byteCandidate;
  }

  return undefined;
}

function formatBytes(bytes: number | undefined): string | null {
  if (typeof bytes !== "number" || !Number.isFinite(bytes)) return null;
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

function getWriteOrEditPreview(toolName: FilesystemToolName, args: unknown): string | null {
  const argsRecord = toRecord(args);
  if (!argsRecord) return null;

  if (toolName === "write_file") {
    const contentCandidate = argsRecord.content ?? argsRecord.text;
    return typeof contentCandidate === "string" ? contentCandidate : null;
  }

  if (toolName === "edit_file") {
    const patchCandidate = argsRecord.patch ?? argsRecord.diff;
    if (typeof patchCandidate === "string") return patchCandidate;

    const oldString = argsRecord.old_string;
    const newString = argsRecord.new_string;
    if (typeof oldString === "string" && typeof newString === "string") {
      return `--- old\n${oldString}\n+++ new\n${newString}`;
    }
  }

  return null;
}

function getReadPreview(output: string | undefined): string | null {
  if (!output) return null;
  const parsed = parseJson(output);
  const parsedRecord = toRecord(parsed);

  const contentCandidate =
    parsedRecord?.content ?? parsedRecord?.text ?? parsedRecord?.data;

  if (typeof contentCandidate === "string") {
    return contentCandidate;
  }

  return output;
}

function stripEmbeddedLineNumbers(content: string): string {
  const lines = content.split("\n");
  const sample = lines.filter((line) => line.trim().length > 0).slice(0, 25);
  if (sample.length < 3) return content;

  const twoColPattern = /^\s*\d+\s+\d+(?:\s+|$)/;
  const oneColPattern = /^\s*\d+\s+/;

  const twoColMatches = sample.filter((line) => twoColPattern.test(line)).length;
  if (twoColMatches >= Math.ceil(sample.length * 0.6)) {
    return lines.map((line) => line.replace(twoColPattern, "")).join("\n");
  }

  const oneColMatches = sample.filter((line) => oneColPattern.test(line)).length;
  if (oneColMatches >= Math.ceil(sample.length * 0.8)) {
    return lines.map((line) => line.replace(oneColPattern, "")).join("\n");
  }

  return content;
}

function inferLanguage(path: string | undefined, toolName: FilesystemToolName): BundledLanguage {
  if (toolName === "edit_file") return "diff";
  if (!path) return "markdown";

  const lower = path.toLowerCase();
  if (lower.endsWith(".ts")) return "typescript";
  if (lower.endsWith(".tsx")) return "tsx";
  if (lower.endsWith(".js")) return "javascript";
  if (lower.endsWith(".jsx")) return "jsx";
  if (lower.endsWith(".py")) return "python";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".md")) return "markdown";
  if (lower.endsWith(".yml") || lower.endsWith(".yaml")) return "yaml";
  if (lower.endsWith(".sh")) return "bash";
  if (lower.endsWith(".css")) return "css";
  if (lower.endsWith(".html")) return "html";
  if (lower.endsWith(".sql")) return "sql";
  return "markdown";
}

function toolTitle(toolName: FilesystemToolName): string {
  if (toolName === "write_file") return "Write file";
  if (toolName === "edit_file") return "Edit file";
  if (toolName === "ls") return "List directory";
  return "Read file";
}

const WRAPPED_CODEBLOCK_CLASS =
  "[&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_code]:break-words";

export function FilesystemToolArtifact({
  toolName,
  args,
  output,
  defaultOpen = false,
}: {
  toolName: FilesystemToolName;
  args?: unknown;
  output?: string;
  defaultOpen?: boolean;
}) {
  const rawPath = getPath(args, output);
  const path = toolName === "ls" ? rawPath ?? "/" : rawPath;
  const outputSize = toolName === "ls" ? undefined : getOutputSize(output);
  const sizeText = formatBytes(outputSize);

  const lsData = toolName === "ls" ? parseLsOutput(output) : null;

  const writeOrEditPreview = getWriteOrEditPreview(toolName, args);
  const readPreview = toolName === "read_file" ? getReadPreview(output) : null;
  const normalizedReadPreview =
    toolName === "read_file" && readPreview
      ? stripEmbeddedLineNumbers(readPreview)
      : null;
  const previewLanguage = inferLanguage(path, toolName);

  const fallbackParsed =
    toolName === "ls" || !output ? null : parseJson(output);
  const hasFallbackJson =
    !writeOrEditPreview &&
    !readPreview &&
    fallbackParsed !== null &&
    typeof fallbackParsed === "object";

  if (
    !path &&
    !writeOrEditPreview &&
    !readPreview &&
    !hasFallbackJson &&
    !lsData
  ) {
    return null;
  }

  const lsDescription =
    toolName === "ls" && lsData
      ? lsData.error
        ? lsData.error
        : lsData.empty
          ? "empty"
          : `${lsData.entries.length} ${lsData.entries.length === 1 ? "entry" : "entries"}${lsData.truncated ? " (truncated)" : ""}`
      : null;

  return (
    <Collapsible defaultOpen={defaultOpen}>
      <Artifact className="mt-2 rounded-lg border bg-card/50 shadow-none overflow-hidden transition-colors">
        <CollapsibleTrigger asChild>
          <ArtifactHeader className="cursor-pointer border-b-0 bg-transparent px-3 py-2.5 hover:bg-accent/50 transition-colors">
            <div className="min-w-0">
              <ArtifactTitle>{toolTitle(toolName)}</ArtifactTitle>
              <ArtifactDescription className="truncate text-xs">
                {[path, sizeText, lsDescription].filter(Boolean).join(" • ") ||
                  "Filesystem operation"}
              </ArtifactDescription>
            </div>
            <ChevronDown
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180",
              )}
            />
          </ArtifactHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ArtifactContent className="space-y-2 px-3 pb-3 pt-1 border-t border-border/50">
            {toolName === "ls" && lsData ? (
              lsData.error ? (
                <div className="text-xs text-destructive font-mono">
                  {lsData.error}
                </div>
              ) : lsData.empty || lsData.entries.length === 0 ? (
                <div className="text-xs text-muted-foreground italic">
                  No entries.
                </div>
              ) : (
                <div className="flex flex-col gap-0.5 font-mono text-xs">
                  {lsData.entries.map((entry, i) => {
                    const name = basename(entry.path);
                    return (
                      <div
                        key={`${entry.path}-${i}`}
                        className="flex items-center gap-2 min-w-0"
                      >
                        {entry.isDir ? (
                          <FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <FileIcon className="size-3.5 shrink-0 text-muted-foreground/60" />
                        )}
                        <span className="truncate">
                          {name}
                          {entry.isDir ? "/" : ""}
                        </span>
                        {typeof entry.size === "number" && !entry.isDir ? (
                          <span className="ml-auto shrink-0 text-muted-foreground/60">
                            {formatBytes(entry.size)}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                  {lsData.truncated ? (
                    <div className="text-muted-foreground/60 italic pt-1">
                      … output truncated
                    </div>
                  ) : null}
                </div>
              )
            ) : null}
            {toolName !== "read_file" && toolName !== "ls" && writeOrEditPreview ? (
              <CodeBlock
                className={WRAPPED_CODEBLOCK_CLASS}
                code={writeOrEditPreview}
                language={previewLanguage}
                showLineNumbers={false}
              />
            ) : null}
            {toolName === "read_file" && normalizedReadPreview ? (
              <CodeBlock
                className={WRAPPED_CODEBLOCK_CLASS}
                code={normalizedReadPreview}
                language={previewLanguage}
                showLineNumbers={true}
              />
            ) : null}
            {hasFallbackJson ? (
              <CodeBlock
                code={JSON.stringify(fallbackParsed, null, 2)}
                language="json"
                showLineNumbers={false}
              />
            ) : null}
          </ArtifactContent>
        </CollapsibleContent>
      </Artifact>
    </Collapsible>
  );
}
