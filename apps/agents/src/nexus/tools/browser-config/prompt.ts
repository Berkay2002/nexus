export const TOOL_NAME = "sandbox_browser_config";

export const TOOL_DESCRIPTION =
  "Reconfigure the sandbox Chromium display resolution via /v1/browser/config. " +
  "Resolution width/height MUST come from the supported list: 1920x1080, 1920x1200, 1680x1050, 1600x1200, " +
  "1400x1050, 1360x768, 1280x1024, 1280x960, 1280x800, 1280x720, 1024x768, 800x600, 640x480. " +
  "Arbitrary dimensions are rejected with a validation error.";
