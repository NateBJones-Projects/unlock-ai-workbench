import { describe, expect, it } from "vite-plus/test";
import { SKILL_BLUEPRINTS, SKILLS } from "@t3tools/unlock-catalog";

import {
  blueprintSkillSetupPrompt,
  resolveWorkbenchSkillsInstallTarget,
  verifiedSkillSetupPrompt,
} from "./workbenchPrompts";

describe("resolveWorkbenchSkillsInstallTarget", () => {
  it("is pending until ServerConfig exists", () => {
    expect(resolveWorkbenchSkillsInstallTarget(undefined)).toEqual({ kind: "pending" });
    expect(resolveWorkbenchSkillsInstallTarget(null)).toEqual({ kind: "pending" });
  });

  it("uses the managed directory when the server advertises it", () => {
    expect(
      resolveWorkbenchSkillsInstallTarget({
        workbenchSkillsDir: " /tmp/workbench/skills/skills ",
      }),
    ).toEqual({ kind: "managed", dir: "/tmp/workbench/skills/skills" });
  });

  it("falls back to legacy only when a loaded config omits the field", () => {
    expect(resolveWorkbenchSkillsInstallTarget({})).toEqual({ kind: "legacy" });
    expect(resolveWorkbenchSkillsInstallTarget({ workbenchSkillsDir: "   " })).toEqual({
      kind: "legacy",
    });
  });
});

describe("skill setup prompts", () => {
  const skill = SKILLS[0]!;
  const blueprint = SKILL_BLUEPRINTS[0]!;
  const managedDir = "/tmp/workbench/userdata/skills/skills";

  it("names the managed path and forbids personal installs", () => {
    const prompt = verifiedSkillSetupPrompt(skill, { kind: "managed", dir: managedDir });
    expect(prompt).toContain(`${managedDir}/${skill.install.name}/SKILL.md`);
    expect(prompt).toContain("Do NOT install into the provider's personal config");
    expect(prompt).toContain("every new session");
    expect(prompt).toContain("remove or rename it");
  });

  it("keeps the legacy native-directory wording for old servers", () => {
    const prompt = verifiedSkillSetupPrompt(skill, { kind: "legacy" });
    expect(prompt).toContain("provider's native skill directory");
    expect(prompt).not.toContain(managedDir);
  });

  it("blueprint prompts share the same install targeting", () => {
    const managed = blueprintSkillSetupPrompt(blueprint, { kind: "managed", dir: managedDir });
    expect(managed).toContain(managedDir);
    expect(managed).toContain("start a new thread");
    const legacy = blueprintSkillSetupPrompt(blueprint, { kind: "legacy" });
    expect(legacy).toContain("provider's native skill directory");
  });
});
