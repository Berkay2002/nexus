import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillsDir = resolve(__dirname, "../skills");

function readSkill(name: string): string {
  return readFileSync(resolve(skillsDir, name, "SKILL.md"), "utf-8").replace(
    /\r\n/g,
    "\n",
  );
}

function readFile(name: string, file: string): string {
  return readFileSync(resolve(skillsDir, name, file), "utf-8").replace(
    /\r\n/g,
    "\n",
  );
}

function fileExists(name: string, file: string): boolean {
  return existsSync(resolve(skillsDir, name, file));
}

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      fm[line.slice(0, colonIdx).trim()] = line.slice(colonIdx + 1).trim();
    }
  }
  return fm;
}

const SKILL_NAMES = [
  "deep-research",
  "build-app",
  "generate-image",
  "data-analysis",
  "write-report",
];

describe("Skills content validation", () => {
  for (const name of SKILL_NAMES) {
    describe(name, () => {
      it("should exist as a SKILL.md file", () => {
        expect(() => readSkill(name)).not.toThrow();
      });

      it("should have valid YAML frontmatter with name and description", () => {
        const content = readSkill(name);
        const fm = parseFrontmatter(content);
        expect(fm.name).toBe(name);
        expect(fm.description).toBeDefined();
        expect(fm.description!.length).toBeGreaterThan(0);
      });

      it("should have description under 1024 characters", () => {
        const content = readSkill(name);
        const fm = parseFrontmatter(content);
        expect(fm.description!.length).toBeLessThanOrEqual(1024);
      });

      it("should have content under 10 MB", () => {
        const content = readSkill(name);
        const bytes = new TextEncoder().encode(content).length;
        expect(bytes).toBeLessThan(10 * 1024 * 1024);
      });

      it("should have a body after frontmatter", () => {
        const content = readSkill(name);
        const body = content.replace(/^---\n[\s\S]*?\n---\n*/, "");
        expect(body.trim().length).toBeGreaterThan(100);
      });

      it("should have examples.md with task description templates", () => {
        expect(fileExists(name, "examples.md")).toBe(true);
        const content = readFile(name, "examples.md");
        expect(content.length).toBeGreaterThan(50);
      });

      it("should reference examples.md from SKILL.md", () => {
        const content = readSkill(name);
        expect(content).toContain("examples.md");
      });

      it("should have at least one template file", () => {
        const skill = readSkill(name);
        expect(skill).toContain("templates/");
      });
    });
  }
});

describe("Skill description differentiation", () => {
  it("deep-research and write-report should have clearly different descriptions", () => {
    const drFm = parseFrontmatter(readSkill("deep-research"));
    const wrFm = parseFrontmatter(readSkill("write-report"));
    expect(drFm.description).not.toContain(wrFm.description);
    expect(wrFm.description).not.toContain(drFm.description);
    expect(drFm.description).toBeDefined();
    expect(wrFm.description).toBeDefined();
  });
});
