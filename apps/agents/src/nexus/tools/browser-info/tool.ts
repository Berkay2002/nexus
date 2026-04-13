import { tool } from "@langchain/core/tools";
import { z } from "zod/v4";
import {
  normalizeApiError,
  sandboxGet,
  toRecord,
} from "../sandbox-runtime-api.js";
import { TOOL_DESCRIPTION, TOOL_NAME } from "./prompt.js";

export const sandboxBrowserInfoSchema = z.object({});

export type SandboxBrowserInfoInput = z.infer<typeof sandboxBrowserInfoSchema>;

function getString(
  record: Record<string, unknown> | null,
  key: string,
): string | null {
  const value = record?.[key];
  return typeof value === "string" ? value : null;
}

function getNumber(
  record: Record<string, unknown> | null,
  key: string,
): number | null {
  const value = record?.[key];
  return typeof value === "number" ? value : null;
}

export const sandboxBrowserInfo = tool(
  async () => {
    try {
      const result = await sandboxGet("/v1/browser/info");
      if (!result.ok) {
        return JSON.stringify({
          endpoint: "/v1/browser/info",
          error: normalizeApiError(result),
          kind: "browser_info",
          success: false,
        });
      }

      const envelope = toRecord(result.data);
      const data = toRecord(envelope?.data);
      const viewport = toRecord(data?.viewport);
      const success =
        typeof envelope?.success === "boolean" ? envelope.success : true;

      return JSON.stringify({
        kind: "browser_info",
        success,
        message: getString(envelope, "message"),
        user_agent: getString(data, "user_agent"),
        cdp_url: getString(data, "cdp_url"),
        vnc_url: getString(data, "vnc_url"),
        viewport: viewport
          ? {
              width: getNumber(viewport, "width"),
              height: getNumber(viewport, "height"),
            }
          : null,
      });
    } catch (error) {
      return JSON.stringify({
        endpoint: "/v1/browser/info",
        error: error instanceof Error ? error.message : String(error),
        kind: "browser_info",
        success: false,
      });
    }
  },
  {
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    schema: sandboxBrowserInfoSchema,
  },
);
