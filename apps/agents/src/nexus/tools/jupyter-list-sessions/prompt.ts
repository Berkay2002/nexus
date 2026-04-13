export const TOOL_NAME = "sandbox_jupyter_list_sessions";

export const TOOL_DESCRIPTION =
  "List all active Jupyter kernel sessions on the sandbox via /v1/jupyter/sessions. " +
  "Returns each session's id, kernel_name, last_used unix timestamp, and age_seconds. " +
  "Use this to find an existing session to reuse instead of creating a new one.";
