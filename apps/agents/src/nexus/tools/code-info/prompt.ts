export const TOOL_NAME = "sandbox_code_info";

export const TOOL_DESCRIPTION =
  "Fetch the list of supported code runtimes from the sandbox via /v1/code/info. " +
  "Returns each language's runtime_version, default_timeout, max_timeout, and a description. " +
  "Use this to discover which Language enum values sandbox_code_execute will accept at runtime.";
