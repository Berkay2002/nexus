export const TOOL_NAME = "sandbox_browser_screenshot";

export const TOOL_DESCRIPTION =
  "Capture a PNG screenshot of the sandbox Chromium browser via /v1/browser/screenshot. " +
  "Returns base64-encoded image bytes plus screen and image dimensions read from response headers " +
  "(x-screen-width/height, x-image-width/height). " +
  "Compute click coordinates against image dimensions, NOT screen dimensions, when feeding sandbox_browser_action.";
