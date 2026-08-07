import { useAtomValue } from "@effect/atom-react";
import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import type {
  AgentPanelModel,
  AgentPanelWorkflowGroup,
} from "@t3tools/client-runtime/state/subagentRuntime";
import type { RingerRunId, RingerRunProjection, ScopedThreadRef } from "@t3tools/contracts";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { RadioTower } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { AgentsPanel } from "../AgentsPanel";
import { stackedThreadToast, toastManager } from "../ui/toast";
import { ringerEnvironment } from "../../state/ringer";
import { useAtomCommand } from "../../state/use-atom-command";
import { RingerRunsPanel } from "./RingerRunsPanel";
import {
  applyRingerThreadEvent,
  syncRingerThreadRuns,
  replaceRingerRun,
  selectCancelableRingerRun,
  selectRingerRunsForThread,
} from "./ringerPanelModel";
import { selectWorkbenchLaunchProvenance, useWorkbenchLaunchStore } from "./workbenchLaunchStore";

function strategyLabel(strategy: string): string {
  if (strategy === "prepared-prompt") return "Prepared prompt";
  if (strategy === "native-skill") return "Native skill";
  if (strategy === "project-shell") return "Project Action";
  if (strategy === "ringer") return "Ringer";
  return strategy;
}

/**
 * Unlock AI's product shell over T3 Code's source-neutral agent monitor. The
 * underlying right-panel surface remains `agents`, so T3 upstream behavior,
 * thread isolation, native Claude/Codex telemetry, and remote clients stay
 * intact while the Workbench can add Ringer-specific controls incrementally.
 */
