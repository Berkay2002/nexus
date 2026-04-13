import { tool } from "@langchain/core/tools";
import { z } from "zod/v4";
import {
  normalizeApiError,
  sandboxGet,
  toRecord,
} from "../sandbox-runtime-api.js";
import { TOOL_DESCRIPTION, TOOL_NAME } from "./prompt.js";

export const sandboxNodejsInfoSchema = z.object({});

export type SandboxNodejsInfoInput = z.infer<typeof sandboxNodejsInfoSchema>;

function getString(
  record: Record<string, unknown> | null,
  key: string,
): string | null {
  const value = record?.[key];
  return typeof value === "string" ? value : null;
}

export const sandboxNodejsInfo = tool(
  async () => {
    try {
      const result = await sandboxGet("/v1/nodejs/info");
      if (!result.ok) {
        return JSON.stringify({
          endpoint: "/v1/nodejs/info",
          error: normalizeApiError(result),
          kind: "nodejs_info",
          success: false,
        });
      }

      const envelope = toRecord(result.data);
      const data = toRecord(envelope?.data);
      const supportedLanguages = Array.isArray(data?.supported_languages)
        ? data.supported_languages.filter(
            (item): item is string => typeof item === "string",
          )
        : [];
      const success =
        typeof envelope?.success === "boolean" ? envelope.success : true;

      return JSON.stringify({
        kind: "nodejs_info",
        success,
        message: getString(envelope, "message"),
        node_version: getString(data, "node_version"),
        npm_version: getString(data, "npm_version"),
        supported_languages: supportedLanguages,
        description: getString(data, "description"),
        runtime_directory: getString(data, "runtime_directory"),
        error_detail: getString(data, "error"),
      });
    } catch (error) {
      return JSON.stringify({
        endpoint: "/v1/nodejs/info",
        error: error instanceof Error ? error.message : String(error),
        kind: "nodejs_info",
        success: false,
      });
    }
  },
  {
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    schema: sandboxNodejsInfoSchema,
  },
);
