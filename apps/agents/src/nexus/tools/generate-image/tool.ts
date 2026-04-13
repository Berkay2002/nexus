import { tool } from "@langchain/core/tools";
import { z } from "zod/v4";
import { HumanMessage } from "@langchain/core/messages";
import { SandboxClient } from "@agent-infra/sandbox";
import { posix as pathPosix } from "node:path";
import { resolveTier } from "../../models/index.js";
import {
  getWorkspaceRootForThread,
  remapWorkspacePath,
} from "../../backend/workspace.js";
import { TOOL_NAME, TOOL_DESCRIPTION } from "./prompt.js";

export const generateImageSchema = z.object({
  prompt: z
    .string()
    .describe(
      "Detailed description of the image to generate. Be specific about style, content, composition, and mood.",
    ),
  filename: z
    .string()
    .describe(
      "Filename for the generated image (e.g., 'hero-banner.png'). Will be saved to the agent's workspace.",
    ),
});

export type GenerateImageInput = z.infer<typeof generateImageSchema>;

const SANDBOX_URL = process.env.SANDBOX_URL ?? "http://localhost:8080";

const MIME_EXTENSION: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

function hasExtension(filePath: string): boolean {
  const parsed = pathPosix.parse(filePath);
  return Boolean(parsed.ext);
}

function extensionForMime(mimeType: string): string {
  return MIME_EXTENSION[mimeType] ?? ".png";
}

function buildOutputPath(
  requestedPath: string,
  mimeType: string,
  imageIndex: number,
  imageCount: number,
): string {
  const parsed = pathPosix.parse(requestedPath);
  const ext = hasExtension(requestedPath)
    ? parsed.ext
    : extensionForMime(mimeType);

  const baseName = hasExtension(requestedPath) ? parsed.name : parsed.base;
  const indexedName =
    imageCount > 1 ? `${baseName}-${imageIndex + 1}` : baseName;

  return pathPosix.join(parsed.dir, `${indexedName}${ext}`);
}

function resolveThreadIdFromConfig(config: unknown): string | undefined {
  if (!config || typeof config !== "object") return undefined;
  const cfg = config as { configurable?: Record<string, unknown> };
  const value = cfg.configurable?.thread_id ?? cfg.configurable?.threadId;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function resolveGenerateImageOutputPath(
  filename: string,
  config: unknown,
): string {
  const threadId = resolveThreadIdFromConfig(config);
  const workspaceRoot = getWorkspaceRootForThread(threadId);
  return remapWorkspacePath(filename, workspaceRoot);
}

export const generateImage = tool(
  async ({ prompt, filename }, config) => {
    const model = resolveTier("image", undefined, {
      temperature: 1,
      responseModalities: ["IMAGE", "TEXT"],
    } as any);
    if (!model) {
      throw new Error(
        "Image generation unavailable — no image-capable provider configured",
      );
    }

    const response = await model.invoke([
      new HumanMessage(`Generate an image: ${prompt}`),
    ]);
    const sandbox = new SandboxClient({ environment: SANDBOX_URL });
    const resolvedFilename = resolveGenerateImageOutputPath(filename, config);

    // @langchain/google emits generated images as `inlineData` blocks:
    //   { type: "inlineData", inlineData: { mimeType, data } }
    // (NOT the LangChain-core canonical `file` block shape). It also interleaves
    // Gemini "thought" blocks: { type: "text", thought: true, text: "..." } —
    // those are reasoning output and must not be surfaced as the agent's prose.
    const rawContent = (response as any).content;
    const blocks: any[] = Array.isArray(rawContent) ? rawContent : [];

    const imageBlocks = blocks
      .filter(
        (block) =>
          block &&
          block.type === "inlineData" &&
          block.inlineData &&
          typeof block.inlineData.data === "string" &&
          typeof block.inlineData.mimeType === "string" &&
          block.inlineData.mimeType.startsWith("image/"),
      )
      .map((block) => ({
        base64: block.inlineData.data as string,
        mime_type: block.inlineData.mimeType as string,
      }));

    if (imageBlocks.length === 0) {
      const textContent = blocks
        .filter(
          (block) => block && block.type === "text" && block.thought !== true,
        )
        .map((block) => block.text ?? "")
        .join("\n");

      return JSON.stringify({
        success: false,
        error: "No image was generated",
        text: textContent,
        filename: resolvedFilename,
      });
    }

    const savedFiles: Array<{
      path: string;
      mime_type: string;
      approx_bytes: number;
    }> = [];

    for (let i = 0; i < imageBlocks.length; i++) {
      const image = imageBlocks[i]!;
      const outputPath = buildOutputPath(
        resolvedFilename,
        image.mime_type,
        i,
        imageBlocks.length,
      );

      const parentDir = pathPosix.dirname(outputPath);
      if (parentDir && parentDir !== ".") {
        const mkdirResponse = await sandbox.shell.execCommand({
          command: `mkdir -p ${JSON.stringify(parentDir)}`,
        });
        if (!mkdirResponse.ok) {
          return JSON.stringify({
            success: false,
            error: "Failed to prepare output directory in sandbox",
            directory: parentDir,
            details: mkdirResponse.error,
          });
        }
      }

      const writeResponse = await sandbox.file.writeFile({
        file: outputPath,
        content: image.base64,
        encoding: "base64",
      });

      if (!writeResponse.ok) {
        return JSON.stringify({
          success: false,
          error: "Failed to write generated image to sandbox",
          filename: outputPath,
          details: writeResponse.error,
        });
      }

      savedFiles.push({
        path: outputPath,
        mime_type: image.mime_type,
        approx_bytes: Math.floor((image.base64.length * 3) / 4),
      });
    }

    return JSON.stringify({
      success: true,
      prompt,
      image_count: savedFiles.length,
      files: savedFiles,
      note:
        "Images were written directly to the sandbox filesystem. No base64 payload is returned to the model.",
    });
  },
  {
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    schema: generateImageSchema,
  },
);
