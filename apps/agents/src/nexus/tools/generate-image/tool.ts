import { tool } from "@langchain/core/tools";
import { z } from "zod/v4";
import { HumanMessage } from "@langchain/core/messages";
import { resolveTier } from "../../models/index.js";
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

export const generateImage = tool(
  async ({ prompt, filename }) => {
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
        filename,
      });
    }

    return JSON.stringify({
      success: true,
      filename,
      prompt,
      image_count: imageBlocks.length,
      images: imageBlocks,
      instruction:
        "Use write_file to save each image to the workspace. Image data is raw base64 (no data URL prefix) in the `base64` field; the MIME type is in `mime_type`. Pass the base64 string directly to write_file with binary mode.",
    });
  },
  {
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    schema: generateImageSchema,
  },
);
