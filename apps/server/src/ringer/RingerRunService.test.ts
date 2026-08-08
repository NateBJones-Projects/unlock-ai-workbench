import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import {
  EnvironmentId,
  RINGER_WORKBENCH_DIAGNOSTIC_TEMPLATE_ID,
  RingerExecutionError,
  RingerMemberId,
  RingerUnavailableError,
  ThreadId,
  type RingerThreadEvent,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Queue from "effect/Queue";
import * as Stream from "effect/Stream";

import * as ServerConfig from "../config.ts";
import * as ServerEnvironment from "../environment/ServerEnvironment.ts";
import * as RingerRunService from "./RingerRunService.ts";
import {
  type RawRingerRunState,
  RingerRuntime,
  type RingerRuntimeCancelInput,
  type RingerRuntimeStateInput,
} from "./RingerRuntime.ts";

const environmentId = EnvironmentId.make("environment-ringer-test");
const digestA = "a".repeat(64);
const digestB = "b".repeat(64);

const rawState = (backendRunId: string, finished = false): RawRingerRunState => ({
  schema_version: 2,
  revision: finished ? 2 : 1,
  updated_at: finished ? "2026-08-07T12:00:02.000Z" : "2026-08-07T12:00:01.000Z",
  run_id: backendRunId,
  run_name: "Unlock Workbench diagnostic",
  state: finished ? "finished" : "live",
  finished,
  started_at: "2026-08-07T12:00:00.000Z",
  tasks: [
    {
      key: "runtime-check",
      status: finished ? "pass" : "running",
      verdict: finished ? "PASS" : "",
      engine: "workbench_fixture",
      attempts: 1,
      max_attempts: 1,
      elapsed_s: finished ? 1 : 0,
      tokens: 0,
      check_returncode: finished ? 0 : null,
      check_timed_out: false,
      deliverables: [
        {
          name: "/Users/private/ringer/diagnostic.md",
          path: `/private/ringer/${backendRunId}/diagnostic.md`,
          bytes: 64,
        },
        {
          name: "binary.bin",
          path: `/private/ringer/${backendRunId}/binary.bin`,
          bytes: 4,
        },
      ],
    },
  ],
  totals: {
    running: finished ? 0 : 1,
    done: finished ? 1 : 0,
    pass: finished ? 1 : 0,
    fail: 0,
    tokens: 0,
  },
  artifact_path: null,
  live_path: null,
  report_path: null,
  report_ready: finished,
});

interface FakeControl {
  digest: string;
  hudFails: boolean;
  cancelFails: boolean;
  cancelFinishes: boolean;
  readonly backendByLaunch: Map<string, string>;
  readonly states: Map<string, RawRingerRunState>;
  readonly stateReads: RingerRuntimeStateInput[];
  readonly cancels: RingerRuntimeCancelInput[];
  readonly hudInputs: Array<{
    readonly preferredPort?: number;
    readonly instanceNonce: string;
    readonly expectedRuntimeDigest: string;
  }>;
  finish: (launchId: string) => void;
}

const makeFakeRuntime = (): {
  readonly service: RingerRuntime["Service"];
  readonly control: FakeControl;
} => {
  let counter = 0;
  const control: FakeControl = {
    digest: digestA,
    hudFails: false,
    cancelFails: false,
    cancelFinishes: true,
    backendByLaunch: new Map(),
    states: new Map(),
    stateReads: [],
    cancels: [],
    hudInputs: [],
    finish: (launchId) => {
      const backendRunId = control.backendByLaunch.get(launchId);
      if (backendRunId) control.states.set(backendRunId, rawState(backendRunId, true));
    },
  };
  const service = RingerRuntime.of({
    probe: Effect.sync(() => ({ available: true, runtimeDigest: control.digest })),
    ensureHud: (input) =>
      Effect.suspend(() => {
        control.hudInputs.push(input);
        return control.hudFails
          ? Effect.fail(
              new RingerUnavailableError({ operation: "launch", reason: "hud-unavailable" }),
            )
          : Effect.succeed(43_123);
      }),
    launch: (input) =>
      Effect.sync(() => {
        counter += 1;
        const backendRunId = `native-private-${counter}`;
        control.backendByLaunch.set(input.launchId, backendRunId);
        control.states.set(backendRunId, rawState(backendRunId));
      }),
    discoverBackendRunId: (input) => Effect.succeed(control.backendByLaunch.get(input.launchId)),
    readState: (input) =>
      Effect.sync(() => {
        control.stateReads.push(input);
        return control.states.get(input.backendRunId);
      }),
    cancel: (input) =>
      Effect.suspend(() => {
        control.cancels.push(input);
        if (control.cancelFails) {
          return Effect.fail(new RingerExecutionError({ operation: "cancel", stage: "control" }));
        }
        if (control.cancelFinishes) {
          control.states.set(input.backendRunId, rawState(input.backendRunId, true));
        }
        return Effect.void;
      }),
    readProof: () =>
      Effect.succeed({
        proof: {
          verified: "diagnostic.md records a zero-model-call fixture",
          check_output_tail: "verification passed",
        },
        logTail: "fixture complete",
      }),
    readArtifactText: () =>
      Effect.succeed({ content: "# Diagnostic\n\nModel calls: 0\n", truncated: false }),
  });
  return { service, control };
};

const fakeEnvironment = ServerEnvironment.ServerEnvironment.of({
  getEnvironmentId: Effect.succeed(environmentId),
  getDescriptor: Effect.die("unused"),
});

const serviceLayer = (baseDir: string, runtime: RingerRuntime["Service"]) =>
  RingerRunService.layerWithoutRuntime.pipe(
    Layer.provide(Layer.succeed(RingerRuntime, runtime)),
    Layer.provide(Layer.succeed(ServerEnvironment.ServerEnvironment, fakeEnvironment)),
    Layer.provide(ServerConfig.layerTest(process.cwd(), baseDir)),
  );

it.effect("isolates concurrent thread launches and cancels only the exact attached run", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const baseDir = yield* fs.makeTempDirectoryScoped({ prefix: "ringer-service-test-" });
    const fake = makeFakeRuntime();
    const threadA = ThreadId.make("thread-a");
    const threadB = ThreadId.make("thread-b");

    yield* Effect.gen(function* () {
      const service = yield* RingerRunService.RingerRunService;
      const [runA, runB] = yield* Effect.all(
        [
          service.launch({
            threadId: threadA,
            templateId: RINGER_WORKBENCH_DIAGNOSTIC_TEMPLATE_ID,
          }),
          service.launch({
            threadId: threadB,
            templateId: RINGER_WORKBENCH_DIAGNOSTIC_TEMPLATE_ID,
          }),
        ],
        { concurrency: "unbounded" },
      );
      yield* service.status({ threadId: threadA, runId: runA.runId });
      yield* service.status({ threadId: threadB, runId: runB.runId });

      expect((yield* service.list({ threadId: threadA })).runs.map((run) => run.runId)).toEqual([
        runA.runId,
      ]);
      expect((yield* service.list({ threadId: threadB })).runs.map((run) => run.runId)).toEqual([
        runB.runId,
      ]);

      const wrongThread = yield* service
        .cancel({ threadId: threadA, runId: runB.runId })
        .pipe(Effect.flip);
      expect(wrongThread._tag).toBe("RingerRunNotFoundError");
      expect(fake.control.cancels).toHaveLength(0);

      if (process.platform === "darwin") {
        yield* service.cancel({ threadId: threadB, runId: runB.runId });
        expect(fake.control.cancels).toHaveLength(1);
        expect(fake.control.cancels[0]?.threadId).toBe(threadB);
        expect(fake.control.cancels[0]?.backendRunId).toBe(
          fake.control.backendByLaunch.get(runB.runId),
        );
        expect(fake.control.cancels[0]?.backendRunId).not.toBe(
          fake.control.backendByLaunch.get(runA.runId),
        );
      } else {
        const unavailable = yield* service
          .cancel({ threadId: threadB, runId: runB.runId })
          .pipe(Effect.flip);
        expect(unavailable._tag).toBe("RingerUnavailableError");
        expect(fake.control.cancels).toHaveLength(0);
      }
    }).pipe(Effect.provide(serviceLayer(baseDir, fake.service)));

    expect(fake.control.hudInputs[0]?.preferredPort).toBeUndefined();
    expect(fake.control.hudInputs[1]?.preferredPort).toBe(43_123);
  }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
);