export function WorkbenchRingsidePanel(props: {
  readonly model: AgentPanelModel;
  readonly threadRef: ScopedThreadRef;
  readonly threadHasSentTurns?: boolean;
  readonly stopping?: boolean;
  readonly onStopActiveWork?: () => void | Promise<void>;
  readonly onOpenArtifact?: (relativePath: string) => void;
}) {
  const provenance = useWorkbenchLaunchStore((state) =>
    selectWorkbenchLaunchProvenance(state.byThreadKey, props.threadRef),
  );
  const listRunsResult = useAtomValue(
    ringerEnvironment.listRuns({
      environmentId: props.threadRef.environmentId,
      input: { threadId: props.threadRef.threadId },
    }),
  );
  const runEventResult = useAtomValue(
    ringerEnvironment.events({
      environmentId: props.threadRef.environmentId,
      input: { threadId: props.threadRef.threadId },
    }),
  );
  const cancelRingerRun = useAtomCommand(ringerEnvironment.cancel, { reportFailure: false });
  const threadKey = scopedThreadKey(props.threadRef);
  const [ringerRunsByThread, setRingerRunsByThread] = useState<
    Readonly<Record<string, ReadonlyArray<RingerRunProjection>>>
  >({});
  const [stoppingRingerRunIdByThread, setStoppingRingerRunIdByThread] = useState<
    Readonly<Record<string, RingerRunId | null>>
  >({});
  const updateRingerRuns = useCallback(
    (
      update: (current: ReadonlyArray<RingerRunProjection>) => ReadonlyArray<RingerRunProjection>,
    ) => {
      setRingerRunsByThread((current) => ({
        ...current,
        [threadKey]: update(current[threadKey] ?? []),
      }));
    },
    [threadKey],
  );
  const ringerRuns = selectRingerRunsForThread(
    ringerRunsByThread[threadKey] ?? [],
    props.threadRef,
  );
  const stoppingRingerRunId = stoppingRingerRunIdByThread[threadKey] ?? null;

  useEffect(() => {
    if (
      listRunsResult._tag !== "Success" ||
      listRunsResult.value.threadId !== props.threadRef.threadId
    ) {
      return;
    }
    updateRingerRuns((current) =>
      applyRingerThreadEvent(current, {
        // A live event may beat the initial list response. Treat the list as
        // upserts so an older revision cannot clobber fresher streamed state.
        type: current.length === 0 ? "snapshot" : "upsert",
        threadId: listRunsResult.value.threadId,
        runs: listRunsResult.value.runs,
      }),
    );
  }, [listRunsResult, props.threadRef.threadId, updateRingerRuns]);
  useEffect(() => {
    if (
      runEventResult._tag !== "Success" ||
      runEventResult.value.threadId !== props.threadRef.threadId
    ) {
      return;
    }
    updateRingerRuns((current) => syncRingerThreadRuns(current, runEventResult.value.runs));
  }, [props.threadRef.threadId, runEventResult, updateRingerRuns]);

  const handleCancelRingerRun = useCallback(
    async (runId: RingerRunId) => {
      // Validate the requested run against this exact thread projection before
      // issuing a scoped command. UI labels never become authority.
      const run = selectCancelableRingerRun(ringerRuns, props.threadRef.threadId, runId);
      if (!run) return;
      setStoppingRingerRunIdByThread((current) => ({ ...current, [threadKey]: runId }));
      const result = await cancelRingerRun({
        environmentId: props.threadRef.environmentId,
        input: { threadId: props.threadRef.threadId, runId },
      });
      if (result._tag === "Success") {
        updateRingerRuns((current) => replaceRingerRun(current, result.value));
      } else if (!isAtomCommandInterrupted(result)) {
        const error = squashAtomCommandFailure(result);
        toastManager.add(
          stackedThreadToast({
            type: "error",
            title: "Could not stop this Ringer run",
            description: error instanceof Error ? error.message : "An unexpected error occurred.",
          }),
        );
      }
      setStoppingRingerRunIdByThread((current) => ({ ...current, [threadKey]: null }));
    },
    [
      cancelRingerRun,
      props.threadRef.environmentId,
      props.threadRef.threadId,
      ringerRuns,
      threadKey,
      updateRingerRuns,
    ],
  );

  const stopWorkflow = props.onStopActiveWork
    ? (_group: AgentPanelWorkflowGroup) => props.onStopActiveWork?.()
    : undefined;

  // Empty-state copy depends on whether the prepared prompt has been sent yet.
  const preparedByComposer =
    provenance !== null &&
    (provenance.strategy === "prepared-prompt" || provenance.strategy === "native-skill");
  const emptyPresentation =
    preparedByComposer && props.threadHasSentTurns !== true
      ? {
          emptyTitle: "Ready at Ringside",
          emptyDescription: "This workflow starts when you press Send.",
        }
      : preparedByComposer
        ? {
            emptyTitle: "Running in the conversation",
            emptyDescription:
              "The work is running in the conversation — this panel tracks parallel agent workers; the main thread streams in the transcript.",
          }
        : {
            emptyTitle: "No agent activity yet",
            emptyDescription:
              "Start a Ringer run, workflow, or provider-native subagent to monitor it here.",
          };

  return (
    <div className="flex h-full min-h-0 flex-col" data-workbench-ringside>
      <header className="shrink-0 border-b border-border/60 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-[var(--unlock-cyan)]/30 bg-[var(--unlock-cyan)]/10 text-[var(--unlock-cyan)]">
            <RadioTower aria-hidden className="size-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <h2 className="text-sm font-black tracking-[-0.01em]">Ringside</h2>
              <span className="text-[8px] font-black tracking-[0.11em] text-muted-foreground/65 uppercase">
                Unlock AI · powered by T3 Code
              </span>
            </div>
            <p className="hidden truncate text-[10px] text-muted-foreground sm:block">
              Thread-scoped operations for Ringer runs and provider-native agents.
            </p>
          </div>
        </div>
        {provenance ? (
          <div className="mt-2 flex min-w-0 items-center gap-2 border-l-2 border-[var(--unlock-cyan)]/50 pl-2 text-[10px]">
            <span className="shrink-0 font-black tracking-[0.08em] text-[var(--unlock-cyan)] uppercase">
              {strategyLabel(provenance.strategy)}
            </span>
            <span className="truncate font-medium text-foreground">{provenance.title}</span>
            {provenance.version ? (
              <span className="shrink-0 font-mono text-muted-foreground">
                v{provenance.version}
              </span>
            ) : null}
          </div>
        ) : null}
      </header>
      <div className="min-h-0 flex-1">
        <AgentsPanel
          model={props.model}
          environmentId={props.threadRef.environmentId}
          threadId={props.threadRef.threadId}
          presentation={{
            emptyTitle: emptyPresentation.emptyTitle,
            emptyDescription: emptyPresentation.emptyDescription,
            workflowSectionLabel: "Provider workflow runs",
            directAgentsLabel: "Native agents",
            showWorkerEvidence: true,
            stopScope: "thread",
          }}
          controls={{
            stoppingAll: props.stopping === true,
            ...(stopWorkflow ? { onStopWorkflow: stopWorkflow } : {}),
            ...(props.onOpenArtifact ? { onOpenArtifact: props.onOpenArtifact } : {}),
          }}
          leadingContent={
            ringerRuns.length > 0 ? (
              <RingerRunsPanel
                threadRef={props.threadRef}
                runs={ringerRuns}
                stoppingRunId={stoppingRingerRunId}
                onCancel={handleCancelRingerRun}
              />
            ) : null
          }
        />
      </div>
    </div>
  );
}
