import { tool } from "@langchain/core/tools";
import { z } from "zod/v4";
import {
  normalizeApiError,
  sandboxPostJson,
  toRecord,
} from "../sandbox-runtime-api.js";
import { TOOL_DESCRIPTION, TOOL_NAME } from "./prompt.js";

export const sandboxBrowserConfigSchema = z.object({
  width: z
    .number()
    .int()
    .positive()
    .describe("Display width in pixels (must be in the supported list)"),
  height: z
    .number()
    .int()
    .positive()
    .describe("Display height in pixels (must be in the supported list)"),
});

export type SandboxBrowserConfigInput = z.infer<
  typeof sandboxBrowserConfigSchema
>;

function getString(
  record: Record<string, unknown> | null,
  key: string,
): string | null {
  const value = record?.[key];
  return typeof value === "string" ? value : null;
}

export const sandboxBrowserConfig = tool(
  async ({ width, height }) => {
    try {
      const payload = { resolution: { width, height } };
      const result = await sandboxPostJson("/v1/browser/config", payload);
      if (!result.ok) {
        return JSON.stringify({
          endpoint: "/v1/browser/config",
          error: normalizeApiError(result),
          kind: "browser_config",
          success: false,
        });
      }

      const envelope = toRecord(result.data);
      const success =
        typeof envelope?.success === "boolean" ? envelope.success : true;

      return JSON.stringify({
        kind: "browser_config",
        success,
        message: getString(envelope, "message"),
        resolution: { width, height },
      });
    } catch (error) {
      return JSON.stringify({
        endpoint: "/v1/browser/config",
        error: error instanceof Error ? error.message : String(error),
        kind: "browser_config",
        success: false,
      });
    }
  },
  {
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    schema: sandboxBrowserConfigSchema,
  },
);
