import type { RingerRunProjection } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { projectRingerThreadEvent } from "./ringer.ts";

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

describe("projectRingerThreadEvent", () => {
  it("retains rapid upserts for different runs in its latest snapshot", () => {
    const first = run("run-a", 1, "2026-08-07T12:00:00.000Z");
    const second = run("run-b", 1, "2026-08-07T12:01:00.000Z");
    const afterFirst = projectRingerThreadEvent([], {
      type: "upsert",
      threadId: first.threadId,
      runs: [first],
    });
    const afterSecond = projectRingerThreadEvent(afterFirst.runs, {
      type: "upsert",
      threadId: second.threadId,
      runs: [second],
    });

    expect(afterSecond.type).toBe("snapshot");
    expect(afterSecond.runs.map((entry) => entry.runId)).toEqual(["run-b", "run-a"]);
  });

  it("drops only the addressed run when a removed event arrives", () => {
    const first = run("run-a", 1, "2026-08-07T12:00:00.000Z");
    const second = run("run-b", 1, "2026-08-07T12:01:00.000Z");

    const afterRemoval = projectRingerThreadEvent([first, second], {
      type: "removed",
      threadId: first.threadId,
      runId: first.runId,
    });

    expect(afterRemoval.type).toBe("snapshot");
    expect(afterRemoval.runs.map((entry) => entry.runId)).toEqual(["run-b"]);

    const unknownRemoval = projectRingerThreadEvent(afterRemoval.runs, {
      type: "removed",
      threadId: first.threadId,
      runId: first.runId,
    });
    expect(unknownRemoval.runs.map((entry) => entry.runId)).toEqual(["run-b"]);
  });

  it("does not let a stale upsert replace a newer run", () => {
    const current = run("run-a", 3, "2026-08-07T12:00:00.000Z");
    const stale = { ...current, revision: 2, status: "failed" as const };

    expect(
      projectRingerThreadEvent([current], {
        type: "upsert",
        threadId: current.threadId,
        runs: [stale],
      }).runs[0]?.status,
    ).toBe("running");
  });
});
