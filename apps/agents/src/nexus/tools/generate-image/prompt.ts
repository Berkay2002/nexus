export const TOOL_NAME = "generate_image";

export const TOOL_DESCRIPTION =
  "Generate an image using Gemini's image generation capability. " +
  "Provide a detailed prompt describing the desired image including style, content, composition, and mood. " +
  "Writes generated image files directly to the sandbox workspace path provided in filename. " +
  "For best UX, pass an absolute workspace path with an explicit image extension (for example .png, .jpg, or .webp). " +
  "Returns lightweight metadata (paths, mime types, approximate sizes) and does not return base64 image payloads. " +
  "Use for creating illustrations, diagrams, banners, logos, and other visual content.";
