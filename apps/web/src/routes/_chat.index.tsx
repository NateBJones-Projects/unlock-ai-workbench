import { useAtomValue } from "@effect/atom-react";
import {
  GUIDE_LINKS,
  RUNBOOK_BLUEPRINTS,
  SKILL_BLUEPRINTS,
  SKILLS,
  WORKFLOWS,
} from "@t3tools/unlock-catalog";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRightIcon, LinkIcon, PlusIcon, SquarePenIcon, WorkflowIcon } from "lucide-react";
import { useCallback } from "react";

import { APP_DISPLAY_NAME } from "../branding";
import { hasCloudPublicConfig } from "../cloud/publicConfig";
import { openCommandPalette } from "../commandPaletteBus";
import { Button } from "../components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "../components/ui/empty";
import { SidebarInset } from "../components/ui/sidebar";
import { WorkbenchPageShell, WorkbenchSection } from "../components/workbench/WorkbenchPageShell";
import { useWorkbenchLaunch } from "../components/workbench/useWorkbenchLaunch";
import { useAllEnvironmentShellsBootstrapped, useProjects } from "../state/entities";
import { useEnvironments } from "../state/environments";
import { primaryServerProvidersAtom } from "../state/server";
import { cn } from "../lib/utils";
import { COLLAPSED_SIDEBAR_TITLEBAR_INSET_CLASS } from "../workspaceTitlebar";

function ChatIndexRouteView() {
  const { authGateState } = Route.useRouteContext();
  const { environments } = useEnvironments();

  if (authGateState.status === "hosted-static" && environments.length === 0) {
    return <HostedStaticOnboardingState />;
  }

  return <WorkbenchHome />;
}

function WorkbenchHome() {
  const navigate = useNavigate();
  const projects = useProjects();
  const providers = useAtomValue(primaryServerProvidersAtom);
  const bootstrapped = useAllEnvironmentShellsBootstrapped();
  const { defaultProjectRef, launchingId, launchBlankThread, launchPrompt } = useWorkbenchLaunch();
  const currentProject = defaultProjectRef
    ? projects.find(
        (project) =>
          project.environmentId === defaultProjectRef.environmentId &&
          project.id === defaultProjectRef.projectId,
      )
    : null;
  const readyProviders = providers.filter(
    (provider) => provider.enabled && provider.installed && provider.status === "ready",
  );
  const openAddProject = useCallback(() => openCommandPalette({ open: "add-project" }), []);
  const openProviderSettings = useCallback(
    () => void navigate({ to: "/settings/providers" }),
    [navigate],
  );

  if (!bootstrapped) return null;

  return (
    <WorkbenchPageShell
      title="Home"
      description="Choose an outcome. Workbench loads Nate's workflow into a real T3 agent thread, using the AI provider you already have."
      actions={
        <Button size="xs" variant="outline" onClick={() => void launchBlankThread()}>
          <SquarePenIcon />
          {launchingId === "blank-thread" ? "Opening…" : "Blank thread"}
        </Button>
      }
    >
      <div className="mb-7 grid border-y border-border sm:grid-cols-3">
        <StatusCell
          label="Workspace"
          value={currentProject?.title ?? "Choose a folder"}
          detail={
            projects.length === 0
              ? "Required before a workflow can run"
              : `${projects.length} available · click to add or switch`
          }
          action={openAddProject}
        />
        <StatusCell
          label="AI providers"
          value={readyProviders.length > 0 ? `${readyProviders.length} ready` : "Setup needed"}
          detail={
            readyProviders.length > 0
              ? readyProviders.map((provider) => provider.displayName).join(", ")
              : "Connect Claude Code or Codex"
          }
          {...(readyProviders.length === 0 ? { action: openProviderSettings } : {})}
        />
        <StatusCell
          label="Nate's library"
          value={`${SKILL_BLUEPRINTS.length} skill blueprints`}
          detail={`${SKILLS.length} verified packs · ${RUNBOOK_BLUEPRINTS.length} runbooks · ${GUIDE_LINKS.length} guides`}
        />
      </div>

      <WorkbenchSection
        title="Start with a result"
        description="Every v1 workflow ends at a reviewable local artifact. Publishing, sending, and account changes remain human decisions."
      >
        <div className="divide-y divide-border border-y border-border">
          {WORKFLOWS.map((workflow) => (
            <article
              key={workflow.id}
              className="grid gap-4 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <WorkflowIcon className="size-4 text-[var(--unlock-cyan)]" />
                  <h3 className="font-black tracking-[-0.01em] text-foreground">
                    {workflow.title}
                  </h3>
                </div>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                  {workflow.payoff}
                </p>
                <p className="mt-2 text-[11px] font-medium tracking-[0.04em] text-muted-foreground/75 uppercase">
                  {workflow.steps.length} steps · {workflow.verification.mode} verification · human
                  gate
                </p>
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
                {launchingId === workflow.id ? "Opening…" : "Start"}
                <ArrowRightIcon />
              </Button>
            </article>
          ))}
        </div>
      </WorkbenchSection>

      <WorkbenchSection title="Explore the system">
        <div className="grid border-y border-border sm:grid-cols-3">
          <HomeLink
            to="/workflows"
            title="Workflows"
            description="See the steps, skills, permissions, and proof before you run anything."
          />
          <HomeLink
            to="/skills"
            title="Skills"
            description={`Search all ${SKILL_BLUEPRINTS.length} blueprints, then install a verified pack or adapt one in a thread.`}
          />
          <HomeLink
            to="/learn"
            title="Learn"
            description="Open the full Unlock AI guides behind the tools and decisions."
          />
        </div>
      </WorkbenchSection>
    </WorkbenchPageShell>
  );
}

