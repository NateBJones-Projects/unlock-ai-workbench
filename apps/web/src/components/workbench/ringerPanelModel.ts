import type {
  RingerArtifactDescriptor,
  RingerRunId,
  RingerRunProjection,
  RingerThreadEvent,
  ScopedThreadRef,
  ThreadId,
} from "@t3tools/contracts";

export function ringerRunIsLive(run: RingerRunProjection): boolean {
  return run.status === "queued" || run.status === "running" || run.status === "canceling";
}

export function ringerRunIsTerminal(run: RingerRunProjection): boolean {
  return !ringerRunIsLive(run);
}

const TRAILING_UUID_PATTERN =
  /[\s._-]*[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ringerRunDisplayName(name: string): string {
  const stripped = name.replace(TRAILING_UUID_PATTERN, "").trim();
  return stripped.length > 0 ? stripped : name;
}

export function selectCancelableRingerRun(
  runs: ReadonlyArray<RingerRunProjection>,
  threadId: ThreadId,
  runId: RingerRunId,
): RingerRunProjection | null {
  const run = runs.find((candidate) => candidate.runId === runId);
  if (!run || run.threadId !== threadId || !ringerRunIsLive(run) || !run.operations.cancel) {
    return null;
  }
  return run;
}

export function selectDismissableRingerRun(
  runs: ReadonlyArray<RingerRunProjection>,
  threadId: ThreadId,
  runId: RingerRunId,
): RingerRunProjection | null {
  const run = runs.find((candidate) => candidate.runId === runId);
  if (!run || run.threadId !== threadId || !ringerRunIsTerminal(run)) {
    return null;
  }
  return run;
}

export function selectRingerRunsForThread(
  runs: ReadonlyArray<RingerRunProjection>,
  threadRef: ScopedThreadRef,
): ReadonlyArray<RingerRunProjection> {
  return runs.filter(
    (run) => run.environmentId === threadRef.environmentId && run.threadId === threadRef.threadId,
  );
}

export function ringerRunCapabilityNote(run: RingerRunProjection): string {
  const unavailable = [
    "Pause",
    ...(run.operations.retry ? [] : ["single-worker retry"]),
    ...(run.operations.gate ? [] : ["approval gates"]),
  ];
  const capabilityList =
    unavailable.length === 1
      ? unavailable[0]
      : unavailable.length === 2
        ? `${unavailable[0]} and ${unavailable[1]}`
        : `${unavailable.slice(0, -1).join(", ")}, and ${unavailable.at(-1)}`;
  const unsupported = `${capabilityList} ${unavailable.length === 1 ? "is" : "are"} unavailable for this Ringer template.`;
  const stop =
    run.status === "canceling"
      ? "Whole-run Stop has been requested."
      : run.operations.cancel
        ? "Whole-run Stop is supported."
        : "Whole-run Stop is unavailable for this run.";
  return `${unsupported} ${stop}`;
}

export function ringerArtifactSupportsUtf8Preview(artifact: RingerArtifactDescriptor): boolean {
  const mediaType = artifact.mediaType.split(";", 1)[0]!.trim().toLowerCase();
  return (
    mediaType.startsWith("text/") ||
    mediaType === "application/json" ||
    mediaType.endsWith("+json") ||
    mediaType === "application/xml" ||
    mediaType.endsWith("+xml") ||
    mediaType === "application/javascript" ||
    mediaType === "application/yaml" ||
    mediaType === "application/x-yaml"
  );
}

const sortRingerRuns = (runs: Array<RingerRunProjection>): ReadonlyArray<RingerRunProjection> =>
  runs.sort(
    (a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt) || b.runId.localeCompare(a.runId),
  );

export function applyRingerThreadEvent(
  current: ReadonlyArray<RingerRunProjection>,
  event: RingerThreadEvent,
): ReadonlyArray<RingerRunProjection> {
  const next =
    event.type === "removed"
      ? current.filter((run) => run.runId !== event.runId)
      : event.type === "snapshot"
        ? [...event.runs]
        : (() => {
            const byId = new Map(current.map((run) => [run.runId, run]));
            for (const run of event.runs) {
              const existing = byId.get(run.runId);
              if (!existing || run.revision >= existing.revision) byId.set(run.runId, run);
            }
            return [...byId.values()];
          })();
  return sortRingerRuns(next);
}

// For authoritative complete snapshots (the projected event stream): keeps a
// newer local revision per run, and drops runs the snapshot no longer carries.
export function syncRingerThreadRuns(
  current: ReadonlyArray<RingerRunProjection>,
  runs: ReadonlyArray<RingerRunProjection>,
): ReadonlyArray<RingerRunProjection> {
  const byId = new Map(current.map((run) => [run.runId, run]));
  return sortRingerRuns(
    runs.map((run) => {
      const existing = byId.get(run.runId);
      return existing && existing.revision > run.revision ? existing : run;
    }),
  );
}

export function replaceRingerRun(
  current: ReadonlyArray<RingerRunProjection>,
  run: RingerRunProjection,
): ReadonlyArray<RingerRunProjection> {
  return applyRingerThreadEvent(current, {
    type: "upsert",
    threadId: run.threadId,
    runs: [run],
  });
}
