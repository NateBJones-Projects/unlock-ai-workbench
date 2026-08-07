import type {
  RingerArtifactDescriptor,
  RingerRunProjection,
  ScopedThreadRef,
} from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  applyRingerThreadEvent,
  ringerArtifactSupportsUtf8Preview,
  ringerRunCapabilityNote,
  ringerRunDisplayName,
  ringerRunIsLive,
  ringerRunIsTerminal,
  selectCancelableRingerRun,
  selectDismissableRingerRun,
  selectRingerRunsForThread,
  syncRingerThreadRuns,
} from "./ringerPanelModel";

function run(id: string, revision: number, startedAt: string): RingerRunProjection {
  return {
    version: 1,
    revision,
    runId: id,
    environmentId: "local",
    threadId: "thread-a",
    templateId: "unlock.workbench-diagnostic.v1",
    name: id,
    status: "running",
    startedAt,
    updatedAt: startedAt,
    finishedAt: null,
    operations: { launch: true, cancel: true, retry: false, gate: false },
    totals: { total: 1, queued: 0, active: 1, passed: 0, failed: 0, tokens: 0 },
    members: [],
    artifacts: [],
  } as unknown as RingerRunProjection;
}

describe("ringerPanelModel", () => {
  it("keeps multiple run groups and upserts only the addressed run", () => {
    const first = run("run-a", 1, "2026-08-07T12:00:00.000Z");
    const second = run("run-b", 1, "2026-08-07T12:01:00.000Z");
    const updatedFirst = { ...first, revision: 2, status: "succeeded" as const };

    const result = applyRingerThreadEvent([first, second], {
      type: "upsert",
      threadId: first.threadId,
      runs: [updatedFirst],
    });

    expect(result.map((entry) => entry.runId)).toEqual(["run-b", "run-a"]);
    expect(result.find((entry) => entry.runId === "run-a")?.status).toBe("succeeded");
  });

  it("removes only the addressed run when a removed event arrives", () => {
    const first = run("run-a", 1, "2026-08-07T12:00:00.000Z");
    const second = run("run-b", 1, "2026-08-07T12:01:00.000Z");

    const result = applyRingerThreadEvent([first, second], {
      type: "removed",
      threadId: first.threadId,
      runId: first.runId,
    });

    expect(result.map((entry) => entry.runId)).toEqual(["run-b"]);
  });

  it("syncs a complete snapshot: prunes absent runs, keeps newer local revisions", () => {
    const kept = run("run-a", 3, "2026-08-07T12:00:00.000Z");
    const dismissed = run("run-b", 1, "2026-08-07T12:01:00.000Z");
    const staleIncoming = { ...kept, revision: 2, status: "queued" as const };

    const result = syncRingerThreadRuns([kept, dismissed], [staleIncoming]);

    expect(result.map((entry) => entry.runId)).toEqual(["run-a"]);
    expect(result[0]?.revision).toBe(3);
    expect(result[0]?.status).toBe("running");
  });

  it("allows dismissing only terminal runs in the addressed thread", () => {
    const running = run("run-a", 1, "2026-08-07T12:00:00.000Z");
    const finished = { ...run("run-b", 1, "2026-08-07T12:01:00.000Z"), status: "failed" as const };

    expect(ringerRunIsTerminal(running)).toBe(false);
    expect(ringerRunIsTerminal(finished)).toBe(true);
    expect(selectDismissableRingerRun([running, finished], finished.threadId, finished.runId)).toBe(
      finished,
    );
    expect(
      selectDismissableRingerRun([running, finished], running.threadId, running.runId),
    ).toBeNull();
    expect(
      selectDismissableRingerRun(
        [finished],
        "other-thread" as RingerRunProjection["threadId"],
        finished.runId,
      ),
    ).toBeNull();
  });

  it("strips a trailing UUID-ish suffix from run names for display only", () => {
    expect(ringerRunDisplayName("Diagnostic swarm 0f8b2c1d-4a5e-4f6a-9b0c-1d2e3f4a5b6c")).toBe(
      "Diagnostic swarm",
    );
    expect(ringerRunDisplayName("diagnostic-0f8b2c1d-4a5e-4f6a-9b0c-1d2e3f4a5b6c")).toBe(
      "diagnostic",
    );
    expect(ringerRunDisplayName("0f8b2c1d-4a5e-4f6a-9b0c-1d2e3f4a5b6c")).toBe(
      "0f8b2c1d-4a5e-4f6a-9b0c-1d2e3f4a5b6c",
    );
    expect(ringerRunDisplayName("Unlock Workbench diagnostic")).toBe("Unlock Workbench diagnostic");
  });

  it("does not let a stale event replace a newer projection", () => {
    const current = run("run-a", 4, "2026-08-07T12:00:00.000Z");
    const stale = { ...current, revision: 3, status: "failed" as const };
    expect(
      applyRingerThreadEvent([current], {
        type: "upsert",
        threadId: current.threadId,
        runs: [stale],
      })[0]?.status,
    ).toBe("running");
  });

  it("treats canceling as live until Ringer confirms the terminal state", () => {
    expect(
      ringerRunIsLive({ ...run("run-a", 1, "2026-08-07T12:00:00.000Z"), status: "canceling" }),
    ).toBe(true);
  });

  it("selects only the exact live, cancelable run in the addressed thread", () => {
    const first = run("run-a", 1, "2026-08-07T12:00:00.000Z");
    const second = run("run-b", 1, "2026-08-07T12:01:00.000Z");

    expect(selectCancelableRingerRun([first, second], first.threadId, second.runId)).toBe(second);
    expect(
      selectCancelableRingerRun(
        [first],
        "other-thread" as RingerRunProjection["threadId"],
        first.runId,
      ),
    ).toBeNull();
    expect(
      selectCancelableRingerRun([{ ...first, status: "succeeded" }], first.threadId, first.runId),
    ).toBeNull();
    expect(
      selectCancelableRingerRun(
        [{ ...first, operations: { ...first.operations, cancel: false } }],
        first.threadId,
        first.runId,
      ),
    ).toBeNull();
  });

  it("scopes rendered runs synchronously to the active environment and thread", () => {
    const expected = run("run-a", 1, "2026-08-07T12:00:00.000Z");
    const otherThread = {
      ...run("run-b", 1, "2026-08-07T12:01:00.000Z"),
      threadId: "thread-b" as RingerRunProjection["threadId"],
    };
    const otherEnvironment = {
      ...run("run-c", 1, "2026-08-07T12:02:00.000Z"),
      environmentId: "remote" as RingerRunProjection["environmentId"],
    };
    const threadRef = {
      environmentId: expected.environmentId,
      threadId: expected.threadId,
    } satisfies ScopedThreadRef;

    expect(selectRingerRunsForThread([otherThread, expected, otherEnvironment], threadRef)).toEqual(
      [expected],
    );
  });

  it("describes unsupported operations and Stop from the run capabilities", () => {
    const stoppable = run("run-a", 1, "2026-08-07T12:00:00.000Z");
    const unavailable = {
      ...stoppable,
      operations: { ...stoppable.operations, cancel: false },
    };
    const canceling = { ...unavailable, status: "canceling" as const };

    expect(ringerRunCapabilityNote(stoppable)).toContain("approval gates");
    expect(ringerRunCapabilityNote(stoppable)).toContain("Whole-run Stop is supported");
    expect(ringerRunCapabilityNote(unavailable)).toContain(
      "Whole-run Stop is unavailable for this run",
    );
    expect(ringerRunCapabilityNote(unavailable)).not.toContain("Stop is supported");
    expect(ringerRunCapabilityNote(canceling)).toContain("Stop has been requested");
  });

  it("previews only artifacts with explicitly text-compatible media types", () => {
    const artifact = (mediaType: string) =>
      ({
        id: "artifact-a",
        name: "artifact",
        kind: "deliverable",
        mediaType,
      }) as unknown as RingerArtifactDescriptor;

    expect(ringerArtifactSupportsUtf8Preview(artifact("text/markdown"))).toBe(true);
    expect(ringerArtifactSupportsUtf8Preview(artifact("application/json"))).toBe(true);
    expect(ringerArtifactSupportsUtf8Preview(artifact("application/octet-stream"))).toBe(false);
    expect(ringerArtifactSupportsUtf8Preview(artifact("image/png"))).toBe(false);
  });
});
