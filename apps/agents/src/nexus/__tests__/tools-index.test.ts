import { describe, it, expect } from "vitest";
import {
  tavilySearch,
  tavilyExtract,
  tavilyMap,
  generateImage,
  sandboxCodeExecute,
  sandboxCodeInfo,
  sandboxNodejsExecute,
  sandboxNodejsInfo,
  sandboxJupyterCreateSession,
  sandboxJupyterExecute,
  sandboxJupyterInfo,
  sandboxJupyterListSessions,
  sandboxJupyterDeleteSession,
  sandboxBrowserInfo,
  sandboxBrowserScreenshot,
  sandboxBrowserAction,
  sandboxBrowserConfig,
  sandboxUtilConvertToMarkdown,
  mcpToolSearch,
  researchTools,
  creativeTools,
  codeTools,
  browserTools,
  allTools,
} from "../tools/index.js";

describe("tools barrel export", () => {
  it("should export all individual tools", () => {
    expect(tavilySearch).toBeDefined();
    expect(tavilyExtract).toBeDefined();
    expect(tavilyMap).toBeDefined();
    expect(generateImage).toBeDefined();
    expect(sandboxCodeExecute).toBeDefined();
    expect(sandboxCodeInfo).toBeDefined();
    expect(sandboxNodejsExecute).toBeDefined();
    expect(sandboxNodejsInfo).toBeDefined();
    expect(sandboxJupyterCreateSession).toBeDefined();
    expect(sandboxJupyterExecute).toBeDefined();
    expect(sandboxJupyterInfo).toBeDefined();
    expect(sandboxJupyterListSessions).toBeDefined();
    expect(sandboxJupyterDeleteSession).toBeDefined();
    expect(sandboxBrowserInfo).toBeDefined();
    expect(sandboxBrowserScreenshot).toBeDefined();
    expect(sandboxBrowserAction).toBeDefined();
    expect(sandboxBrowserConfig).toBeDefined();
    expect(sandboxUtilConvertToMarkdown).toBeDefined();
    expect(mcpToolSearch).toBeDefined();
  });

  it("should export browserTools group with 4 tools", () => {
    expect(browserTools).toHaveLength(4);
    expect(browserTools.map((t) => t.name)).toEqual([
      "sandbox_browser_info",
      "sandbox_browser_screenshot",
      "sandbox_browser_action",
      "sandbox_browser_config",
    ]);
  });

  it("should export researchTools array with hot-layer + mcp_tool_search", () => {
    expect(researchTools).toHaveLength(10);
    expect(researchTools.map((t) => t.name)).toEqual([
      "tavily_search",
      "tavily_extract",
      "tavily_map",
      "sandbox_util_convert_to_markdown",
      "sandbox_browser_info",
      "sandbox_browser_screenshot",
      "sandbox_browser_action",
      "sandbox_browser_config",
      "sandbox_nodejs_execute",
      "mcp_tool_search",
    ]);
  });

  it("should export creativeTools array with generate_image", () => {
    expect(creativeTools).toHaveLength(1);
    expect(creativeTools[0].name).toBe("generate_image");
  });

  it("should export codeTools array with sandbox runtime + mcp_tool_search", () => {
    expect(codeTools).toHaveLength(10);
    expect(codeTools.map((t) => t.name)).toEqual([
      "sandbox_code_execute",
      "sandbox_code_info",
      "sandbox_nodejs_execute",
      "sandbox_nodejs_info",
      "sandbox_jupyter_create_session",
      "sandbox_jupyter_execute",
      "sandbox_jupyter_info",
      "sandbox_jupyter_list_sessions",
      "sandbox_jupyter_delete_session",
      "mcp_tool_search",
    ]);
  });

  it("should export allTools array with every custom tool", () => {
    expect(allTools).toHaveLength(19);
  });
});
