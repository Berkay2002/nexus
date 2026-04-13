export const TOOL_NAME = "sandbox_jupyter_execute";

export const TOOL_DESCRIPTION =
  "Execute Python code via Jupyter at /v1/jupyter/execute. " +
  "Supports optional session_id for persistent kernel state and optional kernel_name/timeout. " +
  "Returns normalized JSON with outputs, status, and traceback details when present.";
