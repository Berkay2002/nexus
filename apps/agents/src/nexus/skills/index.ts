import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { resolve, dirname, relative } from "path";
import { fileURLToPath } from "url";
import type { FileData } from "deepagents";

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
 * them as a map of virtual POSIX paths to FileData.
 */
function collectSkillFiles(
  skillName: string,
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
        const content = readFileSync(fullPath, "utf-8");
        files[virtualPath] = createFileData(content);
      }
    }
  }

  if (existsSync(skillDir)) {
    walk(skillDir);
  }
  return files;
}

/**
 * All Nexus skill files as a FileData map keyed by virtual POSIX path.
 * Ready to seed into a StoreBackend or pass via invoke({ files }).
 *
 * Includes SKILL.md, examples.md, and all template files for each skill.
 * Virtual paths match what the orchestrator expects under /skills/.
 */
export const nexusSkillFiles: Record<string, FileData> = Object.assign(
  {},
  ...SKILL_NAMES.map((name) => collectSkillFiles(name)),
);
