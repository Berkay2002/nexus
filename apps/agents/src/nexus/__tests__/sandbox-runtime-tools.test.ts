import { describe, expect, it } from "vitest";
import {
  sandboxCodeExecute,
  sandboxCodeExecuteSchema,
} from "../tools/code-execute/tool.js";
import {
  sandboxCodeInfo,
  sandboxCodeInfoSchema,
} from "../tools/code-info/tool.js";
import {
  sandboxNodejsExecute,
  sandboxNodejsExecuteSchema,
} from "../tools/nodejs-execute/tool.js";
import {
  sandboxNodejsInfo,
  sandboxNodejsInfoSchema,
} from "../tools/nodejs-info/tool.js";
import {
  sandboxJupyterCreateSession,
  sandboxJupyterCreateSessionSchema,
} from "../tools/jupyter-create-session/tool.js";
import {
  sandboxJupyterExecute,
  sandboxJupyterExecuteSchema,
} from "../tools/jupyter-execute/tool.js";
import {
  sandboxJupyterInfo,
  sandboxJupyterInfoSchema,
} from "../tools/jupyter-info/tool.js";
import {
  sandboxJupyterListSessions,
  sandboxJupyterListSessionsSchema,
} from "../tools/jupyter-list-sessions/tool.js";
import {
  sandboxJupyterDeleteSession,
  sandboxJupyterDeleteSessionSchema,
} from "../tools/jupyter-delete-session/tool.js";
import {
  sandboxBrowserInfo,
  sandboxBrowserInfoSchema,
} from "../tools/browser-info/tool.js";
import {
  sandboxBrowserScreenshot,
  sandboxBrowserScreenshotSchema,
} from "../tools/browser-screenshot/tool.js";
import {
  sandboxBrowserAction,
  sandboxBrowserActionSchema,
} from "../tools/browser-action/tool.js";
import {
  sandboxBrowserConfig,
  sandboxBrowserConfigSchema,
} from "../tools/browser-config/tool.js";
import {
  sandboxMcpListServers,
  sandboxMcpListServersSchema,
} from "../tools/mcp-list-servers/tool.js";
import {
  sandboxMcpListTools,
  sandboxMcpListToolsSchema,
} from "../tools/mcp-list-tools/tool.js";
import {
  sandboxMcpExecuteTool,
  sandboxMcpExecuteToolSchema,
} from "../tools/mcp-execute-tool/tool.js";
import {
  sandboxUtilConvertToMarkdown,
  sandboxUtilConvertToMarkdownSchema,
} from "../tools/util-convert-to-markdown/tool.js";

