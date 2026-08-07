import { ProviderInstanceId, type ServerProvider } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { detectedWorkbenchSkillNames, resolveWorkbenchProvider } from "./workbenchProvider";

function provider(
  instanceId: string,
  skills: ReadonlyArray<{ name: string; enabled: boolean }>,
): ServerProvider {
  return {
    instanceId: ProviderInstanceId.make(instanceId),
    displayName: instanceId,
    driver: instanceId.startsWith("claude") ? "claudeAgent" : "codex",
    enabled: true,
    installed: true,
    status: "ready",
    models: [],
    slashCommands: [],
    skills: skills.map((skill) => ({ ...skill, path: `/skills/${skill.name}` })),
  } as unknown as ServerProvider;
}

describe("resolveWorkbenchProvider", () => {
  it("uses the exact active provider instance instead of merging capabilities", () => {
    const codex = provider("codex", [{ name: "research", enabled: true }]);
    const claude = provider("claudeAgent", [{ name: "publish", enabled: true }]);

    const active = resolveWorkbenchProvider(
      [codex, claude],
      ProviderInstanceId.make("claudeAgent"),
    );

    expect(active?.instanceId).toBe("claudeAgent");
    expect([...detectedWorkbenchSkillNames(active)]).toEqual(["publish"]);
  });

  it("does not report disabled skills as installed", () => {
    const active = provider("codex", [
      { name: "enabled-skill", enabled: true },
      { name: "disabled-skill", enabled: false },
    ]);

    expect([...detectedWorkbenchSkillNames(active)]).toEqual(["enabled-skill"]);
  });
});
