import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative, resolve } from "path";
import { fileURLToPath } from "url";
import type { BaseSandbox, FileUploadResponse } from "deepagents";

const TARGET_ROOT = "/home/gem/nexus-servers";
const MARKER = `${TARGET_ROOT}/.bootstrap-marker`;

let bootstrapPromise: Promise<boolean> | null = null;
let mcpFilesystemReady = false;

export function isMcpFilesystemReady(): boolean {
  return mcpFilesystemReady;
}

/**
 * Test-only: clear the process-level bootstrap state so each test can exercise
 * a fresh state machine. Never call from production code.
 */
export function __resetBootstrapStateForTests(): void {
  bootstrapPromise = null;
  mcpFilesystemReady = false;
}

/**
 * Seed the sandbox filesystem with the MCP wrapper tree at /home/gem/nexus-servers/.
 *
 * Idempotent and dedup'd process-wide. See spec section 3 ("Sandbox bootstrap")
 * for the state machine and failure semantics.
 *
 * The target lives outside /home/gem/workspace/ so per-thread workspace remapping
 * does NOT apply (see backend/workspace.ts). All threads share one physical copy.
 */
export async function ensureSandboxFilesystem(
  sandbox: BaseSandbox,
): Promise<boolean> {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    try {
      const markerCheck = await sandbox.execute(
        `test -f ${MARKER} && echo exists`,
      );
      if (
        markerCheck.exitCode === 0 &&
        typeof markerCheck.output === "string" &&
        markerCheck.output.includes("exists")
      ) {
        mcpFilesystemReady = true;
        return true;
      }

      const staticRoot = resolveStaticAssetRoot();
      const entries = collectStaticTree(staticRoot);
      if (entries.length === 0) {
        console.error(
          `[nexus-bootstrap] static tree at ${staticRoot} is empty. Did the generator run?`,
        );
        mcpFilesystemReady = false;
        return false;
      }

      const uploadResults = await sandbox.uploadFiles(entries);
      const uploadErrors = uploadResults.filter(
        (r): r is FileUploadResponse & { error: NonNullable<FileUploadResponse["error"]> } =>
          r.error !== null,
      );
      if (uploadErrors.length > 0) {
        console.error(
          `[nexus-bootstrap] uploadFiles failed for ${uploadErrors.length} path(s):`,
          uploadErrors.map((e) => `${e.path}: ${e.error}`).join(", "),
        );
        mcpFilesystemReady = false;
        return false;
      }

      const install = await sandbox.execute(
        `cd ${TARGET_ROOT} && npm install 2>&1`,
      );
      if (install.exitCode !== 0) {
        console.error(
          `[nexus-bootstrap] npm install failed (exit ${install.exitCode}):\n${install.output}`,
        );
        mcpFilesystemReady = false;
        return false;
      }

      const markerWrite = await sandbox.execute(
        `date -u +%Y-%m-%dT%H:%M:%SZ > ${MARKER}`,
      );
      if (markerWrite.exitCode !== 0) {
        console.error(
          `[nexus-bootstrap] failed to write marker:\n${markerWrite.output}`,
        );
        mcpFilesystemReady = false;
        return false;
      }

      mcpFilesystemReady = true;
      return true;
    } catch (err) {
      console.error(`[nexus-bootstrap] unexpected error:`, err);
      mcpFilesystemReady = false;
      return false;
    }
  })();

  const outcome = await bootstrapPromise;
  // If the attempt failed, clear the cached promise so the next call retries.
  if (!outcome) {
    bootstrapPromise = null;
  }
  return outcome;
}

/**
 * Resolve the host-side static asset root at apps/agents/sandbox-files/servers/
 * from the location of THIS module (backend/sandbox-bootstrap.ts).
 *
 * Layout:  apps/agents/src/nexus/backend/sandbox-bootstrap.ts
 * Target:  apps/agents/sandbox-files/servers/
 *
 * Four directory hops: backend/ → nexus/ → src/ → agents/, then down.
 * Under vitest and under built dist/ the relative layout is the same because
 * the dist directory mirrors src/nexus/... one level down from apps/agents/.
 */
function resolveStaticAssetRoot(): string {
  const here = fileURLToPath(import.meta.url);
  // here = .../apps/agents/{src|dist}/nexus/backend/sandbox-bootstrap.{ts|js}
  return resolve(here, "..", "..", "..", "..", "sandbox-files", "servers");
}

function collectStaticTree(root: string): Array<[string, Uint8Array]> {
  const out: Array<[string, Uint8Array]> = [];
  walk(root, (absPath) => {
    const rel = relative(root, absPath).split("\\").join("/");
    // Skip gitkeep placeholders — they have no runtime purpose.
    if (rel.endsWith(".gitkeep")) return;
    const bytes = readFileSync(absPath);
    out.push([`${TARGET_ROOT}/${rel}`, new Uint8Array(bytes)]);
  });
  return out;
}

function walk(dir: string, onFile: (absPath: string) => void): void {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      walk(abs, onFile);
    } else {
      onFile(abs);
    }
  }
}
