"use client";

import {
  Artifact,
  ArtifactContent,
  ArtifactDescription,
  ArtifactHeader,
  ArtifactTitle,
} from "@/components/ai-elements/artifact";
import { Image } from "@/components/ai-elements/image";
import { CodeBlock } from "@/components/ai-elements/code-block";

type GeneratedImageFile = {
  path: string;
  mime_type?: string;
  approx_bytes?: number;
};

type GenerateImageResult = {
  success?: boolean;
  prompt?: string;
  image_count?: number;
  files?: GeneratedImageFile[];
  note?: string;
};

function parseResult(output: string): GenerateImageResult | null {
  try {
    const parsed = JSON.parse(output);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as GenerateImageResult;
  } catch {
    return null;
  }
}

function isImagePath(path: string, mimeType?: string): boolean {
  if (typeof mimeType === "string" && mimeType.startsWith("image/")) {
    return true;
  }
  const lower = path.toLowerCase();
  return (
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".gif") ||
    lower.endsWith(".svg")
  );
}

function buildWorkspaceFileHref(path: string, download = false): string {
  const params = new URLSearchParams({ path });
  if (download) params.set("download", "1");
  return `/api/workspace/file?${params.toString()}`;
}

function baseName(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

export function GenerateImageArtifact({
  output,
  prompt,
  title = "Generated images",
}: {
  output?: string;
  prompt?: string;
  title?: string;
}) {
  if (!output) return null;

  const parsed = parseResult(output);
  if (!parsed) {
    return (
      <Artifact className="mt-2 border-border/60 bg-card/40">
        <ArtifactHeader>
          <ArtifactTitle>{title}</ArtifactTitle>
        </ArtifactHeader>
        <ArtifactContent className="p-3">
          <CodeBlock code={output} language="json" showLineNumbers={false} />
        </ArtifactContent>
      </Artifact>
    );
  }

  const files = Array.isArray(parsed.files) ? parsed.files : [];
  const imageFiles = files.filter(
    (file) => typeof file.path === "string" && isImagePath(file.path, file.mime_type),
  );
  const promptText =
    typeof parsed.prompt === "string"
      ? parsed.prompt
      : typeof prompt === "string"
        ? prompt
        : undefined;

  if (imageFiles.length === 0) {
    return (
      <Artifact className="mt-2 border-border/60 bg-card/40">
        <ArtifactHeader>
          <div>
            <ArtifactTitle>{title}</ArtifactTitle>
            {promptText ? (
              <ArtifactDescription className="line-clamp-2 text-xs">
                {promptText}
              </ArtifactDescription>
            ) : null}
          </div>
        </ArtifactHeader>
        <ArtifactContent className="p-3">
          <CodeBlock
            code={JSON.stringify(parsed, null, 2)}
            language="json"
            showLineNumbers={false}
          />
        </ArtifactContent>
      </Artifact>
    );
  }

  return (
    <Artifact className="mt-2 border-border/60 bg-card/40">
      <ArtifactHeader>
        <div className="min-w-0">
          <ArtifactTitle>{title}</ArtifactTitle>
          {promptText ? (
            <ArtifactDescription className="line-clamp-2 text-xs">
              {promptText}
            </ArtifactDescription>
          ) : null}
        </div>
      </ArtifactHeader>
      <ArtifactContent className="space-y-3 p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {imageFiles.map((file, index) => {
            const openHref = buildWorkspaceFileHref(file.path);
            const downloadHref = buildWorkspaceFileHref(file.path, true);
            return (
              <div
                key={`${file.path}-${index}`}
                className="overflow-hidden rounded-md border border-border/60 bg-background"
              >
                <a href={openHref} rel="noreferrer" target="_blank">
                  <Image
                    alt={baseName(file.path)}
                    className="max-h-72 w-full object-contain bg-muted/20"
                    src={openHref}
                  />
                </a>
                <div className="flex items-center justify-between gap-2 border-t border-border/60 px-2.5 py-2 text-[11px]">
                  <span className="truncate text-muted-foreground">{baseName(file.path)}</span>
                  <div className="flex items-center gap-2">
                    <a
                      className="text-primary hover:underline"
                      href={openHref}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open
                    </a>
                    <a
                      className="text-muted-foreground hover:text-foreground hover:underline"
                      download={baseName(file.path)}
                      href={downloadHref}
                    >
                      Download
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ArtifactContent>
    </Artifact>
  );
}
