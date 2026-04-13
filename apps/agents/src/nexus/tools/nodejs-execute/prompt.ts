export const TOOL_NAME = "sandbox_nodejs_execute";

export const TOOL_DESCRIPTION =
  "Execute JavaScript code through the sandbox runtime /v1/nodejs/execute endpoint. " +
  "Supports stdin and ad-hoc file injection (helper modules, fixtures) into the execution directory before running. " +
  "Each call runs in a fresh, stateless Node.js environment. " +
  "Returns normalized JSON including status, stdout, stderr, exit_code, and structured outputs.";
