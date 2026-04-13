import { tool } from "@langchain/core/tools";
import { z } from "zod/v4";
import {
  normalizeApiError,
  sandboxGet,
  toRecord,
} from "../sandbox-runtime-api.js";
import { TOOL_DESCRIPTION, TOOL_NAME } from "./prompt.js";

export const sandboxCodeInfoSchema = z.object({});

export type SandboxCodeInfoInput = z.infer<typeof sandboxCodeInfoSchema>;

function getString(
  record: Record<string, unknown> | null,
  key: string,
): string | null {
  const value = record?.[key];
  return typeof value === "string" ? value : null;
}

export const sandboxCodeInfo = tool(
  async () => {
    try {
      const result = await sandboxGet("/v1/code/info");
      if (!result.ok) {
        return JSON.stringify({
          endpoint: "/v1/code/info",
          error: normalizeApiError(result),
          kind: "code_info",
          success: false,
        });
      }

      const envelope = toRecord(result.data);
      const data = toRecord(envelope?.data);
      const languages = Array.isArray(data?.languages) ? data.languages : [];
      const success =
        typeof envelope?.success === "boolean" ? envelope.success : true;

      return JSON.stringify({
        kind: "code_info",
        success,
        message: getString(envelope, "message"),
        languages,
      });
    } catch (error) {
      return JSON.stringify({
        endpoint: "/v1/code/info",
        error: error instanceof Error ? error.message : String(error),
        kind: "code_info",
        success: false,
      });
    }
  },
  {
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    schema: sandboxCodeInfoSchema,
  },
);
