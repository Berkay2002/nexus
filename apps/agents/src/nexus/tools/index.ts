export { tavilySearch, tavilySearchSchema } from "./search/tool.js";
export type { TavilySearchInput } from "./search/tool.js";

export { tavilyExtract, tavilyExtractSchema } from "./extract/tool.js";
export type { TavilyExtractInput } from "./extract/tool.js";

export { tavilyMap, tavilyMapSchema } from "./map/tool.js";
export type { TavilyMapInput } from "./map/tool.js";

export { generateImage, generateImageSchema } from "./generate-image/tool.js";
export type { GenerateImageInput } from "./generate-image/tool.js";

export {
	sandboxCodeExecute,
	sandboxCodeExecuteSchema,
} from "./code-execute/tool.js";
export type { SandboxCodeExecuteInput } from "./code-execute/tool.js";

export { sandboxCodeInfo, sandboxCodeInfoSchema } from "./code-info/tool.js";
export type { SandboxCodeInfoInput } from "./code-info/tool.js";

export {
	sandboxNodejsExecute,
	sandboxNodejsExecuteSchema,
} from "./nodejs-execute/tool.js";
export type { SandboxNodejsExecuteInput } from "./nodejs-execute/tool.js";

export {
	sandboxNodejsInfo,
	sandboxNodejsInfoSchema,
} from "./nodejs-info/tool.js";
export type { SandboxNodejsInfoInput } from "./nodejs-info/tool.js";

export {
	sandboxJupyterCreateSession,
	sandboxJupyterCreateSessionSchema,
} from "./jupyter-create-session/tool.js";
export type { SandboxJupyterCreateSessionInput } from "./jupyter-create-session/tool.js";

export {
	sandboxJupyterExecute,
	sandboxJupyterExecuteSchema,
} from "./jupyter-execute/tool.js";
export type { SandboxJupyterExecuteInput } from "./jupyter-execute/tool.js";

export {
	sandboxJupyterInfo,
	sandboxJupyterInfoSchema,
} from "./jupyter-info/tool.js";
export type { SandboxJupyterInfoInput } from "./jupyter-info/tool.js";

export {
	sandboxJupyterListSessions,
	sandboxJupyterListSessionsSchema,
} from "./jupyter-list-sessions/tool.js";
export type { SandboxJupyterListSessionsInput } from "./jupyter-list-sessions/tool.js";

export {
	sandboxJupyterDeleteSession,
	sandboxJupyterDeleteSessionSchema,
} from "./jupyter-delete-session/tool.js";
export type { SandboxJupyterDeleteSessionInput } from "./jupyter-delete-session/tool.js";

export {
	sandboxBrowserInfo,
	sandboxBrowserInfoSchema,
} from "./browser-info/tool.js";
export type { SandboxBrowserInfoInput } from "./browser-info/tool.js";

export {
	sandboxBrowserScreenshot,
	sandboxBrowserScreenshotSchema,
} from "./browser-screenshot/tool.js";
export type { SandboxBrowserScreenshotInput } from "./browser-screenshot/tool.js";

export {
	sandboxBrowserAction,
	sandboxBrowserActionSchema,
} from "./browser-action/tool.js";
export type { SandboxBrowserActionInput } from "./browser-action/tool.js";

export {
	sandboxBrowserConfig,
	sandboxBrowserConfigSchema,
} from "./browser-config/tool.js";
export type { SandboxBrowserConfigInput } from "./browser-config/tool.js";

export {
	sandboxMcpListServers,
	sandboxMcpListServersSchema,
} from "./mcp-list-servers/tool.js";
export type { SandboxMcpListServersInput } from "./mcp-list-servers/tool.js";

export {
	sandboxMcpListTools,
	sandboxMcpListToolsSchema,
} from "./mcp-list-tools/tool.js";
export type { SandboxMcpListToolsInput } from "./mcp-list-tools/tool.js";

