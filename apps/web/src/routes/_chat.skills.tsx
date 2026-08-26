import {
  blueprintInstallName,
  SKILL_BLUEPRINT_CATEGORIES,
  SKILL_BLUEPRINTS,
  SKILLS,
  V1_SKILL_PROVIDER_COMPATIBILITY,
  type ProviderDriver,
  type SkillManifest,
} from "@t3tools/unlock-catalog";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  CheckIcon,
  DownloadIcon,
  ExternalLinkIcon,
  SearchIcon,
  ShieldIcon,
  SparklesIcon,
  WrenchIcon,
} from "lucide-react";
import { useMemo, useState, type ReactElement } from "react";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { WorkbenchPageShell, WorkbenchSection } from "../components/workbench/WorkbenchPageShell";
import {
  detectedWorkbenchSkills,
  resolveWorkbenchProvider,
} from "../components/workbench/workbenchProvider";
import {
  blueprintSkillSetupPrompt,
  skillUsePrompt,
  verifiedSkillSetupPrompt,
} from "../components/workbench/workbenchPrompts";
import { useWorkbenchLaunch } from "../components/workbench/useWorkbenchLaunch";
import { useProjects, useServerConfigs } from "../state/entities";

const MANIFEST_BY_ID = new Map<string, SkillManifest>(SKILLS.map((skill) => [skill.id, skill]));

const PROVIDER_RUNTIME_NAMES: Record<ProviderDriver, string> = {
  codex: "Codex",
  claudeAgent: "Claude Code",
  opencode: "OpenCode",
  cursor: "Cursor",
  grok: "Grok",
};

const VERIFIED_RUNTIME_NAMES = V1_SKILL_PROVIDER_COMPATIBILITY.filter(
  (provider) => provider.status === "ready",
).map((provider) => PROVIDER_RUNTIME_NAMES[provider.driver]);

