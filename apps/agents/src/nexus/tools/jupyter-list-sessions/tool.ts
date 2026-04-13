import { tool } from "@langchain/core/tools";
import { z } from "zod/v4";
import {
  normalizeApiError,
  sandboxGet,
  toRecord,
} from "../sandbox-runtime-api.js";
import { TOOL_DESCRIPTION, TOOL_NAME } from "./prompt.js";

export const sandboxJupyterListSessionsSchema = z.object({});

export type SandboxJupyterListSessionsInput = z.infer<
  typeof sandboxJupyterListSessionsSchema
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

interface SessionSummary {
  session_id: string;
  kernel_name: string | null;
  last_used: number | null;
  age_seconds: number | null;
}

export const sandboxJupyterListSessions = tool(
  async () => {
    try {
      const result = await sandboxGet("/v1/jupyter/sessions");
      if (!result.ok) {
        return JSON.stringify({
          endpoint: "/v1/jupyter/sessions",
          error: normalizeApiError(result),
          kind: "jupyter_sessions",
          success: false,
        });
      }

      const envelope = toRecord(result.data);
      const data = toRecord(envelope?.data);
      const sessionsRaw = toRecord(data?.sessions) ?? {};
      const sessions: SessionSummary[] = Object.entries(sessionsRaw).map(
        ([sessionId, value]) => {
          const info = toRecord(value);
          return {
            session_id: sessionId,
            kernel_name: getString(info, "kernel_name"),
            last_used: getNumber(info, "last_used"),
            age_seconds: getNumber(info, "age_seconds"),
          };
        },
      );

      const success =
        typeof envelope?.success === "boolean" ? envelope.success : true;

      return JSON.stringify({
        kind: "jupyter_sessions",
        success,
        message: getString(envelope, "message"),
        count: sessions.length,
        sessions,
      });
    } catch (error) {
      return JSON.stringify({
        endpoint: "/v1/jupyter/sessions",
        error: error instanceof Error ? error.message : String(error),
        kind: "jupyter_sessions",
        success: false,
      });
    }
  },
  {
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    schema: sandboxJupyterListSessionsSchema,
  },
);
