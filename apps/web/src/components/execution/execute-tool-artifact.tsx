"use client";

import {
  Artifact,
  ArtifactContent,
  ArtifactDescription,
  ArtifactHeader,
  ArtifactTitle,
} from "@/components/ai-elements/artifact";
import { CodeBlock } from "@/components/ai-elements/code-block";
import { Terminal } from "@/components/ai-elements/terminal";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

function parseJson(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getTerminalOutput(rawOutput: string): string | null {
  const trimmed = rawOutput.trim();
  if (!trimmed) return null;

  const parsed = parseJson(trimmed);
  if (!isObjectLike(parsed)) {
    return rawOutput;
  }

  const stdout = typeof parsed.stdout === "string" ? parsed.stdout : "";
  const stderr = typeof parsed.stderr === "string" ? parsed.stderr : "";

  if (!stdout && !stderr) {
    return null;
  }

  if (stdout && stderr) {
    return `${stdout}\n\n[stderr]\n${stderr}`;
  }

  return stdout || stderr;
}

function getStructuredOutput(rawOutput: string): unknown | null {
  const trimmed = rawOutput.trim();
  if (!trimmed) return null;

  const parsed = parseJson(trimmed);
  if (parsed === null) return null;

  // If output has stdout/stderr, terminal rendering is usually better.
  if (isObjectLike(parsed) && ("stdout" in parsed || "stderr" in parsed)) {
    return null;
  }

  return parsed;
}

export function ExecuteToolArtifact({
  command,
  output,
  isStreaming,
  title = "Execution",
  description,
  defaultOpen,
}: {
  command?: string;
  output?: string;
  isStreaming?: boolean;
  title?: string;
  description?: string;
  defaultOpen?: boolean;
}) {
  const terminalOutput = output ? getTerminalOutput(output) : null;
  const structuredOutput = output ? getStructuredOutput(output) : null;

  if (!command && !terminalOutput && !structuredOutput) {
    return null;
  }

  return (
    <Collapsible defaultOpen={defaultOpen ?? Boolean(isStreaming)}>
      <Artifact className="mt-2 rounded-lg border bg-card/50 shadow-none overflow-hidden transition-colors">
        <CollapsibleTrigger asChild>
          <ArtifactHeader className="cursor-pointer border-b-0 bg-transparent px-3 py-2.5 hover:bg-accent/50 transition-colors">
            <div className="min-w-0">
              <ArtifactTitle>{title}</ArtifactTitle>
              {description ? (
                <ArtifactDescription className="truncate text-xs">
                  {description}
                </ArtifactDescription>
              ) : null}
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
            {command ? (
              <CodeBlock code={command} language="bash" showLineNumbers={false} />
            ) : null}
            {terminalOutput ? (
              <Terminal output={terminalOutput} isStreaming={Boolean(isStreaming)} />
            ) : null}
            {!terminalOutput && structuredOutput ? (
              <CodeBlock
                code={JSON.stringify(structuredOutput, null, 2)}
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
