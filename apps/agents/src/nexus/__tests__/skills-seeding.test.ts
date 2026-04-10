import { describe, it, expect } from "vitest";
import { nexusSkillFiles, SKILL_NAMES } from "../skills/index.js";

describe("Skills barrel export", () => {
  it("should export a FileData map with all skill files", () => {
    // 5 skills × (SKILL.md + examples.md + at least 1 template) = at least 15 files
    expect(Object.keys(nexusSkillFiles).length).toBeGreaterThanOrEqual(15);
  });

  it("should include SKILL.md for each skill", () => {
    for (const name of SKILL_NAMES) {
      const key = `/skills/${name}/SKILL.md`;
      expect(nexusSkillFiles).toHaveProperty(key);
    }
  });

  it("should include examples.md for each skill", () => {
    for (const name of SKILL_NAMES) {
      const key = `/skills/${name}/examples.md`;
      expect(nexusSkillFiles).toHaveProperty(key);
    }
  });

  it("should have FileData shape with content array, created_at, modified_at", () => {
    for (const name of SKILL_NAMES) {
      const key = `/skills/${name}/SKILL.md`;
      const fileData = nexusSkillFiles[key];
      expect(Array.isArray(fileData.content)).toBe(true);
      expect(fileData.content.length).toBeGreaterThan(0);
      expect(fileData.created_at).toBeDefined();
      expect(fileData.modified_at).toBeDefined();
    }
  });

  it("should export SKILL_NAMES constant with all 5 names", () => {
    expect(SKILL_NAMES).toEqual([
      "deep-research",
      "build-app",
      "generate-image",
      "data-analysis",
      "write-report",
    ]);
  });

  it("should have frontmatter in each SKILL.md content", () => {
    for (const name of SKILL_NAMES) {
      const key = `/skills/${name}/SKILL.md`;
      const content = nexusSkillFiles[key].content.join("\n");
      expect(content).toMatch(/^---\n/);
      expect(content).toContain(`name: ${name}`);
    }
  });
});