it.effect("keeps two Ringer runs in one thread separate and independently addressable", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const baseDir = yield* fs.makeTempDirectoryScoped({ prefix: "ringer-same-thread-test-" });
    const fake = makeFakeRuntime();
    const threadId = ThreadId.make("thread-multiple-runs");

    yield* Effect.gen(function* () {
      const service = yield* RingerRunService.RingerRunService;
      const [first, second] = yield* Effect.all(
        [
          service.launch({
            threadId,
            templateId: RINGER_WORKBENCH_DIAGNOSTIC_TEMPLATE_ID,
          }),
          service.launch({
            threadId,
            templateId: RINGER_WORKBENCH_DIAGNOSTIC_TEMPLATE_ID,
          }),
        ],
        { concurrency: "unbounded" },
      );
      expect(first.runId).not.toBe(second.runId);
      expect(fake.control.backendByLaunch.get(first.runId)).not.toBe(
        fake.control.backendByLaunch.get(second.runId),
      );

      fake.control.finish(first.runId);
      const firstStatus = yield* service.status({ threadId, runId: first.runId });
      const secondStatus = yield* service.status({ threadId, runId: second.runId });
      expect(firstStatus.status).toBe("succeeded");
      expect(secondStatus.status).toBe("running");

      const listed = yield* service.list({ threadId });
      expect(listed.runs).toHaveLength(2);
      expect(new Set(listed.runs.map((run) => run.runId))).toEqual(
        new Set([first.runId, second.runId]),
      );
      for (const launched of [first, second]) {
        expect(
          fake.control.stateReads.some(
            (read) =>
              read.environmentId === environmentId &&
              read.threadId === threadId &&
              read.launchId === launched.runId &&
              read.backendRunId === fake.control.backendByLaunch.get(launched.runId),
          ),
        ).toBe(true);
      }
    }).pipe(Effect.provide(serviceLayer(baseDir, fake.service)));
  }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
);

