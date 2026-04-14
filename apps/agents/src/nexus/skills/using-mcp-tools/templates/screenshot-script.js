// Template for taking a screenshot via the cold-layer chrome_devtools wrapper.
// Copy-paste and adapt the URL and output path to the task.

import { chromeDevtoolsNavigate } from "/home/gem/nexus-servers/chrome_devtools/navigate.js";
import { chromeDevtoolsTakeScreenshot } from "/home/gem/nexus-servers/chrome_devtools/take_screenshot.js";

const targetUrl = "https://example.com";

await chromeDevtoolsNavigate({ url: targetUrl, wait_until: "networkidle" });
const shot = await chromeDevtoolsTakeScreenshot({ full_page: true });

// Print only the structured fields — the raw base64 bytes must not reach the
// model context.
const payload = {
  url: targetUrl,
  kind: "screenshot",
  structured: shot.structuredContent ?? null,
};
console.log(JSON.stringify(payload));
