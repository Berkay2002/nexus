export { tavilySearch, tavilySearchSchema } from "./search/tool.js";
export type { TavilySearchInput } from "./search/tool.js";

export { tavilyExtract, tavilyExtractSchema } from "./extract/tool.js";
export type { TavilyExtractInput } from "./extract/tool.js";

export { tavilyMap, tavilyMapSchema } from "./map/tool.js";
export type { TavilyMapInput } from "./map/tool.js";

export { generateImage, generateImageSchema } from "./generate-image/tool.js";
export type { GenerateImageInput } from "./generate-image/tool.js";

import { tavilySearch } from "./search/tool.js";
import { tavilyExtract } from "./extract/tool.js";
import { tavilyMap } from "./map/tool.js";
import { generateImage } from "./generate-image/tool.js";

/**
 * Tools for the Research sub-agent.
 * Includes all Tavily tools for web search, extraction, and site mapping.
 */
export const researchTools = [tavilySearch, tavilyExtract, tavilyMap] as const;

/**
 * Tools for the Creative sub-agent.
 * Includes image generation via Gemini Imagen.
 */
export const creativeTools = [generateImage] as const;

/**
 * All custom tools.
 * Does NOT include auto-provisioned tools (execute, filesystem tools)
 * which come from the DeepAgent backend.
 */
export const allTools = [...researchTools, ...creativeTools] as const;
