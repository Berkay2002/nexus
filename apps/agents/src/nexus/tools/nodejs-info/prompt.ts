export const TOOL_NAME = "sandbox_nodejs_info";

export const TOOL_DESCRIPTION =
  "Fetch Node.js runtime metadata from the sandbox via /v1/nodejs/info. " +
  "Returns node_version, npm_version, supported_languages, runtime_directory, and a description of the executor. " +
  "Use this before running JS to confirm the runtime is healthy and to surface its version to logs.";
