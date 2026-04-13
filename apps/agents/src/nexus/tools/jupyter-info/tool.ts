import { tool } from "@langchain/core/tools";
import { z } from "zod/v4";
import {
  normalizeApiError,
  sandboxGet,
  toRecord,
} from "../sandbox-runtime-api.js";
import { TOOL_DESCRIPTION, TOOL_NAME } from "./prompt.js";

export const sandboxJupyterInfoSchema = z.object({});

export type SandboxJupyterInfoInput = z.infer<typeof sandboxJupyterInfoSchema>;

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

export const sandboxJupyterInfo = tool(
  async () => {
    try {
      const result = await sandboxGet("/v1/jupyter/info");
      if (!result.ok) {
        return JSON.stringify({
          endpoint: "/v1/jupyter/info",
          error: normalizeApiError(result),
          kind: "jupyter_info",
          success: false,
        });
      }

      const envelope = toRecord(result.data);
      const data = toRecord(envelope?.data);
      const availableKernels = Array.isArray(data?.available_kernels)
        ? data.available_kernels.filter(
            (item): item is string => typeof item === "string",
          )
        : [];
      const success =
        typeof envelope?.success === "boolean" ? envelope.success : true;

      return JSON.stringify({
        kind: "jupyter_info",
        success,
        message: getString(envelope, "message"),
        default_kernel: getString(data, "default_kernel"),
        available_kernels: availableKernels,
        active_sessions: getNumber(data, "active_sessions"),
        session_timeout_seconds: getNumber(data, "session_timeout_seconds"),
        max_sessions: getNumber(data, "max_sessions"),
        description: getString(data, "description"),
        kernel_detection: getString(data, "kernel_detection"),
      });
    } catch (error) {
      return JSON.stringify({
        endpoint: "/v1/jupyter/info",
        error: error instanceof Error ? error.message : String(error),
        kind: "jupyter_info",
        success: false,
      });
    }
  },
  {
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    schema: sandboxJupyterInfoSchema,
  },
);