it.effect("atomically replaces persisted attachment state with owner-only permissions", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const baseDir = yield* fs.makeTempDirectoryScoped({ prefix: "ringer-permissions-test-" });
    const persistedPath = path.join(baseDir, "userdata", "ringer-attachments.json");
    yield* fs.makeDirectory(path.dirname(persistedPath), { recursive: true });
    yield* fs.writeFileString(persistedPath, '{"version":1,"attachments":[]}\n', { mode: 0o644 });
    yield* fs.chmod(persistedPath, 0o644);
    const fake = makeFakeRuntime();
    const threadId = ThreadId.make("thread-permissions");

    yield* Effect.gen(function* () {
      const service = yield* RingerRunService.RingerRunService;
      yield* service.launch({
        threadId,
        templateId: RINGER_WORKBENCH_DIAGNOSTIC_TEMPLATE_ID,
      });
    }).pipe(Effect.provide(serviceLayer(baseDir, fake.service)));

    const persistedInfo = yield* fs.stat(persistedPath);
    expect(persistedInfo.mode & 0o777).toBe(0o600);
  }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
);

it.effect(
  "reattaches persisted runs after restart and rotates HUD identity when runtime changes",
  () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const baseDir = yield* fs.makeTempDirectoryScoped({ prefix: "ringer-restart-test-" });
      const fake = makeFakeRuntime();
      const threadId = ThreadId.make("thread-restart");

      const launched = yield* Effect.gen(function* () {
        const service = yield* RingerRunService.RingerRunService;
        return yield* service.launch({
          threadId,
          templateId: RINGER_WORKBENCH_DIAGNOSTIC_TEMPLATE_ID,
        });
      }).pipe(Effect.provide(serviceLayer(baseDir, fake.service)));
      const firstHud = fake.control.hudInputs[0];
      expect(firstHud?.expectedRuntimeDigest).toBe(digestA);

      fake.control.digest = digestB;
      const listed = yield* Effect.gen(function* () {
        const service = yield* RingerRunService.RingerRunService;
        const snapshot = yield* service.list({ threadId });
        yield* service.launch({
          threadId,
          templateId: RINGER_WORKBENCH_DIAGNOSTIC_TEMPLATE_ID,
        });
        return snapshot;
      }).pipe(Effect.provide(serviceLayer(baseDir, fake.service)));

      expect(listed.runs.map((run) => run.runId)).toContain(launched.runId);
      expect(listed.runs[0]?.status).toBe("running");
      const secondHud = fake.control.hudInputs.at(-1);
      expect(secondHud?.expectedRuntimeDigest).toBe(digestB);
      expect(secondHud?.preferredPort).toBeUndefined();
      expect(secondHud?.instanceNonce).not.toBe(firstHud?.instanceNonce);
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
);

