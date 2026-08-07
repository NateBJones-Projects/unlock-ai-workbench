import {
  GUIDE_LINKS,
  SKILL_BLUEPRINTS,
  SKILLS,
  WORKFLOWS,
  type GuideCategory,
} from "@t3tools/unlock-catalog";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRightIcon, BookOpenIcon } from "lucide-react";

import { WorkbenchPageShell, WorkbenchSection } from "../components/workbench/WorkbenchPageShell";

const CATEGORY_LABELS: Record<GuideCategory, string> = {
  agents: "Agents and automation",
  codex: "Codex field guide",
  general: "Open stack and practical systems",
};

const CATEGORY_ORDER: readonly GuideCategory[] = ["agents", "codex", "general"];

function LearnRouteView() {
  return (
    <WorkbenchPageShell
      title="Learn"
      description="The published Unlock AI field guides behind this Workbench. Use the product here; open a guide when you want Nate's full explanation, examples, and operating judgment."
      actions={
        <a
          href="https://unlock-ai.natebjones.com"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[10px] font-black tracking-[0.08em] text-muted-foreground uppercase hover:text-[var(--unlock-cyan)]"
        >
          Unlock AI <ArrowUpRightIcon className="size-3" />
        </a>
      }
    >
      <div className="mb-7 grid border-y border-border sm:grid-cols-3">
        <Metric label="Published guides" value={String(GUIDE_LINKS.length)} />
        <Metric label="Skill blueprints" value={String(SKILL_BLUEPRINTS.length)} />
        <Metric label="Runnable workflows" value={String(WORKFLOWS.length)} />
      </div>

      {CATEGORY_ORDER.map((category) => {
        const guides = GUIDE_LINKS.filter((guide) => guide.category === category);
        if (guides.length === 0) return null;

        return (
          <WorkbenchSection
            key={category}
            title={CATEGORY_LABELS[category]}
            description={`${guides.length} published ${guides.length === 1 ? "guide" : "guides"}`}
          >
            <div className="divide-y divide-border border-y border-border">
              {guides.map((guide, index) => {
                const linkedSkills = SKILLS.filter((skill) =>
                  skill.guideIds.some((guideId) => guideId === guide.id),
                );
                const linkedWorkflows = WORKFLOWS.filter((workflow) =>
                  workflow.guideIds.some((guideId) => guideId === guide.id),
                );

                return (
                  <a
                    key={guide.id}
                    href={guide.href}
                    target="_blank"
                    rel="noreferrer"
                    className="group grid gap-3 py-5 sm:grid-cols-[2.25rem_minmax(0,1fr)_auto] sm:items-start"
                  >
                    <span className="pt-0.5 font-mono text-[10px] text-muted-foreground/55">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-start gap-2">
                        <BookOpenIcon className="mt-0.5 size-4 shrink-0 text-[var(--unlock-cyan)]" />
                        <span className="font-black tracking-[-0.01em] text-foreground group-hover:text-[var(--unlock-cyan)]">
                          {guide.title}
                        </span>
                      </span>
                      <span className="mt-1 block max-w-3xl text-sm leading-6 text-muted-foreground">
                        {guide.description}
                      </span>
                      {linkedSkills.length > 0 || linkedWorkflows.length > 0 ? (
                        <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] font-black tracking-[0.07em] text-muted-foreground/65 uppercase">
                          {linkedSkills.length > 0 ? (
                            <span>{linkedSkills.length} connected skills</span>
                          ) : null}
                          {linkedWorkflows.length > 0 ? (
                            <span>{linkedWorkflows.length} connected workflows</span>
                          ) : null}
                        </span>
                      ) : null}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-black tracking-[0.07em] text-muted-foreground uppercase group-hover:text-[var(--unlock-cyan)]">
                      Read <ArrowUpRightIcon className="size-3" />
                    </span>
                  </a>
                );
              })}
            </div>
          </WorkbenchSection>
        );
      })}
    </WorkbenchPageShell>
  );
}

function Metric({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="min-w-0 border-b border-border py-4 last:border-b-0 sm:border-r sm:border-b-0 sm:px-5 sm:first:pl-0 sm:last:border-r-0">
      <p className="text-[9px] font-black tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-foreground">{value}</p>
    </div>
  );
}

export const Route = createFileRoute("/_chat/learn")({
  component: LearnRouteView,
});
