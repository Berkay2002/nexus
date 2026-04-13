import { tool } from "@langchain/core/tools";
import { z } from "zod/v4";
import {
  normalizeApiError,
  sandboxPostJson,
  toRecord,
} from "../sandbox-runtime-api.js";
import { TOOL_DESCRIPTION, TOOL_NAME } from "./prompt.js";

export const sandboxJupyterCreateSessionSchema = z.object({
  session_id: z
    .string()
    .optional()
    .describe("Optional explicit session ID. If omitted, the service auto-generates one."),
  kernel_name: z
    .string()
    .optional()
    .describe("Optional kernel name (for example python3, python3.11, python3.12)."),
});

export type SandboxJupyterCreateSessionInput = z.infer<
  typeof sandboxJupyterCreateSessionSchema
>;

function getString(
  record: Record<string, unknown> | null,
  key: string,
): string | null {
  const value = record?.[key];
  return typeof value === "string" ? value : null;
}

export const sandboxJupyterCreateSession = tool(
  async ({ kernel_name, session_id }) => {
    try {
      const payload: Record<string, unknown> = {};
      if (typeof kernel_name === "string" && kernel_name.trim()) {
        payload.kernel_name = kernel_name;
      }
      if (typeof session_id === "string" && session_id.trim()) {
        payload.session_id = session_id;
      }

      const result = await sandboxPostJson("/v1/jupyter/sessions/create", payload);
      if (!result.ok) {
        return JSON.stringify({
          endpoint: "/v1/jupyter/sessions/create",
          error: normalizeApiError(result),
          kind: "notebook_session",
          success: false,
        });
      }

      const envelope = toRecord(result.data);
      const data = toRecord(envelope?.data);
      const success =
        typeof envelope?.success === "boolean" ? envelope.success : true;

      return JSON.stringify({
        kind: "notebook_session",
        success,
        message: getString(envelope, "message"),
        session_id: getString(data, "session_id"),
        kernel_name: getString(data, "kernel_name"),
        session_message: getString(data, "message"),
      });
    } catch (error) {
      return JSON.stringify({
        endpoint: "/v1/jupyter/sessions/create",
        error: error instanceof Error ? error.message : String(error),
        kind: "notebook_session",
        success: false,
      });
    }
  },
  {
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    schema: sandboxJupyterCreateSessionSchema,
  },
);
