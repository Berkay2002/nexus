import { tool } from "@langchain/core/tools";
import { z } from "zod/v4";
import {
  normalizeApiError,
  sandboxPostJson,
  toRecord,
} from "../sandbox-runtime-api.js";
import { TOOL_DESCRIPTION, TOOL_NAME } from "./prompt.js";

export const sandboxCodeExecuteSchema = z.object({
  language: z
    .enum(["python", "javascript"])
    .describe("Runtime language to execute (python or javascript)"),
  code: z.string().describe("Source code to execute"),
  timeout: z
    .number()
    .int()
    .min(1)
    .max(300)
    .optional()
    .describe("Optional timeout in seconds (1-300)"),
});

export type SandboxCodeExecuteInput = z.infer<typeof sandboxCodeExecuteSchema>;

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

export const sandboxCodeExecute = tool(
  async ({ code, language, timeout }) => {
    try {
      const payload: Record<string, unknown> = { code, language };
      if (typeof timeout === "number") {
        payload.timeout = timeout;
      }

      const result = await sandboxPostJson("/v1/code/execute", payload);
      if (!result.ok) {
        return JSON.stringify({
          endpoint: "/v1/code/execute",
          error: normalizeApiError(result),
          kind: "code_run",
          success: false,
        });
      }

      const envelope = toRecord(result.data);
      const data = toRecord(envelope?.data);
      const outputs = Array.isArray(data?.outputs) ? data.outputs : [];

      const success =
        typeof envelope?.success === "boolean" ? envelope.success : true;

      return JSON.stringify({
        kind: "code_run",
        success,
        message: getString(envelope, "message"),
        language: getString(data, "language") ?? language,
        status: getString(data, "status"),
        code: getString(data, "code") ?? code,
        stdout: getString(data, "stdout"),
        stderr: getString(data, "stderr"),
        exit_code: getNumber(data, "exit_code"),
        outputs,
      });
    } catch (error) {
      return JSON.stringify({
        endpoint: "/v1/code/execute",
        error: error instanceof Error ? error.message : String(error),
        kind: "code_run",
        success: false,
      });
    }
  },
  {
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    schema: sandboxCodeExecuteSchema,
  },
);
