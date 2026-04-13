export const TOOL_NAME = "sandbox_browser_action";

export const TOOL_DESCRIPTION =
  "Dispatch a single mouse, keyboard, or wait action to the sandbox Chromium browser via /v1/browser/actions. " +
  "The action_type discriminator selects which fields are required: " +
  "MOVE_TO/CLICK/DOUBLE_CLICK/RIGHT_CLICK/DRAG_TO use absolute (x,y); MOVE_REL/DRAG_REL use (x_offset,y_offset); " +
  "SCROLL uses (dx,dy); TYPING needs `text`; PRESS/KEY_DOWN/KEY_UP need a single `key`; " +
  "HOTKEY needs a `keys` array; WAIT needs `duration` (seconds). " +
  "Coordinates are in the SCREENSHOT IMAGE pixel space, not browser CSS pixels.";