it.effect("restores the run's true status and keeps cancel retryable when the cancel fails", () =>
  Effect.gen(function* () {
    if (process.platform !== "darwin") return;
    const fs = yield* FileSystem.FileSystem;
    const baseDir = yield* fs.makeTempDirectoryScoped({ prefix: "ringer-cancel-rollback-test-" });
    const fake = makeFakeRuntime();
    const threadId = ThreadId.make("thread-cancel-rollback");

    yield* Effect.gen(function* () {
      const service = yield* RingerRunService.RingerRunService;
      const launched = yield* service.launch({
        threadId,
        templateId: RINGER_WORKBENCH_DIAGNOSTIC_TEMPLATE_ID,
      });
      yield* service.status({ threadId, runId: launched.runId });

      fake.control.cancelFails = true;
      const failure = yield* service.cancel({ threadId, runId: launched.runId }).pipe(Effect.flip);
      expect(failure._tag).toBe("RingerExecutionError");
      expect(fake.control.cancels).toHaveLength(1);

      const restored = yield* service.status({ threadId, runId: launched.runId });
      expect(restored.status).toBe("running");
      expect(restored.operations.cancel).toBe(true);

      fake.control.finish(launched.runId);
      const finished = yield* service.status({ threadId, runId: launched.runId });
      expect(finished.status).toBe("succeeded");
    }).pipe(Effect.provide(serviceLayer(baseDir, fake.service)));
  }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
);

it.effect("keeps cancel retryable while a run is still canceling", () =>
  Effect.gen(function* () {
    if (process.platform !== "darwin") return;
    const fs = yield* FileSystem.FileSystem;
    const baseDir = yield* fs.makeTempDirectoryScoped({ prefix: "ringer-cancel-retry-test-" });
    const fake = makeFakeRuntime();
    fake.control.cancelFinishes = false;
    const threadId = ThreadId.make("thread-cancel-retry");

    yield* Effect.gen(function* () {
      const service = yield* RingerRunService.RingerRunService;
      const launched = yield* service.launch({
        threadId,
        templateId: RINGER_WORKBENCH_DIAGNOSTIC_TEMPLATE_ID,
      });
      yield* service.status({ threadId, runId: launched.runId });

      const canceling = yield* service.cancel({ threadId, runId: launched.runId });
      expect(canceling.status).toBe("canceling");
      expect(canceling.operations.cancel).toBe(true);

      yield* service.cancel({ threadId, runId: launched.runId });
      expect(fake.control.cancels).toHaveLength(2);
    }).pipe(Effect.provide(serviceLayer(baseDir, fake.service)));
  }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
);

it.effect("dismisses only terminal runs, publishes the removal, and persists it", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const baseDir = yield* fs.makeTempDirectoryScoped({ prefix: "ringer-dismiss-test-" });
    const fake = makeFakeRuntime();
    const threadId = ThreadId.make("thread-dismiss");

    yield* Effect.gen(function* () {
      const service = yield* RingerRunService.RingerRunService;
      const launched = yield* service.launch({
        threadId,
        templateId: RINGER_WORKBENCH_DIAGNOSTIC_TEMPLATE_ID,
      });
      yield* service.status({ threadId, runId: launched.runId });

      const rejected = yield* service
        .dismiss({ threadId, runId: launched.runId })
        .pipe(Effect.flip);
      expect(rejected._tag).toBe("RingerRunNotDismissableError");

      const queue = yield* Queue.unbounded<RingerThreadEvent>();
      yield* service.observe({ threadId }).pipe(
        Stream.runForEach((event) => Queue.offer(queue, event)),
        Effect.forkChild,
      );
      const first = yield* Queue.take(queue);
      expect(first.type).toBe("snapshot");

      fake.control.finish(launched.runId);
      const finished = yield* service.status({ threadId, runId: launched.runId });
      expect(finished.status).toBe("succeeded");

      yield* service.dismiss({ threadId, runId: launched.runId });
      let event = yield* Queue.take(queue);
      while (event.type !== "removed") event = yield* Queue.take(queue);
      expect(event.runId).toBe(launched.runId);

      expect((yield* service.list({ threadId })).runs).toHaveLength(0);
      const missing = yield* service.status({ threadId, runId: launched.runId }).pipe(Effect.flip);
      expect(missing._tag).toBe("RingerRunNotFoundError");
    }).pipe(Effect.provide(serviceLayer(baseDir, fake.service)));

    const persisted = yield* fs.readFileString(
      path.join(baseDir, "userdata", "ringer-attachments.json"),
    );
    expect(persisted).toContain('"attachments":[]');
  }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
);

it.effect("rehydrates terminal runs to their persisted terminal projection after restart", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const baseDir = yield* fs.makeTempDirectoryScoped({ prefix: "ringer-terminal-restart-test-" });
    const fake = makeFakeRuntime();
    const threadId = ThreadId.make("thread-terminal-restart");

    const launched = yield* Effect.gen(function* () {
      const service = yield* RingerRunService.RingerRunService;
      const run = yield* service.launch({
        threadId,
        templateId: RINGER_WORKBENCH_DIAGNOSTIC_TEMPLATE_ID,
      });
      fake.control.finish(run.runId);
      const finished = yield* service.status({ threadId, runId: run.runId });
      expect(finished.status).toBe("succeeded");
      return finished;
    }).pipe(Effect.provide(serviceLayer(baseDir, fake.service)));

    const amnesiac = makeFakeRuntime();
    yield* Effect.gen(function* () {
      const service = yield* RingerRunService.RingerRunService;
      const listed = yield* service.list({ threadId });
      expect(listed.runs).toHaveLength(1);
      expect(listed.runs[0]?.status).toBe("succeeded");
      expect(listed.runs[0]?.finishedAt).not.toBeNull();
      expect(listed.runs[0]?.totals.passed).toBe(1);
      const status = yield* service.status({ threadId, runId: launched.runId });
      expect(status.status).toBe("succeeded");
    }).pipe(Effect.provide(serviceLayer(baseDir, amnesiac.service)));
  }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
);

