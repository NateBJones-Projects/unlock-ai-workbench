import { useAtomValue } from "@effect/atom-react";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { useEffect } from "react";

import { useRightPanelStore } from "../../rightPanelStore";
import { ringerEnvironment } from "../../state/ringer";

/**
 * Run ids whose Ringside opening already happened — surfaced by the watcher
 * or claimed by a launcher that opened the panel itself. Module-scoped so a
 * ChatView remount (leave the thread, come back) cannot reopen a panel the
 * user closed mid-run; a full page refresh starts fresh, which is the
 * intended reset.
 */
const surfacedRunIds = new Set<string>();

/** Claim a run so the watcher never opens Ringside for it. */
export function markRingerRunSurfaced(runId: string): void {
  surfacedRunIds.add(runId);
}

/**
 * Surfaces Ringside when a live Ringer run exists for the thread. The
 * Ringside panel itself only mounts once the agents surface is active, so
 * without this watcher a run whose launch didn't open the panel (a project
 * script, the CLI, a launch RPC the client lost) produces no UI signal at
 * all. The events stream opens with a full snapshot, so no separate list
 * query is needed. Each run opens the panel once; closing Ringside during a
 * run stays closed, and finished runs never reopen it.
 */
export function RingsideRunWatcher(props: { readonly threadRef: ScopedThreadRef }) {
  const streamedRuns = useAtomValue(
    ringerEnvironment.events({
      environmentId: props.threadRef.environmentId,
      input: { threadId: props.threadRef.threadId },
    }),
  );
  useEffect(() => {
    if (
      streamedRuns._tag !== "Success" ||
      streamedRuns.value.threadId !== props.threadRef.threadId
    ) {
      return;
    }
    const unseenLiveRuns = streamedRuns.value.runs.filter(
      (run) => run.finishedAt === null && !surfacedRunIds.has(run.runId),
    );
    if (unseenLiveRuns.length === 0) return;
    for (const run of unseenLiveRuns) {
      surfacedRunIds.add(run.runId);
    }
    useRightPanelStore.getState().open(props.threadRef, "agents");
  }, [streamedRuns, props.threadRef]);

  return null;
}