export {
	sandboxMcpExecuteTool,
	sandboxMcpExecuteToolSchema,
} from "./mcp-execute-tool/tool.js";
export type { SandboxMcpExecuteToolInput } from "./mcp-execute-tool/tool.js";

export {
	sandboxUtilConvertToMarkdown,
	sandboxUtilConvertToMarkdownSchema,
} from "./util-convert-to-markdown/tool.js";
export type { SandboxUtilConvertToMarkdownInput } from "./util-convert-to-markdown/tool.js";

import { tavilySearch } from "./search/tool.js";
import { tavilyExtract } from "./extract/tool.js";
import { tavilyMap } from "./map/tool.js";
import { generateImage } from "./generate-image/tool.js";
import { sandboxCodeExecute } from "./code-execute/tool.js";
import { sandboxCodeInfo } from "./code-info/tool.js";
import { sandboxNodejsExecute } from "./nodejs-execute/tool.js";
import { sandboxNodejsInfo } from "./nodejs-info/tool.js";
import { sandboxJupyterCreateSession } from "./jupyter-create-session/tool.js";
import { sandboxJupyterExecute } from "./jupyter-execute/tool.js";
import { sandboxJupyterInfo } from "./jupyter-info/tool.js";
import { sandboxJupyterListSessions } from "./jupyter-list-sessions/tool.js";
import { sandboxJupyterDeleteSession } from "./jupyter-delete-session/tool.js";
import { sandboxBrowserInfo } from "./browser-info/tool.js";
import { sandboxBrowserScreenshot } from "./browser-screenshot/tool.js";
import { sandboxBrowserAction } from "./browser-action/tool.js";
import { sandboxBrowserConfig } from "./browser-config/tool.js";
import { sandboxMcpListServers } from "./mcp-list-servers/tool.js";
import { sandboxMcpListTools } from "./mcp-list-tools/tool.js";
import { sandboxMcpExecuteTool } from "./mcp-execute-tool/tool.js";
import { sandboxUtilConvertToMarkdown } from "./util-convert-to-markdown/tool.js";

/**
 * Browser automation tools — used by both research (visual web automation)
 * and code (UI verification) sub-agents.
 */
export const browserTools = [
	sandboxBrowserInfo,
	sandboxBrowserScreenshot,
	sandboxBrowserAction,
	sandboxBrowserConfig,
] as const;

/**
 * MCP gateway tools — discover and invoke any MCP server registered in the sandbox.
 */
export const mcpTools = [
	sandboxMcpListServers,
	sandboxMcpListTools,
	sandboxMcpExecuteTool,
] as const;

/**
 * Tools for the Research sub-agent.
 * Tavily web search/extract/map plus the sandbox util converter for turning
 * local PDFs/DOCX/HTML into LLM-readable markdown, and the browser stack for
 * live web automation when Tavily is insufficient.
 */
export const researchTools = [
	tavilySearch,
	tavilyExtract,
	tavilyMap,
	sandboxUtilConvertToMarkdown,
	...browserTools,
] as const;

/**
 * Tools for the Creative sub-agent.
 * Includes image generation via Gemini Imagen.
 */
export const creativeTools = [generateImage] as const;

/**
 * Tools for the Code sub-agent.
 * These augment auto-provisioned shell/filesystem tools with the sandbox
 * runtime API: code/nodejs execution, language introspection, Jupyter
 * session management, and the MCP gateway for invoking external tools.
 */
export const codeTools = [
	sandboxCodeExecute,
	sandboxCodeInfo,
	sandboxNodejsExecute,
	sandboxNodejsInfo,
	sandboxJupyterCreateSession,
	sandboxJupyterExecute,
	sandboxJupyterInfo,
	sandboxJupyterListSessions,
	sandboxJupyterDeleteSession,
	...mcpTools,
] as const;

/**
 * All custom tools.
 * Does NOT include auto-provisioned tools (execute, filesystem tools)
 * which come from the DeepAgent backend.
 */
export const allTools = [
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
	sandboxUtilConvertToMarkdown,
	...browserTools,
	...mcpTools,
] as const;
