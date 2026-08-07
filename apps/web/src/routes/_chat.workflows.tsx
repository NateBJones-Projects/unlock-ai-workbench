import {
  blueprintInstallName,
  RUNBOOK_BLUEPRINTS,
  SKILL_BLUEPRINTS,
  SKILLS,
  WORKFLOWS,
  type RunbookBlueprint,
} from "@t3tools/unlock-catalog";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRightIcon, CheckCircle2Icon, ExternalLinkIcon, ShieldCheckIcon } from "lucide-react";

import { Button } from "../components/ui/button";
import { WorkbenchPageShell, WorkbenchSection } from "../components/workbench/WorkbenchPageShell";
import { useWorkbenchLaunch } from "../components/workbench/useWorkbenchLaunch";
import { useProjects } from "../state/entities";

const READY_WORKFLOW_IDS = new Set<string>(WORKFLOWS.map((workflow) => workflow.id));

const SKILL_INSTALL_NAMES = new Map<string, string>([
  ...SKILL_BLUEPRINTS.map((blueprint) => [blueprint.id, blueprintInstallName(blueprint)] as const),
  ...SKILLS.map((skill) => [skill.id, skill.install.name] as const),
]);

function runbookPlanningPrompt(runbook: RunbookBlueprint): string {
  return `Turn this Unlock AI runbook into a safe execution plan for the active workspace and agent provider.

Do not execute the runbook yet. Inspect only enough local project context to identify what is available, then map each link in the chain to an existing skill, a provider-native capability, or a clearly named missing dependency. Define local outputs and proof for every stage. Add explicit human gates before publishing, sending, account changes, purchases, or sensitive-data transmission.

Ask me for the smallest set of missing inputs, then wait. Do not install software or use paid services during this planning step.

<runbook id="${runbook.id}" title="${runbook.title}">
Payoff: ${runbook.payoff}

Description: ${runbook.description}

Chain:
${runbook.chain.map((step, index) => `${index + 1}. ${step}`).join("\n")}
</runbook>`;
}

