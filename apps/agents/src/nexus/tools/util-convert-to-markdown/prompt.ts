export const TOOL_NAME = "sandbox_util_convert_to_markdown";

export const TOOL_DESCRIPTION =
  "Convert any URI the sandbox can resolve (file://, http(s)://, absolute paths) to Markdown via /v1/util/convert_to_markdown. " +
  "Use this for PDFs, DOCX, HTML, and other rich documents that need to be turned into LLM-readable text. " +
  "For files that exist only on the host, copy them into the sandbox first. Complementary to tavily_extract: " +
  "this runs locally on files inside the container, while tavily_extract fetches live public URLs.";
