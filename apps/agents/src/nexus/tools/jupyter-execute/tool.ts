import { tool } from "@langchain/core/tools";
import { z } from "zod/v4";
import {
  normalizeApiError,
  sandboxPostJson,
  toRecord,
} from "../sandbox-runtime-api.js";
import { TOOL_DESCRIPTION, TOOL_NAME } from "./prompt.js";

export const sandboxJupyterExecuteSchema = z.object({
  code: z.string().describe("Python code to execute in a Jupyter kernel"),
  timeout: z
    .number()
    .int()
    .min(1)
    .max(300)
    .optional()
    .describe("Optional timeout in seconds (1-300)"),
  kernel_name: z
    .string()
    .optional()
    .describe("Optional kernel name (for example python3, python3.11, python3.12)."),
  session_id: z
    .string()
    .optional()
    .describe("Optional existing Jupyter session ID to preserve variable state."),
});

export type SandboxJupyterExecuteInput = z.infer<
  typeof sandboxJupyterExecuteSchema
>;

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

function collectStreamText(outputs: unknown[]): string {
  let combined = "";
  for (const output of outputs) {
    const item = toRecord(output);
    if (item?.output_type !== "stream") continue;
    const text = getString(item, "text");
    if (!text) continue;
    combined += text;
  }
  return combined;
}

function collectError(outputs: unknown[]): {
  ename: string | null;
  evalue: string | null;
  traceback: string[];
} | null {
  for (const output of outputs) {
    const item = toRecord(output);
    if (item?.output_type !== "error") continue;

    const traceback = Array.isArray(item.traceback)
      ? item.traceback.filter((line): line is string => typeof line === "string")
      : [];

    return {
      ename: getString(item, "ename"),
      evalue: getString(item, "evalue"),
      traceback,
    };
  }

  return null;
}

export const sandboxJupyterExecute = tool(
  async ({ code, kernel_name, session_id, timeout }) => {
    try {
      const payload: Record<string, unknown> = { code };
      if (typeof timeout === "number") payload.timeout = timeout;
      if (typeof kernel_name === "string" && kernel_name.trim()) {
        payload.kernel_name = kernel_name;
      }
      if (typeof session_id === "string" && session_id.trim()) {
        payload.session_id = session_id;
      }

      const result = await sandboxPostJson("/v1/jupyter/execute", payload);
      if (!result.ok) {
        return JSON.stringify({
          endpoint: "/v1/jupyter/execute",
          error: normalizeApiError(result),
          kind: "notebook_run",
          success: false,
        });
      }

      const envelope = toRecord(result.data);
      const data = toRecord(envelope?.data);
      const outputs = Array.isArray(data?.outputs) ? data.outputs : [];
      const stream_text = collectStreamText(outputs);
      const error = collectError(outputs);

      const success =
        typeof envelope?.success === "boolean" ? envelope.success : true;

      return JSON.stringify({
        kind: "notebook_run",
        success,
        message: getString(envelope, "message"),
        kernel_name: getString(data, "kernel_name"),
        session_id: getString(data, "session_id"),
        status: getString(data, "status"),
        execution_count: getNumber(data, "execution_count"),
        msg_id: getString(data, "msg_id"),
        code: getString(data, "code") ?? code,
        stream_text,
        error,
        outputs,
      });
    } catch (error) {
      return JSON.stringify({
        endpoint: "/v1/jupyter/execute",
        error: error instanceof Error ? error.message : String(error),
        kind: "notebook_run",
        success: false,
      });
    }
  },
  {
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    schema: sandboxJupyterExecuteSchema,
  },
);
