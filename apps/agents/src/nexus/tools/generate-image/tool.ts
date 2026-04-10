import { tool } from "@langchain/core/tools";
import { z } from "zod/v4";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
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
    const model = new ChatGoogleGenerativeAI({
      model: "gemini-3.1-flash-image-preview",
      temperature: 1,
    });

    const response = await model.invoke([
      new HumanMessage({
        content: [
          {
            type: "text",
            text: `Generate an image: ${prompt}`,
          },
        ],
      }),
    ]);

    // Extract image data from response content blocks
    const content = response.content;
    if (typeof content === "string") {
      return JSON.stringify({
        success: false,
        error: "Model returned text instead of an image",
        text: content,
      });
    }

    // Content is an array of blocks — find image blocks
    const imageBlocks = Array.isArray(content)
      ? content.filter(
          (block): block is { type: "image_url"; image_url: { url: string } } =>
            typeof block === "object" &&
            block !== null &&
            "type" in block &&
            block.type === "image_url",
        )
      : [];

    if (imageBlocks.length === 0) {
      const textContent = Array.isArray(content)
        ? content
            .filter(
              (block): block is { type: "text"; text: string } =>
                typeof block === "object" &&
                block !== null &&
                "type" in block &&
                block.type === "text",
            )
            .map((block) => block.text)
            .join("\n")
        : String(content);

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
      images: imageBlocks.map((block) => ({
        data_url: block.image_url.url,
      })),
      instruction:
        "Use write_file to save the image data to the workspace. The image data is base64 encoded in the data_url field.",
    });
  },
  {
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    schema: generateImageSchema,
  },
);