function SkillsRouteView() {
  const projects = useProjects();
  const serverConfigs = useServerConfigs();
  const { activeThread, defaultProjectRef, launchingId, launchPrompt } = useWorkbenchLaunch();
  const launchProject = defaultProjectRef
    ? (projects.find(
        (project) =>
          project.environmentId === defaultProjectRef.environmentId &&
          project.id === defaultProjectRef.projectId,
      ) ?? null)
    : null;
  const providerEnvironmentId = activeThread?.environmentId ?? defaultProjectRef?.environmentId;
  const providers = providerEnvironmentId
    ? (serverConfigs.get(providerEnvironmentId)?.providers ?? [])
    : [];
  const preferredProviderInstanceId =
    activeThread?.session?.providerInstanceId ??
    activeThread?.modelSelection.instanceId ??
    launchProject?.defaultModelSelection?.instanceId ??
    null;
  const activeProvider = resolveWorkbenchProvider(providers, preferredProviderInstanceId);
  const detectedSkills = detectedWorkbenchSkills(activeProvider);
  const workbenchSkillsDir = providerEnvironmentId
    ? (serverConfigs.get(providerEnvironmentId)?.workbenchSkillsDir ?? null)
    : null;
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const visibleSkills = useMemo(() => {
    if (normalizedQuery.length === 0) return SKILL_BLUEPRINTS;
    const queryTokens = normalizedQuery.split(/\s+/);
    return SKILL_BLUEPRINTS.filter((skill) => {
      const searchableText = [skill.title, skill.whatItDoes, skill.whyBuildIt, skill.categoryTitle]
        .join(" ")
        .toLowerCase();
      return queryTokens.every((token) => searchableText.includes(token));
    });
  }, [normalizedQuery]);

  return (
    <WorkbenchPageShell
      title="Skills"
      description="The complete Unlock AI skill library, made usable inside a real agent harness. Ten packs carry verified setup, boundaries, and proof; every other skill is available as an interview-led blueprint you can adapt with the active provider."
      actions={
        <span className="text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          {activeProvider
            ? `${detectedSkills.size} detected by ${activeProvider.displayName}`
            : "Choose a ready provider to detect skills"}
        </span>
      }
    >
      <div className="mb-7 grid border-y border-border sm:grid-cols-3">
        <Metric
          label="Complete library"
          value={String(SKILL_BLUEPRINTS.length)}
          detail="Every local Unlock AI blueprint"
        />
        <Metric label="Verified packs" value={String(SKILLS.length)} detail="Hardened for v1" />
        <Metric
          label="Verified runtimes"
          value={String(VERIFIED_RUNTIME_NAMES.length)}
          detail={`${VERIFIED_RUNTIME_NAMES.join(" and ")} native skills`}
        />
      </div>

      <div className="relative mb-8 max-w-xl">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${SKILL_BLUEPRINTS.length} skills`}
          aria-label="Search Unlock AI skills"
          className="pl-9"
        />
      </div>

      {SKILL_BLUEPRINT_CATEGORIES.map((category) => {
        const skills = visibleSkills.filter((skill) => skill.category === category.id);
        if (skills.length === 0) return null;

        return (
          <WorkbenchSection
            key={category.id}
            title={`${category.number} · ${category.title}`}
            description={category.description}
          >
            <div className="divide-y divide-border border-y border-border">
              {skills.map((skill) => {
                const manifest = MANIFEST_BY_ID.get(skill.id);
                const installName = manifest?.install.name ?? blueprintInstallName(skill);
                const installedMeta = detectedSkills.get(installName);
                const installed = installedMeta !== undefined;
                const personalizedLabel = installedMeta?.personalizedAt
                  ? formatPersonalizedLabel(installedMeta.personalizedAt)
                  : null;
                const actionId = `skill:${skill.id}`;
                const setupPrompt = manifest
                  ? verifiedSkillSetupPrompt(manifest, workbenchSkillsDir)
                  : blueprintSkillSetupPrompt(skill, workbenchSkillsDir);

                return (
                  <article key={skill.id} className="py-5">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-black tracking-[-0.01em] text-foreground">
                            {skill.title}
                          </h2>
                          {installed ? (
                            <Status tone="success" icon={<CheckIcon />} label="Installed" />
                          ) : manifest ? (
                            <Status tone="cyan" icon={<ShieldIcon />} label="Verified pack" />
                          ) : (
                            <Status tone="muted" icon={<WrenchIcon />} label="Blueprint" />
                          )}
                          {personalizedLabel ? (
                            <Status tone="cyan" icon={<SparklesIcon />} label={personalizedLabel} />
                          ) : null}
                        </div>
                        <p className="mt-1 max-w-4xl text-sm leading-6 text-muted-foreground">
                          {skill.whatItDoes}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[9px] font-black tracking-[0.07em] text-muted-foreground/65 uppercase">
                          <span>
                            {manifest ? "Codex + Claude Code verified" : "Interview-led setup"}
                          </span>
                          <span>
                            {skill.whatYouNeed.length}{" "}
                            {skill.whatYouNeed.length === 1 ? "setup input" : "setup inputs"}
                          </span>
                          {manifest ? <span>Deny by default</span> : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        {installed ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={launchingId !== null}
                            onClick={() =>
                              void launchPrompt(`${actionId}:use`, skillUsePrompt(installName), {
                                provenance: {
                                  kind: "skill",
                                  catalogId: skill.id,
                                  title: skill.title,
                                  version: manifest?.version ?? null,
                                  strategy: "native-skill",
                                },
                              })
                            }
                          >
                            {launchingId === `${actionId}:use` ? "Opening…" : "Use in thread"}
                            <ArrowRightIcon />
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant={manifest ? "default" : "outline"}
                            disabled={launchingId !== null}
                            onClick={() =>
                              void launchPrompt(actionId, setupPrompt, {
                                provenance: {
                                  kind: "skill",
                                  catalogId: skill.id,
                                  title: skill.title,
                                  version: manifest?.version ?? null,
                                  strategy: "prepared-prompt",
                                },
                              })
                            }
                          >
                            <DownloadIcon />
                            {launchingId === actionId
                              ? "Opening…"
                              : manifest
                                ? "Set up pack"
                                : "Adapt blueprint"}
                          </Button>
                        )}
                      </div>
                    </div>

                    <details className="group mt-3">
                      <summary className="cursor-pointer list-none text-[11px] font-black text-muted-foreground marker:hidden hover:text-[var(--unlock-cyan)]">
                        Why build it · what you need
                      </summary>
                      <div className="mt-3 grid gap-5 border-l border-border pl-4 text-xs leading-5 text-muted-foreground lg:grid-cols-[minmax(0,1.4fr)_minmax(14rem,0.6fr)]">
                        <p>{skill.whyBuildIt}</p>
                        <div>
                          <p className="font-black text-foreground">What you need</p>
                          <ul className="mt-1 space-y-1">
                            {skill.whatYouNeed.map((requirement) => (
                              <li key={requirement}>— {requirement}</li>
                            ))}
                          </ul>
                          <a
                            href={skill.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 inline-flex items-center gap-1 font-black text-[var(--unlock-cyan)]"
                          >
                            Open in Unlock AI <ExternalLinkIcon className="size-3" />
                          </a>
                        </div>
                      </div>
                    </details>
                  </article>
                );
              })}
            </div>
          </WorkbenchSection>
        );
      })}

      {visibleSkills.length === 0 ? (
        <p className="border-y border-border py-8 text-sm text-muted-foreground">
          No skills match “{query}”. Try a job, tool, or category instead.
        </p>
      ) : null}
    </WorkbenchPageShell>
  );
}

/** Renders the `x-unlock-personalized` date as e.g. "Personalized Aug 7". */
function formatPersonalizedLabel(personalizedAt: string): string {
  const parsed = new Date(`${personalizedAt}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "Personalized";
  const sameYear = parsed.getFullYear() === new Date().getFullYear();
  return `Personalized ${parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  })}`;
}

function Status({
  tone,
  icon,
  label,
}: {
  readonly tone: "success" | "cyan" | "muted";
  readonly icon: ReactElement<{ className?: string }>;
  readonly label: string;
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "cyan"
        ? "text-[var(--unlock-cyan)]"
        : "text-muted-foreground/65";
  return (
    <span
      className={`inline-flex items-center gap-1 text-[9px] font-black tracking-[0.08em] uppercase ${color}`}
    >
      <span className="[&>svg]:size-3">{icon}</span> {label}
    </span>
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

export const Route = createFileRoute("/_chat/skills")({
  component: SkillsRouteView,
});
