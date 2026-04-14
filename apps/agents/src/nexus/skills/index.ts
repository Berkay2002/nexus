import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { resolve, dirname, relative } from "path";
import { fileURLToPath } from "url";
import type { FileData } from "deepagents";
import {
  DEFAULT_WORKSPACE_ROOT,
  renderWorkspaceTemplate,
} from "../backend/workspace.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const SKILL_NAMES = [
  "deep-research",
  "build-app",
  "generate-image",
  "data-analysis",
  "write-report",
  "using-mcp-tools",
] as const;

function createFileData(content: string): FileData {
  const now = new Date().toISOString();
  return {
    content: content.replace(/\r\n/g, "\n").split("\n"),
    created_at: now,
    modified_at: now,
  };
}

/**
 * Recursively collect all files in a skill directory and return
 * them as a map of virtual POSIX paths to FileData. Any `{workspaceRoot}`
 * placeholders in file contents are substituted with `workspaceRoot` so
 * skill playbooks and templates reference the thread-scoped absolute path.
 */
function collectSkillFiles(
  skillName: string,
  workspaceRoot: string,
): Record<string, FileData> {
  const skillDir = resolve(__dirname, skillName);
  const files: Record<string, FileData> = {};

  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const fullPath = resolve(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else {
        const relPath = relative(skillDir, fullPath).split("\\").join("/");
        const virtualPath = `/skills/${skillName}/${relPath}`;
        const rawContent = readFileSync(fullPath, "utf-8");
        const rendered = renderWorkspaceTemplate(rawContent, workspaceRoot);
        files[virtualPath] = createFileData(rendered);
      }
    }
  }

  if (existsSync(skillDir)) {
    walk(skillDir);
  }
  return files;
}

/**
 * Build the Nexus skill files FileData map for a given thread-scoped
 * `workspaceRoot`. Ready to seed via `orchestrator.invoke({ files })`.
 *
 * Includes SKILL.md, examples.md, and all template files for each skill.
 * Virtual paths match what the orchestrator expects under /skills/.
 */
export function buildNexusSkillFiles(
  workspaceRoot: string = DEFAULT_WORKSPACE_ROOT,
): Record<string, FileData> {
  return Object.assign(
    {},
    ...SKILL_NAMES.map((name) => collectSkillFiles(name, workspaceRoot)),
  );
}

/**
 * Back-compat eager export using DEFAULT_WORKSPACE_ROOT. Retained so the
 * existing test suite keeps working without changes. Runtime callers should
 * prefer `buildNexusSkillFiles(workspaceRoot)` so skill templates resolve to
 * the thread's real filesystem path.
 */
export const nexusSkillFiles: Record<string, FileData> = buildNexusSkillFiles();
