import { tool } from "@langchain/core/tools";
import { z } from "zod/v4";
import {
  normalizeApiError,
  sandboxPostJson,
  toRecord,
} from "../sandbox-runtime-api.js";
import { TOOL_DESCRIPTION, TOOL_NAME } from "./prompt.js";

export const sandboxUtilConvertToMarkdownSchema = z.object({
  uri: z
    .string()
    .min(1)
    .describe(
      "URI to convert. Accepts file:// paths inside the sandbox, http(s):// URLs, or any scheme the container can fetch.",
    ),
});

export type SandboxUtilConvertToMarkdownInput = z.infer<
  typeof sandboxUtilConvertToMarkdownSchema
>;

function getString(
  record: Record<string, unknown> | null,
  key: string,
): string | null {
  const value = record?.[key];
  return typeof value === "string" ? value : null;
}

export const sandboxUtilConvertToMarkdown = tool(
  async ({ uri }) => {
    try {
      const result = await sandboxPostJson("/v1/util/convert_to_markdown", {
        uri,
      });
      if (!result.ok) {
        return JSON.stringify({
          endpoint: "/v1/util/convert_to_markdown",
          error: normalizeApiError(result),
          kind: "convert_to_markdown",
          uri,
          success: false,
        });
      }

      const envelope = toRecord(result.data);
      const rawData = envelope?.data;
      const dataRecord = toRecord(rawData);
      const markdown =
        typeof rawData === "string"
          ? rawData
          : (getString(dataRecord, "markdown") ??
            getString(dataRecord, "text") ??
            getString(dataRecord, "content"));

      const success =
        typeof envelope?.success === "boolean" ? envelope.success : true;

      return JSON.stringify({
        kind: "convert_to_markdown",
        success,
        uri,
        message: getString(envelope, "message"),
        markdown,
      });
    } catch (error) {
      return JSON.stringify({
        endpoint: "/v1/util/convert_to_markdown",
        error: error instanceof Error ? error.message : String(error),
        kind: "convert_to_markdown",
        uri,
        success: false,
      });
    }
  },
  {
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    schema: sandboxUtilConvertToMarkdownSchema,
  },
);
