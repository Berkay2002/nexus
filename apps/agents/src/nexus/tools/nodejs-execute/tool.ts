import { tool } from "@langchain/core/tools";
import { z } from "zod/v4";
import {
  normalizeApiError,
  sandboxPostJson,
  toRecord,
} from "../sandbox-runtime-api.js";
import { TOOL_DESCRIPTION, TOOL_NAME } from "./prompt.js";

export const sandboxNodejsExecuteSchema = z.object({
  code: z.string().describe("JavaScript source code to execute via Node.js"),
  timeout: z
    .number()
    .int()
    .min(1)
    .max(300)
    .optional()
    .describe("Optional timeout in seconds (1-300, default 30)"),
  stdin: z
    .string()
    .optional()
    .describe("Optional standard input piped to the Node.js process"),
  files: z
    .array(
      z.object({
        name: z.string().describe("Filename (e.g. 'utils.js')"),
        content: z.string().describe("File contents"),
      }),
    )
    .optional()
    .describe(
      "Optional helper files to create in the execution directory before running.",
    ),
});

export type SandboxNodejsExecuteInput = z.infer<
  typeof sandboxNodejsExecuteSchema
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

export const sandboxNodejsExecute = tool(
  async ({ code, files, stdin, timeout }) => {
    try {
      const payload: Record<string, unknown> = { code };
      if (typeof timeout === "number") payload.timeout = timeout;
      if (typeof stdin === "string") payload.stdin = stdin;
      if (files && files.length > 0) {
        const filesRecord: Record<string, string> = {};
        for (const f of files) filesRecord[f.name] = f.content;
        payload.files = filesRecord;
      }

      const result = await sandboxPostJson("/v1/nodejs/execute", payload);
      if (!result.ok) {
        return JSON.stringify({
          endpoint: "/v1/nodejs/execute",
          error: normalizeApiError(result),
          kind: "nodejs_run",
          success: false,
        });
      }

      const envelope = toRecord(result.data);
      const data = toRecord(envelope?.data);
      const outputs = Array.isArray(data?.outputs) ? data.outputs : [];

      const success =
        typeof envelope?.success === "boolean" ? envelope.success : true;

      return JSON.stringify({
        kind: "nodejs_run",
        success,
        message: getString(envelope, "message"),
        language: getString(data, "language") ?? "javascript",
        status: getString(data, "status"),
        code: getString(data, "code") ?? code,
        stdout: getString(data, "stdout"),
        stderr: getString(data, "stderr"),
        exit_code: getNumber(data, "exit_code"),
        execution_count: getNumber(data, "execution_count"),
        outputs,
      });
    } catch (error) {
      return JSON.stringify({
        endpoint: "/v1/nodejs/execute",
        error: error instanceof Error ? error.message : String(error),
        kind: "nodejs_run",
        success: false,
      });
    }
  },
  {
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    schema: sandboxNodejsExecuteSchema,
  },
);
