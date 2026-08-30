import {
  RINGER_WORKBENCH_DIAGNOSTIC_TEMPLATE_ID,
  type EnvironmentId,
  type EditorId,
  type ProjectId,
  type ProjectScript,
  type ResolvedKeybindingsConfig,
  type RingerTemplateId,
  type ThreadId,
} from "@t3tools/contracts";
import { useAtomValue } from "@effect/atom-react";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { scopeProjectRef, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { memo, useCallback, useMemo } from "react";
import GitActionsControl from "../GitActionsControl";
import { type DraftId } from "~/composerDraftStore";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import ProjectScriptsControl, {
  type NewProjectScriptInput,
  type ProjectScriptActionResult,
} from "../ProjectScriptsControl";
import { OpenInPicker } from "./OpenInPicker";
import { usePrimaryEnvironmentId } from "../../state/environments";
import { useT3ProjectFileScripts } from "~/hooks/useT3ProjectFileScripts";
import { ProjectFavicon } from "../ProjectFavicon";
import { cn } from "~/lib/utils";
import { markRingerRunSurfaced } from "../workbench/RingsideRunWatcher";
import { WorkbenchQuickActions } from "../workbench/WorkbenchQuickActions";
import { recordWorkbenchLaunch } from "../workbench/workbenchLaunchStore";
import { useAtomCommand } from "~/state/use-atom-command";
import { ringerEnvironment } from "~/state/ringer";
import { useRightPanelStore } from "~/rightPanelStore";

interface ChatHeaderProps {
  activeThreadEnvironmentId: EnvironmentId;
  activeThreadId: ThreadId;
  draftId?: DraftId;
  activeThreadTitle: string;
  activeProjectId: ProjectId | undefined;
  activeProjectName: string | undefined;
  activeProjectCwd: string | null;
  openInCwd: string | null;
  activeProjectScripts: ReadonlyArray<ProjectScript> | undefined;
  activeProviderName: string | null;
  activeProviderSkillNames: ReadonlyArray<string>;
  preferredScriptId: string | null;
  keybindings: ResolvedKeybindingsConfig;
  availableEditors: ReadonlyArray<EditorId>;
  rightPanelOpen: boolean;
  gitCwd: string | null;
  onNewThreadInProject: () => void;
  onRunProjectScript: (script: ProjectScript) => void;
  onAddProjectScript: (input: NewProjectScriptInput) => Promise<ProjectScriptActionResult>;
  onUpdateProjectScript: (
    scriptId: string,
    input: NewProjectScriptInput,
  ) => Promise<ProjectScriptActionResult>;
  onDeleteProjectScript: (scriptId: string) => Promise<ProjectScriptActionResult>;
}

export function shouldShowOpenInPicker(input: {
  readonly activeProjectName: string | undefined;
  readonly activeThreadEnvironmentId: EnvironmentId;
  readonly primaryEnvironmentId: EnvironmentId | null;
}): boolean {
  return (
    Boolean(input.activeProjectName) &&
    input.primaryEnvironmentId !== null &&
    input.activeThreadEnvironmentId === input.primaryEnvironmentId
  );
}

export const ChatHeader = memo(function ChatHeader({
  activeThreadEnvironmentId,
  activeThreadId,
  draftId,
  activeThreadTitle,
  activeProjectId,
  activeProjectName,
  activeProjectCwd,
  openInCwd,
  activeProjectScripts,
  activeProviderName,
  activeProviderSkillNames,
  preferredScriptId,
  keybindings,
  availableEditors,
  rightPanelOpen,
  gitCwd,
  onNewThreadInProject,
  onRunProjectScript,
  onAddProjectScript,
  onUpdateProjectScript,
  onDeleteProjectScript,
}: ChatHeaderProps) {
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const fileScripts = useT3ProjectFileScripts(
    activeThreadEnvironmentId,
    activeProjectScripts ? activeProjectCwd : null,
  );
  const showOpenInPicker = shouldShowOpenInPicker({
    activeProjectName,
    activeThreadEnvironmentId,
    primaryEnvironmentId,
  });
  const detectedSkillNames = useMemo(
    () => new Set(activeProviderSkillNames),
    [activeProviderSkillNames],
  );
  const threadRef = useMemo(
    () => scopeThreadRef(activeThreadEnvironmentId, activeThreadId),
    [activeThreadEnvironmentId, activeThreadId],
  );
  const ringerCapabilities = useAtomValue(
    ringerEnvironment.capabilities({
      environmentId: activeThreadEnvironmentId,
      input: { threadId: activeThreadId },
    }),
  );
  const launchRinger = useAtomCommand(ringerEnvironment.launch, { reportFailure: false });
  const ringerQuickActionCapability = useMemo(() => {
    if (ringerCapabilities._tag !== "Success") return null;
    if (!ringerCapabilities.value.available) {
      return { available: false as const, reason: ringerCapabilities.value.reason ?? null };
    }
    return {
      available: true as const,
      launch: ringerCapabilities.value.operations.launch,
      templates: ringerCapabilities.value.templates,
    };
  }, [ringerCapabilities]);
  const handleRunRingerQuickAction = useCallback(
    async (templateId: string) => {
      if (templateId !== RINGER_WORKBENCH_DIAGNOSTIC_TEMPLATE_ID) {
        throw new Error("This Ringer template is not approved for Workbench Quick Actions.");
      }
      // Open Ringside before awaiting the launch: the RPC can already be in
      // flight server-side when the client fiber is interrupted (reconnects,
      // registry teardown), and a run with no panel open produces no UI
      // signal at all. Provenance waits for success so a rejected launch
      // leaves no durable "Ringer Readiness Check" chip behind.
      useRightPanelStore.getState().open(threadRef, "agents");
      const result = await launchRinger({
        environmentId: activeThreadEnvironmentId,
        input: { threadId: activeThreadId, templateId: templateId as RingerTemplateId },
      });
      if (result._tag === "Failure") {
        if (isAtomCommandInterrupted(result)) return;
        const error = squashAtomCommandFailure(result);
        throw error instanceof Error ? error : new Error("Ringer did not start.");
      }
      // This launch already opened the panel — claim the run so the watcher
      // cannot reopen Ringside if the user closes it before the run's first
      // stream event arrives.
      markRingerRunSurfaced(result.value.runId);
      recordWorkbenchLaunch(threadRef, {
        kind: "ringer",
        catalogId: templateId,
        title: "Ringer Readiness Check",
        version: "1",
        strategy: "ringer",
      });
    },
    [activeThreadEnvironmentId, activeThreadId, launchRinger, threadRef],
  );
  return (
    <div className="@container/header-actions flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden sm:gap-3">
        {/* The project always leads the header: knowing which project a
            thread lives in is priority zero, and the thread title alone
            doesn't answer it. */}
        {activeProjectName ? (
          <span className="inline-flex shrink-0 items-center gap-2">
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label={`New thread in ${activeProjectName}`}
                    onClick={onNewThreadInProject}
                    className="inline-flex min-w-0 cursor-pointer items-center gap-1.5 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  />
                }
              >
                <ProjectFavicon
                  environmentId={activeThreadEnvironmentId}
                  cwd={activeProjectCwd ?? ""}
                  className="size-3.5"
                />
                <span className="max-w-40 truncate text-sm font-medium">{activeProjectName}</span>
              </TooltipTrigger>
              <TooltipPopup side="top">New thread in {activeProjectName}</TooltipPopup>
            </Tooltip>
            <span aria-hidden className="text-muted-foreground/40">
              /
            </span>
          </span>
        ) : null}
        <Tooltip>
          <TooltipTrigger
            render={
              <h2
                aria-label={activeThreadTitle}
                className="min-w-0 flex-1 truncate text-sm font-medium text-foreground"
              >
                {activeThreadTitle}
              </h2>
            }
          />
          <TooltipPopup side="top">{activeThreadTitle}</TooltipPopup>
        </Tooltip>
      </div>
      <div
        data-chat-header-actions
        className={cn(
          "flex shrink-0 items-center justify-end gap-2 @3xl/header-actions:gap-3",
          rightPanelOpen ? "pr-0" : "pr-16",
        )}
      >
        {activeProjectId && activeProjectScripts ? (
          <WorkbenchQuickActions
            projectRef={scopeProjectRef(activeThreadEnvironmentId, activeProjectId)}
            scripts={activeProjectScripts}
            detectedSkillNames={detectedSkillNames}
            providerName={activeProviderName}
            ringer={ringerQuickActionCapability}
            onRunScript={onRunProjectScript}
            onRunRinger={handleRunRingerQuickAction}
          />
        ) : null}
        {activeProjectScripts && (
          <ProjectScriptsControl
            scripts={activeProjectScripts}
            fileScripts={fileScripts}
            keybindings={keybindings}
            preferredScriptId={preferredScriptId}
            onRunScript={onRunProjectScript}
            onAddScript={onAddProjectScript}
            onUpdateScript={onUpdateProjectScript}
            onDeleteScript={onDeleteProjectScript}
          />
        )}
        {showOpenInPicker && (
          <OpenInPicker
            environmentId={activeThreadEnvironmentId}
            keybindings={keybindings}
            availableEditors={availableEditors}
            openInCwd={openInCwd}
          />
        )}
        {activeProjectName && (
          <GitActionsControl
            gitCwd={gitCwd}
            activeThreadRef={threadRef}
            {...(draftId ? { draftId } : {})}
          />
        )}
      </div>
    </div>
  );
});
