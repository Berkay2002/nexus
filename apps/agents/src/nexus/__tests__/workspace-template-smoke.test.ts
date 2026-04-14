import { describe, it, expect } from "vitest";
import {
  getWorkspaceRootForThread,
  renderWorkspaceTemplate,
} from "../backend/workspace.js";
import { RESEARCH_SYSTEM_PROMPT } from "../agents/research/prompt.js";
import { ORCHESTRATOR_SYSTEM_PROMPT } from "../prompts/orchestrator-system.js";
import { buildNexusSkillFiles } from "../skills/index.js";

const THREAD_ID = "019d8d2f-6a82-7ddf-831a-d585b78370e5";
const EXPECTED_ROOT = `/home/gem/workspace/threads/${THREAD_ID}`;

describe("workspaceRoot template substitution end-to-end", () => {
  it("resolves the thread-scoped workspace root", () => {
    expect(getWorkspaceRootForThread(THREAD_ID)).toBe(EXPECTED_ROOT);
  });

  it("renders the research prompt with the threaded workspace path", () => {
    const rendered = renderWorkspaceTemplate(
      RESEARCH_SYSTEM_PROMPT,
      EXPECTED_ROOT,
    );
    expect(rendered).toContain(
      `${EXPECTED_ROOT}/research/task_{id}/`,
    );
    expect(rendered).not.toContain("{workspaceRoot}");
  });

  it("renders the orchestrator prompt with the threaded workspace path", () => {
    const rendered = renderWorkspaceTemplate(
      ORCHESTRATOR_SYSTEM_PROMPT,
      EXPECTED_ROOT,
    );
    expect(rendered).toContain(`${EXPECTED_ROOT}/shared/`);
    expect(rendered).toContain(`${EXPECTED_ROOT}/research/task_{id}/`);
    expect(rendered).toContain(`${EXPECTED_ROOT}/code/task_{id}/`);
    expect(rendered).toContain(`${EXPECTED_ROOT}/creative/task_{id}/`);
    expect(rendered).not.toContain("{workspaceRoot}");
  });

  it("renders skill files with the threaded workspace path", () => {
    const files = buildNexusSkillFiles(EXPECTED_ROOT);

    const deepResearch = (
      files["/skills/deep-research/SKILL.md"].content as string[]
    ).join("\n");
    expect(deepResearch).toContain(`${EXPECTED_ROOT}/research/task_{id}/`);
    expect(deepResearch).toContain(`${EXPECTED_ROOT}/shared/findings.md`);
    expect(deepResearch).not.toContain("{workspaceRoot}");

    const writeReport = (
      files["/skills/write-report/examples.md"].content as string[]
    ).join("\n");
    expect(writeReport).toContain(`${EXPECTED_ROOT}/research/task_{id}/`);
    expect(writeReport).not.toContain("{workspaceRoot}");
  });
});
