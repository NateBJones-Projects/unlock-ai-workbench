import type { ProjectScript } from "@t3tools/contracts";
import type { SkillManifest, WorkflowManifest } from "@t3tools/unlock-catalog";

export const RINGER_READINESS_TEMPLATE_ID = "unlock.workbench-diagnostic.v1";

export type WorkbenchQuickAction =
  | {
      readonly id: `workflow:${string}`;
      readonly kind: "workflow";
      readonly title: string;
      readonly description: string;
      readonly strategyLabel: string;
      readonly searchText: string;
      readonly workflow: WorkflowManifest;
    }
  | {
      readonly id: `skill:${string}`;
      readonly kind: "skill";
      readonly title: string;
      readonly description: string;
      readonly strategyLabel: string;
      readonly searchText: string;
      readonly skill: SkillManifest;
      readonly installed: boolean;
    }
  | {
      readonly id: `shell:${string}`;
      readonly kind: "shell";
      readonly title: string;
      readonly description: string;
      readonly strategyLabel: string;
      readonly searchText: string;
      readonly script: ProjectScript;
    }
  | {
      readonly id: "ringer:readiness-check";
      readonly kind: "ringer";
      readonly title: "Ringer Readiness Check";
      readonly description: string;
      readonly strategyLabel: string;
      readonly searchText: string;
      readonly templateId: typeof RINGER_READINESS_TEMPLATE_ID;
    };

export interface WorkbenchRingerQuickActionCapability {
  readonly launch: boolean;
  readonly templates: ReadonlyArray<{
    readonly id: string;
    readonly executionStrategy: string;
    readonly agentBacked: boolean;
    readonly estimatedAgentCalls: number;
  }>;
}

export function buildWorkbenchQuickActions(input: {
  readonly workflows: ReadonlyArray<WorkflowManifest>;
  readonly skills: ReadonlyArray<SkillManifest>;
  readonly scripts: ReadonlyArray<ProjectScript>;
  readonly detectedSkillNames: ReadonlySet<string>;
  readonly ringer: WorkbenchRingerQuickActionCapability | null;
}): ReadonlyArray<WorkbenchQuickAction> {
  const actions: WorkbenchQuickAction[] = [];

  const readinessTemplate = input.ringer?.templates.find(
    (template) => template.id === RINGER_READINESS_TEMPLATE_ID,
  );
  if (input.ringer?.launch === true && readinessTemplate) {
    const spendLabel = readinessTemplate.agentBacked
      ? `${readinessTemplate.estimatedAgentCalls} estimated AI call${readinessTemplate.estimatedAgentCalls === 1 ? "" : "s"} · provider token costs may apply`
      : "no AI provider/model calls · no provider spend";
    actions.push({
      id: "ringer:readiness-check",
      kind: "ringer",
      title: "Ringer Readiness Check",
      description:
        "Exercises Ringer orchestration, state, proof, and artifact paths with an allowlisted fixture; it is not one of Nate's content workflows.",
      strategyLabel: `Ringer · ${readinessTemplate.executionStrategy} · ${spendLabel}`,
      searchText:
        "ringer readiness diagnostic health check deterministic fixture no provider model token cost spend report",
      templateId: RINGER_READINESS_TEMPLATE_ID,
    });
  }

  for (const workflow of input.workflows) {
    actions.push({
      id: `workflow:${workflow.id}`,
      kind: "workflow",
      title: workflow.title,
      description: workflow.payoff,
      strategyLabel: "Prepare prompt · human-gated · review before execution",
      searchText: [workflow.title, workflow.summary, workflow.payoff, "workflow prompt human gate"]
        .join(" ")
        .toLowerCase(),
      workflow,
    });
  }

  for (const skill of input.skills) {
    const installed = input.detectedSkillNames.has(skill.install.name);
    actions.push({
      id: `skill:${skill.id}`,
      kind: "skill",
      title: installed ? `Use ${skill.title}` : `Set up ${skill.title}`,
      description: skill.summary,
      strategyLabel: installed
        ? "Native provider skill · prepares an invocation"
        : "Setup prompt · no automatic installation",
      searchText: [skill.title, skill.summary, skill.category, ...skill.triggers]
        .join(" ")
        .toLowerCase(),
      skill,
      installed,
    });
  }

  for (const script of input.scripts) {
    actions.push({
      id: `shell:${script.id}`,
      kind: "shell",
      title: script.name,
      description: script.command,
      strategyLabel: "Project action · runs visibly in a thread terminal",
      searchText: [script.name, script.command, "shell project action terminal"]
        .join(" ")
        .toLowerCase(),
      script,
    });
  }

  return actions;
}

export function filterAndOrderWorkbenchQuickActions(
  actions: ReadonlyArray<WorkbenchQuickAction>,
  query: string,
  favoriteIds: ReadonlySet<string>,
): ReadonlyArray<WorkbenchQuickAction> {
  const tokens = query.trim().toLowerCase().split(/\s+/u).filter(Boolean);
  return actions
    .filter((action) => {
      if (tokens.length === 0) return true;
      const haystack =
        `${action.title} ${action.description} ${action.strategyLabel} ${action.searchText}`.toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    })
    .map((action, index) => ({ action, index }))
    .sort((a, b) => {
      const favoriteDelta =
        Number(favoriteIds.has(b.action.id)) - Number(favoriteIds.has(a.action.id));
      return favoriteDelta || a.index - b.index;
    })
    .map(({ action }) => action);
}
