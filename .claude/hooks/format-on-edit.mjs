#!/usr/bin/env node
// PostToolUse Write|Edit hook: runs `prettier --write --ignore-unknown` on the
// file Claude just edited. Reads tool payload from stdin.
import { spawnSync } from "node:child_process";

let raw = "";
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  let file;
  try {
    const j = JSON.parse(raw || "{}");
    file = j?.tool_input?.file_path ?? j?.tool_response?.filePath;
  } catch {
    return;
  }
  if (!file) return;

  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  spawnSync(
    npx,
    ["--no-install", "prettier", "--write", "--ignore-unknown", file],
    { stdio: "inherit" },
  );
});