describe("sandbox runtime tools", () => {
  it("should expose sandbox_code_execute metadata", () => {
    expect(sandboxCodeExecute.name).toBe("sandbox_code_execute");
    expect(sandboxCodeExecute.description).toContain("/v1/code/execute");
    expect(sandboxCodeExecuteSchema).toBeDefined();
  });

  it("should expose sandbox_code_info metadata", () => {
    expect(sandboxCodeInfo.name).toBe("sandbox_code_info");
    expect(sandboxCodeInfo.description).toContain("/v1/code/info");
    expect(sandboxCodeInfoSchema).toBeDefined();
  });

  it("should expose sandbox_nodejs_execute metadata", () => {
    expect(sandboxNodejsExecute.name).toBe("sandbox_nodejs_execute");
    expect(sandboxNodejsExecute.description).toContain("/v1/nodejs/execute");
    expect(sandboxNodejsExecuteSchema).toBeDefined();
  });

  it("should expose sandbox_nodejs_info metadata", () => {
    expect(sandboxNodejsInfo.name).toBe("sandbox_nodejs_info");
    expect(sandboxNodejsInfo.description).toContain("/v1/nodejs/info");
    expect(sandboxNodejsInfoSchema).toBeDefined();
  });

  it("should expose sandbox_jupyter_create_session metadata", () => {
    expect(sandboxJupyterCreateSession.name).toBe(
      "sandbox_jupyter_create_session",
    );
    expect(sandboxJupyterCreateSession.description).toContain(
      "/v1/jupyter/sessions/create",
    );
    expect(sandboxJupyterCreateSessionSchema).toBeDefined();
  });

  it("should expose sandbox_jupyter_execute metadata", () => {
    expect(sandboxJupyterExecute.name).toBe("sandbox_jupyter_execute");
    expect(sandboxJupyterExecute.description).toContain("/v1/jupyter/execute");
    expect(sandboxJupyterExecuteSchema).toBeDefined();
  });

  it("should expose sandbox_jupyter_info metadata", () => {
    expect(sandboxJupyterInfo.name).toBe("sandbox_jupyter_info");
    expect(sandboxJupyterInfo.description).toContain("/v1/jupyter/info");
    expect(sandboxJupyterInfoSchema).toBeDefined();
  });

  it("should expose sandbox_jupyter_list_sessions metadata", () => {
    expect(sandboxJupyterListSessions.name).toBe(
      "sandbox_jupyter_list_sessions",
    );
    expect(sandboxJupyterListSessions.description).toContain(
      "/v1/jupyter/sessions",
    );
    expect(sandboxJupyterListSessionsSchema).toBeDefined();
  });

  it("should expose sandbox_jupyter_delete_session metadata", () => {
    expect(sandboxJupyterDeleteSession.name).toBe(
      "sandbox_jupyter_delete_session",
    );
    expect(sandboxJupyterDeleteSession.description).toContain(
      "/v1/jupyter/sessions/{session_id}",
    );
    expect(sandboxJupyterDeleteSessionSchema).toBeDefined();
  });

  it("should expose sandbox_browser_info metadata", () => {
    expect(sandboxBrowserInfo.name).toBe("sandbox_browser_info");
    expect(sandboxBrowserInfo.description).toContain("/v1/browser/info");
    expect(sandboxBrowserInfoSchema).toBeDefined();
  });

  it("should expose sandbox_browser_screenshot metadata", () => {
    expect(sandboxBrowserScreenshot.name).toBe("sandbox_browser_screenshot");
    expect(sandboxBrowserScreenshot.description).toContain(
      "/v1/browser/screenshot",
    );
    expect(sandboxBrowserScreenshotSchema).toBeDefined();
  });

  it("should expose sandbox_browser_action metadata", () => {
    expect(sandboxBrowserAction.name).toBe("sandbox_browser_action");
    expect(sandboxBrowserAction.description).toContain("/v1/browser/actions");
    expect(sandboxBrowserActionSchema).toBeDefined();
  });

  it("should expose sandbox_browser_config metadata", () => {
    expect(sandboxBrowserConfig.name).toBe("sandbox_browser_config");
    expect(sandboxBrowserConfig.description).toContain("/v1/browser/config");
    expect(sandboxBrowserConfigSchema).toBeDefined();
  });

  it("should expose sandbox_mcp_list_servers metadata", () => {
    expect(sandboxMcpListServers.name).toBe("sandbox_mcp_list_servers");
    expect(sandboxMcpListServers.description).toContain("/v1/mcp/servers");
    expect(sandboxMcpListServersSchema).toBeDefined();
  });

  it("should expose sandbox_mcp_list_tools metadata", () => {
    expect(sandboxMcpListTools.name).toBe("sandbox_mcp_list_tools");
    expect(sandboxMcpListTools.description).toContain(
      "/v1/mcp/{server_name}/tools",
    );
    expect(sandboxMcpListToolsSchema).toBeDefined();
  });

  it("should expose sandbox_mcp_execute_tool metadata", () => {
    expect(sandboxMcpExecuteTool.name).toBe("sandbox_mcp_execute_tool");
    expect(sandboxMcpExecuteTool.description).toContain(
      "/v1/mcp/{server_name}/tools/{tool_name}",
    );
    expect(sandboxMcpExecuteToolSchema).toBeDefined();
  });

  it("should expose sandbox_util_convert_to_markdown metadata", () => {
    expect(sandboxUtilConvertToMarkdown.name).toBe(
      "sandbox_util_convert_to_markdown",
    );
    expect(sandboxUtilConvertToMarkdown.description).toContain(
      "/v1/util/convert_to_markdown",
    );
    expect(sandboxUtilConvertToMarkdownSchema).toBeDefined();
  });
});
