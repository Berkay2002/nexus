import { tool } from "@langchain/core/tools";
import { z } from "zod/v4";
import {
  encodePathSegment,
  normalizeApiError,
  sandboxDelete,
  toRecord,
} from "../sandbox-runtime-api.js";
import { TOOL_DESCRIPTION, TOOL_NAME } from "./prompt.js";

export const sandboxJupyterDeleteSessionSchema = z.object({
  session_id: z
    .string()
    .min(1)
    .describe("The Jupyter session_id to terminate. Required."),
});

export type SandboxJupyterDeleteSessionInput = z.infer<
  typeof sandboxJupyterDeleteSessionSchema
>;

function getString(
  record: Record<string, unknown> | null,
  key: string,
): string | null {
  const value = record?.[key];
  return typeof value === "string" ? value : null;
}

export const sandboxJupyterDeleteSession = tool(
  async ({ session_id }) => {
    const endpoint = `/v1/jupyter/sessions/${encodePathSegment(session_id)}`;
    try {
      const result = await sandboxDelete(endpoint);
      if (!result.ok) {
        return JSON.stringify({
          endpoint,
          error: normalizeApiError(result),
          kind: "jupyter_session_deleted",
          session_id,
          success: false,
        });
      }

      const envelope = toRecord(result.data);
      const success =
        typeof envelope?.success === "boolean" ? envelope.success : true;

      return JSON.stringify({
        kind: "jupyter_session_deleted",
        success,
        session_id,
        message: getString(envelope, "message"),
      });
    } catch (error) {
      return JSON.stringify({
        endpoint,
        error: error instanceof Error ? error.message : String(error),
        kind: "jupyter_session_deleted",
        session_id,
        success: false,
      });
    }
  },
  {
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    schema: sandboxJupyterDeleteSessionSchema,
  },
);
