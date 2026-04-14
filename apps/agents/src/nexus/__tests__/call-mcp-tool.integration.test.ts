import { describe, it, expect, beforeAll } from "vitest";
import { AIOSandboxBackend } from "../backend/aio-sandbox.js";
import {
  ensureSandboxFilesystem,
  __resetBootstrapStateForTests,
} from "../backend/sandbox-bootstrap.js";
import { sandboxNodejsExecute } from "../tools/nodejs-execute/tool.js";

const hasFlag = Boolean(process.env.SANDBOX_INTEGRATION);

describe.skipIf(!hasFlag)("call-mcp-tool integration", () => {
  let sandbox: AIOSandboxBackend;

  beforeAll(async () => {
    __resetBootstrapStateForTests();
    sandbox = new AIOSandboxBackend(
      process.env.SANDBOX_URL ?? "http://localhost:8080",
    );
    const ok = await ensureSandboxFilesystem(sandbox);
    if (!ok) {
      throw new Error(
        "Bootstrap failed — is the sandbox running and does `npm install` work inside the container?",
      );
    }
  }, 120_000);

  it("smoke: sandbox_get_context returns structured metadata", async () => {
    const script = `
      import { sandboxGetContext } from "/home/gem/nexus-servers/sandbox/get_context.js";
      const r = await sandboxGetContext({});
      console.log(JSON.stringify({ ok: true, has_structured: Boolean(r.structuredContent), content_items: r.content?.length ?? 0 }));
    `;
    const raw = await sandboxNodejsExecute.invoke({ code: script, timeout: 60 });
    const result = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('"ok":true');
  }, 120_000);

  it("roundtrip: sandbox_convert_to_markdown accepts an argument and returns content", async () => {
    await sandbox.execute(
      "mkdir -p /home/gem/workspace/it && echo '<h1>Hi</h1><p>para</p>' > /home/gem/workspace/it/hi.html",
    );
    const script = `
      import { sandboxConvertToMarkdown } from "/home/gem/nexus-servers/sandbox/convert_to_markdown.js";
      const r = await sandboxConvertToMarkdown({ path: "/home/gem/workspace/it/hi.html" });
      const text = r.content?.[0]?.text ?? r.structuredContent?.markdown ?? "";
      console.log(text);
    `;
    const raw = await sandboxNodejsExecute.invoke({ code: script, timeout: 60 });
    const result = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));
    expect(result.success).toBe(true);
    expect(result.stdout?.toLowerCase()).toContain("hi");
  }, 120_000);

  it("error path: invalid arguments cause the script to exit non-zero with MCP error text", async () => {
    const script = `
      import { sandboxConvertToMarkdown } from "/home/gem/nexus-servers/sandbox/convert_to_markdown.js";
      try {
        await sandboxConvertToMarkdown({ path: "/tmp/definitely-does-not-exist.html" });
        console.log("UNEXPECTED_SUCCESS");
      } catch (err) {
        console.error("CAUGHT:" + err.message);
        process.exit(2);
      }
    `;
    const raw = await sandboxNodejsExecute.invoke({ code: script, timeout: 60 });
    const result = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));
    const stderr = (result.stderr as string | null) ?? "";
    const stdout = (result.stdout as string | null) ?? "";
    expect(stdout).not.toContain("UNEXPECTED_SUCCESS");
    expect(stderr + stdout).toMatch(/CAUGHT:|error/i);
  }, 120_000);
});
