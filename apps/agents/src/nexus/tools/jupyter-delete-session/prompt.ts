export const TOOL_NAME = "sandbox_jupyter_delete_session";

export const TOOL_DESCRIPTION =
  "Tear down a single Jupyter kernel session via DELETE /v1/jupyter/sessions/{session_id}. " +
  "Use this for cleanup once a stateful Python workflow finishes — DO NOT use the bulk delete endpoint, " +
  "since the AIO Sandbox is shared across all Nexus sub-agents.";
