import { tool } from "@langchain/core/tools";
import { z } from "zod/v4";
import {
  normalizeBinaryError,
  sandboxGetBinary,
} from "../sandbox-runtime-api.js";
import { TOOL_DESCRIPTION, TOOL_NAME } from "./prompt.js";

export const sandboxBrowserScreenshotSchema = z.object({});

export type SandboxBrowserScreenshotInput = z.infer<
  typeof sandboxBrowserScreenshotSchema
>;

function parseIntHeader(
  headers: Record<string, string>,
  key: string,
): number | null {
  const value = headers[key];
  if (typeof value !== "string") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export const sandboxBrowserScreenshot = tool(
  async () => {
    try {
      const result = await sandboxGetBinary("/v1/browser/screenshot");
      if (!result.ok || !result.bytes) {
        return JSON.stringify({
          endpoint: "/v1/browser/screenshot",
          error: normalizeBinaryError(result),
          kind: "browser_screenshot",
          success: false,
        });
      }

      const base64 = Buffer.from(result.bytes).toString("base64");
      const screen_width = parseIntHeader(result.headers, "x-screen-width");
      const screen_height = parseIntHeader(result.headers, "x-screen-height");
      const image_width = parseIntHeader(result.headers, "x-image-width");
      const image_height = parseIntHeader(result.headers, "x-image-height");

      return JSON.stringify({
        kind: "browser_screenshot",
        success: true,
        mime_type: "image/png",
        size_bytes: result.bytes.byteLength,
        screen_width,
        screen_height,
        image_width,
        image_height,
        image_base64: base64,
      });
    } catch (error) {
      return JSON.stringify({
        endpoint: "/v1/browser/screenshot",
        error: error instanceof Error ? error.message : String(error),
        kind: "browser_screenshot",
        success: false,
      });
    }
  },
  {
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    schema: sandboxBrowserScreenshotSchema,
  },
);
