import { tool } from "@langchain/core/tools";
import { z } from "zod/v4";
import { HumanMessage } from "@langchain/core/messages";
import { createGoogleModel } from "../../models.js";
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
    const model = createGoogleModel("gemini-3.1-flash-image-preview", {
      temperature: 1,
      responseModalities: ["IMAGE", "TEXT"],
    } as any);

    const response = await model.invoke([
      new HumanMessage(`Generate an image: ${prompt}`),
    ]);

    const blocks = (response as any).contentBlocks ?? [];

    const imageBlocks = Array.isArray(blocks)
      ? blocks.filter(
          (block: any) =>
            block &&
            block.type === "file" &&
            typeof block.data === "string" &&
            typeof block.mimeType === "string" &&
            block.mimeType.startsWith("image/"),
        )
      : [];

    if (imageBlocks.length === 0) {
      const textContent = Array.isArray(blocks)
        ? blocks
            .filter((block: any) => block && block.type === "text")
            .map((block: any) => block.text)
            .join("\n")
        : String(response.content ?? "");

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
      images: imageBlocks.map((block: any) => ({
        base64: block.data,
        mime_type: block.mimeType,
      })),
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