function WorkflowsRouteView() {
  const projects = useProjects();
  const { defaultProjectRef, launchingId, launchPrompt } = useWorkbenchLaunch();
  const project = defaultProjectRef
    ? projects.find(
        (candidate) =>
          candidate.environmentId === defaultProjectRef.environmentId &&
          candidate.id === defaultProjectRef.projectId,
      )
    : null;

  return (
    <WorkbenchPageShell
      title="Workflows"
      description="Nate's repeatable ways of getting useful work done. Each one arrives with the right sequence, safety boundaries, and definition of done."
      actions={
        <span className="text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          {project ? `Using ${project.title}` : "Runs in your active workspace"}
        </span>
      }
    >
      <div className="mb-7 grid border-y border-border sm:grid-cols-3">
        <Metric
          label="Full library"
          value={String(RUNBOOK_BLUEPRINTS.length)}
          detail="Unlock AI runbooks"
        />
        <Metric
          label="Runnable now"
          value={String(WORKFLOWS.length)}
          detail="Modeled v1 workflows"
        />
        <Metric
          label="External actions"
          value="Human-gated"
          detail="No automatic send or publish"
        />
      </div>

      <WorkbenchSection
        title="Ready in v1"
        description="Claude Code and Codex are verified for prompt launch. OpenCode, Cursor, and Grok adapters are still marked honestly as planned or unsupported."
      >
        <div className="divide-y divide-border border-y border-border">
          {WORKFLOWS.map((workflow, index) => {
            const readyProviders = workflow.providers
              .filter((provider) => provider.status === "ready")
              .map((provider) => (provider.driver === "claudeAgent" ? "Claude Code" : "Codex"));
            return (
              <article key={workflow.id} className="py-7 first:pt-5">
                <div className="grid gap-5 lg:grid-cols-[4rem_minmax(0,1fr)_auto] lg:items-start">
                  <div className="font-mono text-xs text-muted-foreground/60">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl font-black tracking-[-0.02em] text-foreground">
                      {workflow.title}
                    </h2>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                      {workflow.payoff}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
                      <span>{readyProviders.join(" + ")}</span>
                      <span>{workflow.steps.length} steps</span>
                      <span>{workflow.verification.mode} proof</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={launchingId !== null}
                    onClick={() =>
                      void launchPrompt(workflow.id, workflow.launchPrompt, {
                        provenance: {
                          kind: "workflow",
                          catalogId: workflow.id,
                          title: workflow.title,
                          version: workflow.version,
                          strategy: "prepared-prompt",
                        },
                        openRingside: true,
                      })
                    }
                  >
                    {launchingId === workflow.id ? "Opening…" : "Start workflow"}
                    <ArrowRightIcon />
                  </Button>
                </div>

                <details className="group mt-5 border-t border-border/75 pt-4 lg:ml-20">
                  <summary className="cursor-pointer list-none text-xs font-black text-foreground/85 marker:hidden">
                    <span className="group-open:text-[var(--unlock-cyan)]">
                      Inspect the runbook
                    </span>
                    <span className="ml-2 font-normal text-muted-foreground">
                      inputs, steps, permissions, proof
                    </span>
                  </summary>
                  <div className="mt-5 grid gap-7 lg:grid-cols-[minmax(0,1.5fr)_minmax(15rem,0.8fr)]">
                    <ol className="divide-y divide-border border-y border-border">
                      {workflow.steps.map((step, stepIndex) => (
                        <li key={step.id} className="grid gap-2 py-4 sm:grid-cols-[2rem_1fr]">
                          <span className="font-mono text-[10px] text-muted-foreground/60">
                            {stepIndex + 1}
                          </span>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-black text-foreground">{step.title}</h3>
                              {"skillId" in step && step.skillId ? (
                                <code className="text-[10px] text-[var(--unlock-cyan)]">
                                  {SKILL_INSTALL_NAMES.get(step.skillId) ?? step.skillId}
                                </code>
                              ) : null}
                              {"gate" in step && step.gate ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-black tracking-[0.08em] text-warning uppercase">
                                  <ShieldCheckIcon className="size-3" /> Human gate
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              {step.instruction}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>
                    <div className="space-y-5 text-xs leading-5 text-muted-foreground">
                      <div>
                        <h3 className="font-black text-foreground">Bring this</h3>
                        <p className="mt-1">{workflow.inputPrompt}</p>
                      </div>
                      <div>
                        <h3 className="flex items-center gap-1.5 font-black text-foreground">
                          <CheckCircle2Icon className="size-3.5 text-success" /> What proves it
                          worked
                        </h3>
                        <ul className="mt-1 space-y-1">
                          {workflow.verification.checks.map((check) => (
                            <li key={check}>— {check}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h3 className="font-black text-foreground">Hard boundary</h3>
                        <p className="mt-1">
                          External publishing and sending are denied in every v1 workflow. Review
                          comes first.
                        </p>
                      </div>
                    </div>
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      </WorkbenchSection>

      <WorkbenchSection
        title="Runbook library"
        description="The rest of Nate's chains are available as planning blueprints. Workbench maps each one to the active provider and workspace before anything runs."
      >
        <div className="divide-y divide-border border-y border-border">
          {RUNBOOK_BLUEPRINTS.filter((runbook) => !READY_WORKFLOW_IDS.has(runbook.id)).map(
            (runbook, index) => {
              const actionId = `runbook:${runbook.id}`;
              return (
                <article
                  key={runbook.id}
                  className="grid gap-4 py-5 lg:grid-cols-[3rem_minmax(0,1fr)_auto] lg:items-start"
                >
                  <span className="font-mono text-xs text-muted-foreground/60">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-black tracking-[-0.01em] text-foreground">
                        {runbook.title}
                      </h2>
                      <span className="text-[9px] font-black tracking-[0.08em] text-muted-foreground/65 uppercase">
                        Planning blueprint
                      </span>
                    </div>
                    <p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">
                      {runbook.description}
                    </p>
                    <p className="mt-2 text-xs font-black text-foreground/80">
                      Payoff: {runbook.payoff}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-black tracking-[0.06em] text-muted-foreground/65 uppercase">
                      {runbook.chain.map((step, index) => (
                        <span key={step} className="inline-flex items-center gap-3">
                          {index > 0 ? <span aria-hidden="true">→</span> : null}
                          {step}
                        </span>
                      ))}
                    </div>
                    <a
                      href={runbook.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-[10px] font-black text-[var(--unlock-cyan)]"
                    >
                      Open in Unlock AI <ExternalLinkIcon className="size-3" />
                    </a>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={launchingId !== null}
                    onClick={() =>
                      void launchPrompt(actionId, runbookPlanningPrompt(runbook), {
                        provenance: {
                          kind: "workflow",
                          catalogId: runbook.id,
                          title: runbook.title,
                          version: null,
                          strategy: "prepared-prompt",
                        },
                        openRingside: true,
                      })
                    }
                  >
                    {launchingId === actionId ? "Opening…" : "Plan runbook"}
                    <ArrowRightIcon />
                  </Button>
                </article>
              );
            },
          )}
        </div>
      </WorkbenchSection>
    </WorkbenchPageShell>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0 border-b border-border py-4 last:border-b-0 sm:border-r sm:border-b-0 sm:px-5 sm:first:pl-0 sm:last:border-r-0">
      <p className="text-[9px] font-black tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-foreground">{value}</p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

export const Route = createFileRoute("/_chat/workflows")({
  component: WorkflowsRouteView,
});
