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
      <Artifact className="mt-2 border-border/60 bg-card/40">
        <CollapsibleTrigger asChild>
          <ArtifactHeader className="group cursor-pointer">
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
                "size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180",
              )}
            />
          </ArtifactHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ArtifactContent className="space-y-2 p-3">
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
