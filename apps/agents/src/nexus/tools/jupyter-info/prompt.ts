export const TOOL_NAME = "sandbox_jupyter_info";

export const TOOL_DESCRIPTION =
  "Fetch Jupyter service metadata from the sandbox via /v1/jupyter/info. " +
  "Returns default_kernel, available_kernels, active_sessions, session_timeout_seconds, and max_sessions. " +
  "Use this to discover supported kernel names and check whether the session pool has capacity.";
