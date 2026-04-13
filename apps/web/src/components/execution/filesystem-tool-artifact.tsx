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
import { ChevronDown } from "lucide-react";
import type { BundledLanguage } from "shiki";

type FilesystemToolName = "write_file" | "edit_file" | "read_file";

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

  const twoColPattern = /^\s*\d+\s+\d+\s+/;
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
  return "Read file";
}

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
  const path = getPath(args, output);
  const outputSize = getOutputSize(output);
  const sizeText = formatBytes(outputSize);

  const writeOrEditPreview = getWriteOrEditPreview(toolName, args);
  const readPreview = toolName === "read_file" ? getReadPreview(output) : null;
  const normalizedReadPreview =
    toolName === "read_file" && readPreview
      ? stripEmbeddedLineNumbers(readPreview)
      : null;
  const previewLanguage = inferLanguage(path, toolName);

  const fallbackParsed = output ? parseJson(output) : null;
  const hasFallbackJson =
    !writeOrEditPreview &&
    !readPreview &&
    fallbackParsed !== null &&
    typeof fallbackParsed === "object";

  if (!path && !writeOrEditPreview && !readPreview && !hasFallbackJson) {
    return null;
  }

  return (
    <Collapsible defaultOpen={defaultOpen}>
      <Artifact className="mt-2 border-border/60 bg-card/40">
        <CollapsibleTrigger asChild>
          <ArtifactHeader className="group cursor-pointer">
            <div className="min-w-0">
              <ArtifactTitle>{toolTitle(toolName)}</ArtifactTitle>
              <ArtifactDescription className="truncate text-xs">
                {[path, sizeText].filter(Boolean).join(" • ") || "Filesystem operation"}
              </ArtifactDescription>
            </div>
            <ChevronDown
              className={cn(
                "size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180",
              )}
            />
          </ArtifactHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ArtifactContent className="space-y-2 p-3">
            {toolName !== "read_file" && writeOrEditPreview ? (
              <CodeBlock
                code={writeOrEditPreview}
                language={previewLanguage}
                showLineNumbers={false}
              />
            ) : null}
            {toolName === "read_file" && normalizedReadPreview ? (
              <CodeBlock
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
