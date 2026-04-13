import { tool } from "@langchain/core/tools";
import { z } from "zod/v4";
import {
  normalizeApiError,
  sandboxPostJson,
  toRecord,
} from "../sandbox-runtime-api.js";
import { TOOL_DESCRIPTION, TOOL_NAME } from "./prompt.js";

const ACTION_TYPES = [
  "MOVE_TO",
  "MOVE_REL",
  "CLICK",
  "DOUBLE_CLICK",
  "RIGHT_CLICK",
  "MOUSE_DOWN",
  "MOUSE_UP",
  "DRAG_TO",
  "DRAG_REL",
  "SCROLL",
  "TYPING",
  "PRESS",
  "KEY_DOWN",
  "KEY_UP",
  "HOTKEY",
  "WAIT",
] as const;

const MOUSE_BUTTONS = ["left", "right", "middle"] as const;

export const sandboxBrowserActionSchema = z.object({
  action_type: z
    .enum(ACTION_TYPES)
    .describe("Discriminator selecting which action variant to dispatch"),
  x: z.number().int().optional().describe("Absolute X coordinate (image pixels)"),
  y: z.number().int().optional().describe("Absolute Y coordinate (image pixels)"),
  x_offset: z
    .number()
    .int()
    .optional()
    .describe("Relative X offset for MOVE_REL/DRAG_REL"),
  y_offset: z
    .number()
    .int()
    .optional()
    .describe("Relative Y offset for MOVE_REL/DRAG_REL"),
  dx: z.number().int().optional().describe("Horizontal scroll delta for SCROLL"),
  dy: z.number().int().optional().describe("Vertical scroll delta for SCROLL"),
  button: z
    .enum(MOUSE_BUTTONS)
    .optional()
    .describe("Mouse button for CLICK/MOUSE_DOWN/MOUSE_UP (default: left)"),
  num_clicks: z
    .number()
    .int()
    .min(1)
    .max(3)
    .optional()
    .describe("Click count for CLICK (1, 2, or 3)"),
  text: z
    .string()
    .optional()
    .describe("Text payload for TYPING action"),
  use_clipboard: z
    .boolean()
    .optional()
    .describe(
      "When true (default) TYPING goes via clipboard for special-character safety",
    ),
  key: z
    .string()
    .optional()
    .describe("Single key name for PRESS/KEY_DOWN/KEY_UP (e.g. 'Return', 'Tab')"),
  keys: z
    .array(z.string())
    .optional()
    .describe(
      "Key names for HOTKEY chord (e.g. ['ctrl','c']). Use PRESS instead for single keys.",
    ),
  duration: z
    .number()
    .optional()
    .describe("Pause duration in seconds for WAIT action"),
});

export type SandboxBrowserActionInput = z.infer<
  typeof sandboxBrowserActionSchema
>;

function getString(
  record: Record<string, unknown> | null,
  key: string,
): string | null {
  const value = record?.[key];
  return typeof value === "string" ? value : null;
}

function buildPayload(input: SandboxBrowserActionInput): Record<string, unknown> {
  const payload: Record<string, unknown> = { action_type: input.action_type };

  for (const key of [
    "x",
    "y",
    "x_offset",
    "y_offset",
    "dx",
    "dy",
    "button",
    "num_clicks",
    "text",
    "use_clipboard",
    "key",
    "keys",
    "duration",
  ] as const) {
    const value = input[key];
    if (value !== undefined) {
      payload[key] = value;
    }
  }

  return payload;
}

export const sandboxBrowserAction = tool(
  async (input) => {
    try {
      const payload = buildPayload(input);
      const result = await sandboxPostJson("/v1/browser/actions", payload);
      if (!result.ok) {
        return JSON.stringify({
          endpoint: "/v1/browser/actions",
          error: normalizeApiError(result),
          kind: "browser_action",
          action_type: input.action_type,
          success: false,
        });
      }

      const envelope = toRecord(result.data);
      const data = toRecord(envelope?.data) ?? envelope;
      const success =
        typeof envelope?.success === "boolean" ? envelope.success : true;

      return JSON.stringify({
        kind: "browser_action",
        success,
        action_type: input.action_type,
        message: getString(envelope, "message"),
        status: getString(data, "status"),
        action_performed: getString(data, "action_performed"),
      });
    } catch (error) {
      return JSON.stringify({
        endpoint: "/v1/browser/actions",
        error: error instanceof Error ? error.message : String(error),
        kind: "browser_action",
        action_type: input.action_type,
        success: false,
      });
    }
  },
  {
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    schema: sandboxBrowserActionSchema,
  },
);