it.effect("reuses the persisted HUD nonce when a failed HUD launch is retried", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const baseDir = yield* fs.makeTempDirectoryScoped({ prefix: "ringer-hud-retry-test-" });
    const fake = makeFakeRuntime();
    fake.control.hudFails = true;
    const threadId = ThreadId.make("thread-hud-retry");

    yield* Effect.gen(function* () {
      const service = yield* RingerRunService.RingerRunService;
      const failure = yield* service
        .launch({ threadId, templateId: RINGER_WORKBENCH_DIAGNOSTIC_TEMPLATE_ID })
        .pipe(Effect.flip);
      expect(failure._tag).toBe("RingerUnavailableError");
      fake.control.hudFails = false;
      yield* service.launch({ threadId, templateId: RINGER_WORKBENCH_DIAGNOSTIC_TEMPLATE_ID });
    }).pipe(Effect.provide(serviceLayer(baseDir, fake.service)));

    expect(fake.control.hudInputs).toHaveLength(2);
    expect(fake.control.hudInputs[1]?.instanceNonce).toBe(fake.control.hudInputs[0]?.instanceNonce);
    expect(fake.control.hudInputs[1]?.preferredPort).toBeUndefined();
  }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
);

it.effect(
  "projects deterministic zero-spend proof and text artifact while rejecting unsupported operations",
  () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const baseDir = yield* fs.makeTempDirectoryScoped({ prefix: "ringer-proof-test-" });
      const fake = makeFakeRuntime();
      const threadId = ThreadId.make("thread-proof");

      yield* Effect.gen(function* () {
        const service = yield* RingerRunService.RingerRunService;
        const capabilities = yield* service.capabilities({ threadId });
        expect(capabilities.templates[0]).toMatchObject({
          agentBacked: false,
          estimatedAgentCalls: 0,
        });

        const launched = yield* service.launch({
          threadId,
          templateId: RINGER_WORKBENCH_DIAGNOSTIC_TEMPLATE_ID,
        });
        fake.control.finish(launched.runId);
        const finished = yield* service.status({ threadId, runId: launched.runId });
        expect(finished.status).toBe("succeeded");
        expect(finished.totals.tokens).toBe(0);
        expect(finished.members[0]?.tokens).toBe(0);
        expect(finished.artifacts.map((artifact) => artifact.name)).toEqual(["diagnostic.md"]);

        const memberId = RingerMemberId.make("member-1");
        const proof = yield* service.proof({ threadId, runId: launched.runId, memberId });
        expect(proof).toMatchObject({ verdict: "pass", checkStatus: "passed" });
        expect(proof.logTail).toContain("fixture complete");
        const artifact = yield* service.readArtifact({
          threadId,
          runId: launched.runId,
          artifactId: finished.artifacts[0]!.id,
        });
        expect(artifact.encoding).toBe("utf8");
        expect(artifact.content).toContain("Model calls: 0");

        expect(
          (yield* service.retry({ threadId, runId: launched.runId, memberId }).pipe(Effect.flip))
            ._tag,
        ).toBe("RingerOperationUnsupportedError");
        expect(
          (yield* service
            .gate({ threadId, runId: launched.runId, gateId: "gate-1", decision: "approve" })
            .pipe(Effect.flip))._tag,
        ).toBe("RingerOperationUnsupportedError");
      }).pipe(Effect.provide(serviceLayer(baseDir, fake.service)));
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
);