function StatusCell({
  label,
  value,
  detail,
  action,
}: {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  readonly action?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!action}
      onClick={action}
      className="min-w-0 border-b border-border px-0 py-4 text-left last:border-b-0 disabled:cursor-default sm:border-r sm:border-b-0 sm:px-5 sm:first:pl-0 sm:last:border-r-0"
    >
      <span className="block text-[9px] font-black tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </span>
      <span className="mt-1 block truncate text-sm font-black text-foreground">{value}</span>
      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{detail}</span>
    </button>
  );
}

function HomeLink({
  to,
  title,
  description,
}: {
  readonly to: "/workflows" | "/skills" | "/learn";
  readonly title: string;
  readonly description: string;
}) {
  return (
    <Link
      to={to}
      className="group min-w-0 border-b border-border py-5 last:border-b-0 sm:border-r sm:border-b-0 sm:px-5 sm:first:pl-0 sm:last:border-r-0"
    >
      <span className="flex items-center justify-between gap-3 font-black text-foreground">
        {title}
        <ArrowRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--unlock-cyan)]" />
      </span>
      <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
    </Link>
  );
}

export const Route = createFileRoute("/_chat/")({
  component: ChatIndexRouteView,
});

function HostedStaticOnboardingState() {
  const cloudEnabled = hasCloudPublicConfig();

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden bg-background">
        <header
          className={cn(
            "border-b border-border px-3 py-2 transition-[padding-left] duration-200 ease-linear motion-reduce:transition-none sm:px-5 sm:py-3",
            COLLAPSED_SIDEBAR_TITLEBAR_INSET_CLASS,
          )}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground md:text-muted-foreground/60">
              {APP_DISPLAY_NAME}
            </span>
          </div>
        </header>

        <Empty className="flex-1">
          <div className="w-full max-w-xl border-y border-border px-8 py-12">
            <EmptyHeader className="max-w-none">
              <div className="mx-auto mb-5 flex size-11 items-center justify-center border border-border bg-background text-muted-foreground">
                <LinkIcon className="size-5" />
              </div>
              <EmptyTitle className="text-foreground text-xl">
                Connect an environment to get started
              </EmptyTitle>
              <EmptyDescription className="mt-2 text-sm leading-relaxed text-muted-foreground/78">
                {cloudEnabled
                  ? "Sign in to T3 Connect to connect a linked environment through its managed tunnel, or add a reachable backend manually."
                  : "Add a reachable backend manually to start working from this browser."}
              </EmptyDescription>
              <div className="mt-6 flex justify-center">
                <Button render={<Link to="/settings/connections" />} size="sm">
                  <PlusIcon className="size-4" />
                  {cloudEnabled ? "Open Connections" : "Add environment"}
                </Button>
              </div>
            </EmptyHeader>
          </div>
        </Empty>
      </div>
    </SidebarInset>
  );
}
