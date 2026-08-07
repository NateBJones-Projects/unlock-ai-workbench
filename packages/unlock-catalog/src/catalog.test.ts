import { describe, expect, it } from "vite-plus/test";

import { SKILL_BLUEPRINTS } from "./blueprints.ts";
import {
  assertValidCatalog,
  getGuide,
  getSkill,
  getWorkflow,
  UNLOCK_CATALOG,
  validateCatalog,
  validateSkillBlueprints,
} from "./catalog.ts";
import { renderSkillMarkdown } from "./skills.ts";
import type { UnlockCatalog, WorkflowManifest } from "./types.ts";

describe("Unlock AI v1 catalog", () => {
  it("ships the promised v1 inventory", () => {
    expect(UNLOCK_CATALOG.skills).toHaveLength(10);
    expect(UNLOCK_CATALOG.workflows).toHaveLength(3);
    expect(UNLOCK_CATALOG.guides).toHaveLength(20);
  });

  it("passes catalog integrity validation", () => {
    expect(validateCatalog(UNLOCK_CATALOG)).toEqual([]);
    expect(() => assertValidCatalog(UNLOCK_CATALOG)).not.toThrow();
  });

  it("keeps every workflow dependency inside the v1 skill inventory", () => {
    const skillIds = new Set<string>(UNLOCK_CATALOG.skills.map((skill) => skill.id));
    const workflows: readonly WorkflowManifest[] = UNLOCK_CATALOG.workflows;
    const referencedSkills = workflows.flatMap((workflow) =>
      workflow.steps.flatMap((step) => (step.skillId === undefined ? [] : [step.skillId])),
    );

    expect(referencedSkills.every((skillId) => skillIds.has(skillId))).toBe(true);
  });

  it("marks Codex and Claude Code ready without overstating other provider support", () => {
    for (const item of [...UNLOCK_CATALOG.skills, ...UNLOCK_CATALOG.workflows]) {
      expect(item.providers.find((provider) => provider.driver === "codex")?.status).toBe("ready");
      expect(item.providers.find((provider) => provider.driver === "claudeAgent")?.status).toBe(
        "ready",
      );
      expect(item.providers.find((provider) => provider.driver === "opencode")?.status).toBe(
        "planned",
      );
    }
  });

  it("requires explicit review gates before external release", () => {
    const workflows: readonly WorkflowManifest[] = UNLOCK_CATALOG.workflows;
    for (const workflow of workflows) {
      expect(workflow.steps.some((step) => step.gate?.type === "human")).toBe(true);
      expect(
        workflow.permissions.rules.find((rule) => rule.capability === "external.publish")?.decision,
      ).toBe("deny");
    }
  });

  it("renders valid concise SKILL.md content from every manifest", () => {
    for (const skill of UNLOCK_CATALOG.skills) {
      const markdown = renderSkillMarkdown(skill);
      expect(markdown.startsWith("---\nname: ")).toBe(true);
      expect(markdown).toContain('\ndescription: "');
      expect(markdown).toContain("\n## Requirements\n");
      expect(markdown).toContain("\n## Setup\n");
      expect(markdown).toContain("\n## Procedure\n");
      expect(markdown).toContain("\n## Outputs\n");
      expect(markdown).toContain("\n## Boundaries\n");
      expect(markdown).toContain("\n## Verification\n");
      expect(markdown).toContain("Default stance: deny");
      expect(markdown.split("\n").length).toBeLessThan(120);
    }
  });

  it("resolves catalog entries for consuming clients", () => {
    expect(getSkill("token-saver")?.title).toBe("Token Saver");
    expect(getWorkflow("the-research-engine")?.title).toBe("The Research Engine");
    expect(getGuide("open-stack-field-guide")?.href).toContain("unlock-ai.natebjones.com");
    expect(getSkill("not-a-skill")).toBeUndefined();
  });

  it("validates blueprint install names as kebab-case slugs", () => {
    expect(validateSkillBlueprints(SKILL_BLUEPRINTS)).toEqual([]);

    const malformed = SKILL_BLUEPRINTS.slice(0, 1).map((blueprint) => ({
      ...blueprint,
      installName: "Not A Slug",
    }));
    expect(validateSkillBlueprints(malformed)).toEqual([
      {
        path: "blueprints.0.installName",
        message: "Blueprint install names must be lowercase hyphen slugs.",
      },
    ]);
  });

  it("reports duplicate ids in malformed catalogs", () => {
    const malformed = {
      ...UNLOCK_CATALOG,
      skills: [UNLOCK_CATALOG.skills[0], UNLOCK_CATALOG.skills[0]],
    } satisfies UnlockCatalog;

    expect(validateCatalog(malformed)).toContainEqual({
      path: "skills",
      message: "Duplicate skill id current-information-search.",
    });
  });
});
