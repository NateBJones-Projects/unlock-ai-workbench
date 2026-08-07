import type { ProjectScript } from "@t3tools/contracts";
import { SKILLS, WORKFLOWS } from "@t3tools/unlock-catalog";
import { describe, expect, it } from "vite-plus/test";

import {
  buildWorkbenchQuickActions,
  filterAndOrderWorkbenchQuickActions,
  RINGER_READINESS_TEMPLATE_ID,
} from "./quickActions";

const SCRIPT = {
  id: "test",
  name: "Run tests",
  command: "pnpm test",
  icon: "test",
  runOnWorktreeCreate: false,
} satisfies ProjectScript;

describe("Workbench Quick Actions", () => {
  it("keeps workflow, skill, shell, and Ringer dispatch payloads typed", () => {
    const actions = buildWorkbenchQuickActions({
      workflows: WORKFLOWS.slice(0, 1),
      skills: SKILLS.slice(0, 1),
      scripts: [SCRIPT],
      detectedSkillNames: new Set([SKILLS[0]!.install.name]),
      ringer: {
        available: true,
        launch: true,
        templates: [
          {
            id: RINGER_READINESS_TEMPLATE_ID,
            executionStrategy: "deterministic-diagnostic",
            agentBacked: false,
            estimatedAgentCalls: 0,
          },
        ],
      },
    });

    expect(actions.map((action) => action.kind)).toEqual(["ringer", "workflow", "skill", "shell"]);
    expect(actions.find((action) => action.kind === "workflow")?.strategyLabel).toContain(
      "human-gated",
    );
    expect(actions.find((action) => action.kind === "ringer")?.title).toBe(
      "Ringer Readiness Check",
    );
    expect(actions.find((action) => action.kind === "shell")?.script.id).toBe(SCRIPT.id);
  });

  it("does not expose a Ringer action without the validated template and launch capability", () => {
    const actions = buildWorkbenchQuickActions({
      workflows: WORKFLOWS,
      skills: [],
      scripts: [],
      detectedSkillNames: new Set(),
      ringer: {
        available: true,
        launch: true,
        templates: [
          {
            id: "unreviewed-template",
            executionStrategy: "parallel-agent-swarm",
            agentBacked: true,
            estimatedAgentCalls: 12,
          },
        ],
      },
    });

    expect(actions.some((action) => action.kind === "ringer")).toBe(false);
    expect(actions.every((action) => action.kind === "workflow")).toBe(true);
  });

  it("surfaces an unavailable Ringer row with the server reason and a Python fix", () => {
    const actions = buildWorkbenchQuickActions({
      workflows: [],
      skills: [],
      scripts: [],
      detectedSkillNames: new Set(),
      ringer: {
        available: false,
        reason:
          "Python 3.12 or newer is required. Checked UNLOCK_RINGER_PYTHON, python3.13, python3.12, and python3.",
      },
    });

    const unavailable = actions.find((action) => action.kind === "ringer-unavailable");
    expect(unavailable?.title).toBe("Ringer Readiness Check");
    expect(unavailable?.description).toContain("Python 3.12 or newer is required.");
    expect(unavailable?.description).toContain(
      "Install Python 3.13: brew install python@3.13, then relaunch Workbench.",
    );
    expect(actions.some((action) => action.kind === "ringer")).toBe(false);
  });

  it("keeps non-Python unavailable reasons verbatim without the install fix", () => {
    const actions = buildWorkbenchQuickActions({
      workflows: [],
      skills: [],
      scripts: [],
      detectedSkillNames: new Set(),
      ringer: { available: false, reason: "Ringer is disabled by server policy." },
    });

    const unavailable = actions.find((action) => action.kind === "ringer-unavailable");
    expect(unavailable?.description).toBe("Ringer is disabled by server policy.");
  });

  it("searches strategy metadata and keeps favorites first", () => {
    const actions = buildWorkbenchQuickActions({
      workflows: WORKFLOWS.slice(0, 1),
      skills: SKILLS.slice(0, 1),
      scripts: [SCRIPT],
      detectedSkillNames: new Set(),
      ringer: null,
    });
    const shell = actions.find((action) => action.kind === "shell")!;

    expect(filterAndOrderWorkbenchQuickActions(actions, "terminal", new Set())).toEqual([shell]);
    expect(filterAndOrderWorkbenchQuickActions(actions, "", new Set([shell.id]))[0]).toBe(shell);
  });
});
