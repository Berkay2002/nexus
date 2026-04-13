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
  sandboxMcpListServers,
  sandboxMcpListTools,
  sandboxMcpExecuteTool,
  sandboxUtilConvertToMarkdown,
  researchTools,
  creativeTools,
  codeTools,
  browserTools,
  mcpTools,
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
    expect(sandboxMcpListServers).toBeDefined();
    expect(sandboxMcpListTools).toBeDefined();
    expect(sandboxMcpExecuteTool).toBeDefined();
    expect(sandboxUtilConvertToMarkdown).toBeDefined();
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

  it("should export mcpTools group with 3 tools", () => {
    expect(mcpTools).toHaveLength(3);
    expect(mcpTools.map((t) => t.name)).toEqual([
      "sandbox_mcp_list_servers",
      "sandbox_mcp_list_tools",
      "sandbox_mcp_execute_tool",
    ]);
  });

  it("should export researchTools array with Tavily, util converter, and browser stack", () => {
    expect(researchTools).toHaveLength(8);
    expect(researchTools.map((t) => t.name)).toEqual([
      "tavily_search",
      "tavily_extract",
      "tavily_map",
      "sandbox_util_convert_to_markdown",
      "sandbox_browser_info",
      "sandbox_browser_screenshot",
      "sandbox_browser_action",
      "sandbox_browser_config",
    ]);
  });

  it("should export creativeTools array with generate_image", () => {
    expect(creativeTools).toHaveLength(1);
    expect(creativeTools[0].name).toBe("generate_image");
  });

  it("should export codeTools array with sandbox runtime + MCP tools", () => {
    expect(codeTools).toHaveLength(12);
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
      "sandbox_mcp_list_servers",
      "sandbox_mcp_list_tools",
      "sandbox_mcp_execute_tool",
    ]);
  });

  it("should export allTools array with every custom tool", () => {
    expect(allTools).toHaveLength(21);
  });
});
