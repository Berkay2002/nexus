export const TOOL_NAME = "sandbox_browser_info";

export const TOOL_DESCRIPTION =
  "Fetch sandbox Chromium browser metadata via /v1/browser/info. " +
  "Returns user_agent, cdp_url (Chrome DevTools Protocol WebSocket), vnc_url, and viewport dimensions. " +
  "Use this to confirm the browser is up and to retrieve the CDP endpoint for low-level control.";
