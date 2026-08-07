import { createHash } from "node:crypto";

import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";

import * as ServerConfig from "../config.ts";
import * as ProcessRunner from "../processRunner.ts";
import {
  buildFixtureConfig,
  buildDiagnosticManifest,
  layerWithOptions,
  RingerRuntime,
} from "./RingerRuntime.ts";

const encodeUnknownJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
const sha256 = (value: Uint8Array | string): string =>
  createHash("sha256").update(value).digest("hex");

const runtimeLayer = (runtimeRoot: string, prefix: string, cwd = process.cwd()) =>
  layerWithOptions({ runtimeRoot }).pipe(
    Layer.provide(ServerConfig.layerTest(cwd, { prefix })),
    Layer.provide(FetchHttpClient.layer),
    Layer.provide(NodeServices.layer),
  );

const runtimeLayerAt = (runtimeRoot: string, baseDir: string, cwd = process.cwd()) =>
  layerWithOptions({ runtimeRoot }).pipe(
    Layer.provide(ServerConfig.layerTest(cwd, baseDir)),
    Layer.provide(FetchHttpClient.layer),
    Layer.provide(NodeServices.layer),
  );

const ProcessRunnerTestLayer = ProcessRunner.layer.pipe(Layer.provideMerge(NodeServices.layer));

it.effect("accepts the real pinned runtime lock and compatible Python resolver", () => {
  const pinnedRoot = new URL("../../../desktop/resources/ringer/", import.meta.url).pathname;
  return Effect.gen(function* () {
    const runtime = yield* RingerRuntime;
    const probe = yield* runtime.probe;
    expect(probe.available).toBe(true);
    expect(probe.runtimeDigest).toMatch(/^[a-f0-9]{64}$/u);
    expect(probe.runtimeDigest?.startsWith("9cba95cb5133")).toBe(true);
  }).pipe(Effect.provide(runtimeLayer(pinnedRoot, "ringer-pinned-probe-test-")));
});

it.effect("fails closed when a runtime file no longer matches runtime-lock.json", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const root = yield* fs.makeTempDirectoryScoped({ prefix: "ringer-lock-tamper-" });
    const files = [
      { path: "engines/mock_worker.py", contents: "print('fixture')\n" },
      { path: "ringer.py", contents: "print('ringer')\n" },
    ].toSorted((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
    const entries = files.map((file) => ({
      path: file.path,
      sha256: sha256(file.contents),
      bytes: Buffer.byteLength(file.contents),
      mode: "644",
    }));
    for (const file of files) {
      const absolute = path.join(root, ...file.path.split("/"));
      yield* fs.makeDirectory(path.dirname(absolute), { recursive: true });
      yield* fs.writeFileString(absolute, file.contents);
      yield* fs.chmod(absolute, 0o644);
    }
    const aggregate = entries
      .map((entry) => `${entry.path}\0${entry.sha256}\0${entry.bytes}`)
      .join("\n");
    yield* fs.writeFileString(
      path.join(root, "runtime-lock.json"),
      `${encodeUnknownJson({
        schema_version: 1,
        product: "Unlock AI Workbench",
        runtime: "Ringer",
        content_sha256: sha256(aggregate),
        files: entries,
      })}\n`,
    );
    yield* fs.writeFileString(path.join(root, "ringer.py"), "print('tampered')\n");

    const probe = yield* Effect.gen(function* () {
      const runtime = yield* RingerRuntime;
      return yield* runtime.probe;
    }).pipe(Effect.provide(runtimeLayer(root, "ringer-tamper-probe-test-")));
    expect(probe).toMatchObject({ available: false, unavailableReason: "runtime-invalid" });
  }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
);

it.effect("does not fall back when an explicit runtime root is unavailable", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const temp = yield* fs.makeTempDirectoryScoped({ prefix: "ringer-explicit-root-test-" });
    const unavailableRoot = path.join(temp, "missing-explicit-runtime");
    const repositoryRoot = new URL("../../../../", import.meta.url).pathname;

    const probe = yield* Effect.gen(function* () {
      const runtime = yield* RingerRuntime;
      return yield* runtime.probe;
    }).pipe(
      Effect.provide(
        runtimeLayer(unavailableRoot, "ringer-explicit-root-config-test-", repositoryRoot),
      ),
    );

    // repositoryRoot contains a valid development bundle. A successful probe
    // here would mean the explicit, invalid root was silently ignored.
    expect(probe).toMatchObject({ available: false, unavailableReason: "runtime-not-found" });
  }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
);

it.effect(
  "revalidates the environment, thread, launch, and backend origin on every state read",
  () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const baseDir = yield* fs.makeTempDirectoryScoped({ prefix: "ringer-state-origin-test-" });
      const pinnedRoot = new URL("../../../desktop/resources/ringer/", import.meta.url).pathname;
      const backendRunId = "native-origin-test-1";
      const runsDir = path.join(baseDir, "userdata", "ringer", "runs");
      const expected = {
        environmentId: "environment-origin",
        threadId: "thread-origin",
        launchId: "launch-origin",
        backendRunId,
      };
      yield* fs.makeDirectory(runsDir, { recursive: true });
      yield* fs.writeFileString(
        path.join(runsDir, `${backendRunId}.json`),
        `${encodeUnknownJson({
          schema_version: 2,
          run_id: backendRunId,
          run_name: "Origin test",
          state: "live",
          started_at: "2026-08-07T12:00:00.000Z",
          tasks: [],
          origin: {
            client: "unlock-ai-workbench",
            surface: "t3-code",
            environment_id: expected.environmentId,
            thread_id: expected.threadId,
            launch_id: expected.launchId,
          },
        })}\n`,
      );

      yield* Effect.gen(function* () {
        const runtime = yield* RingerRuntime;
        expect((yield* runtime.readState(expected))?.run_id).toBe(backendRunId);

        for (const mismatched of [
          { ...expected, environmentId: "environment-other" },
          { ...expected, threadId: "thread-other" },
          { ...expected, launchId: "launch-other" },
          { ...expected, backendRunId: "native-origin-test-other" },
        ]) {
          if (mismatched.backendRunId !== backendRunId) {
            yield* fs.writeFileString(
              path.join(runsDir, `${mismatched.backendRunId}.json`),
              yield* fs.readFileString(path.join(runsDir, `${backendRunId}.json`)),
            );
          }
          const failure = yield* runtime.readState(mismatched).pipe(Effect.flip);
          expect(failure).toMatchObject({ _tag: "RingerExecutionError", stage: "read-state" });
        }
      }).pipe(Effect.provide(runtimeLayerAt(pinnedRoot, baseDir)));
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
);

it.effect("limits artifact reads to canonical roots for the attached run", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const baseDir = yield* fs.makeTempDirectoryScoped({ prefix: "ringer-artifact-scope-test-" });
    const pinnedRoot = new URL("../../../desktop/resources/ringer/", import.meta.url).pathname;
    const stateRoot = path.join(baseDir, "userdata", "ringer");
    const artifactsRoot = path.join(stateRoot, "artifacts", "deliverables");
    const attachedRoot = path.join(artifactsRoot, "native-artifact-1", "runtime-check");
    const siblingRoot = path.join(artifactsRoot, "native-artifact-2", "runtime-check");
    const allowedPath = path.join(attachedRoot, "diagnostic.md");
    const siblingPath = path.join(siblingRoot, "private.md");
    const linkedPath = path.join(attachedRoot, "linked-private.md");
    const workspacesRoot = path.join(stateRoot, "workbench", "workspaces");
    const siblingWorkspace = path.join(workspacesRoot, "launch-other");
    const aliasedWorkspace = path.join(workspacesRoot, "launch-artifact");
    const aliasedWorkspacePath = path.join(aliasedWorkspace, "private.md");
    yield* fs.makeDirectory(attachedRoot, { recursive: true });
    yield* fs.makeDirectory(siblingRoot, { recursive: true });
    yield* fs.makeDirectory(siblingWorkspace, { recursive: true });
    yield* fs.writeFileString(allowedPath, "Model calls: 0\n");
    yield* fs.writeFileString(siblingPath, "private\n");
    yield* fs.writeFileString(path.join(siblingWorkspace, "private.md"), "workspace private\n");
    yield* fs.symlink(siblingPath, linkedPath);
    yield* fs.symlink(siblingWorkspace, aliasedWorkspace);

    yield* Effect.gen(function* () {
      const runtime = yield* RingerRuntime;
      const scope = {
        environmentId: "environment-artifact",
        threadId: "thread-artifact",
        launchId: "launch-artifact",
        backendRunId: "native-artifact-1",
      };
      expect(
        (yield* runtime.readArtifactText({ ...scope, artifactPath: allowedPath })).content,
      ).toBe("Model calls: 0\n");
      for (const artifactPath of [siblingPath, linkedPath, aliasedWorkspacePath]) {
        const failure = yield* runtime
          .readArtifactText({ ...scope, artifactPath })
          .pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "RingerExecutionError", stage: "artifact" });
      }
    }).pipe(Effect.provide(runtimeLayerAt(pinnedRoot, baseDir)));
  }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
);

it("builds a one-task deterministic manifest with no provider or model invocation", () => {
  const manifest = buildDiagnosticManifest({
    launchId: "launch-1",
    workdir: "/tmp/workbench-diagnostic",
    pythonPath: "/opt/homebrew/bin/python3.13",
    origin: {
      client: "unlock-ai-workbench",
      surface: "t3-code",
      environment_id: "environment-1",
      thread_id: "thread-1",
      launch_id: "launch-1",
    },
  });
  expect(manifest.max_parallel).toBe(1);
  expect(manifest.tasks).toHaveLength(1);
  expect(manifest.tasks[0]).toMatchObject({
    engine: "workbench_fixture",
    max_attempts: 1,
    expect_files: ["diagnostic.md"],
  });
  expect(manifest.tasks[0]?.spec).toContain("zero model calls");
  expect(manifest.tasks[0]?.spec).toContain("Model calls: 0");
});

it.effect("runs the pinned deterministic diagnostic synchronously with zero model spend", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const runner = yield* ProcessRunner.ProcessRunner;
    const pinnedRoot = new URL("../../../desktop/resources/ringer/", import.meta.url).pathname;
    const temp = yield* fs.makeTempDirectoryScoped({ prefix: "ringer-no-spend-e2e-" });
    const stateRoot = path.join(temp, "state");
    const workdir = path.join(temp, "workspace");
    const configPath = path.join(temp, "config.toml");
    const manifestPath = path.join(temp, "manifest.json");
    const handoffPath = path.join(temp, "run-id.json");
    const origin = {
      client: "unlock-ai-workbench" as const,
      surface: "t3-code" as const,
      environment_id: "environment-e2e",
      thread_id: "thread-e2e",
      launch_id: "launch-e2e",
    };

    let pythonPath: string | undefined;
    for (const candidate of ["python3.13", "python3.12", "python3"] as const) {
      const result = yield* runner
        .run({
          command: candidate,
          args: [
            "-c",
            "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}'); print(sys.executable)",
          ],
          timeout: "3 seconds",
          maxOutputBytes: 256,
        })
        .pipe(Effect.option);
      if (result._tag === "None" || result.value.code !== 0) continue;
      const [version, executable] = result.value.stdout.trim().split(/\r?\n/u);
      const [major, minor] = (version ?? "").split(".").map(Number);
      if (
        major !== undefined &&
        minor !== undefined &&
        (major > 3 || (major === 3 && minor >= 12)) &&
        executable
      ) {
        pythonPath = executable;
        break;
      }
    }
    expect(pythonPath).toBeDefined();
    if (!pythonPath) return;

    yield* fs.makeDirectory(stateRoot, { recursive: true });
    yield* fs.makeDirectory(workdir, { recursive: true });
    yield* fs.writeFileString(
      configPath,
      buildFixtureConfig({
        stateRoot,
        mockWorkerPath: path.join(pinnedRoot, "engines", "mock_worker.py"),
        pythonPath,
        evalPath: path.join(temp, "runs.jsonl"),
      }),
    );
    yield* fs.writeFileString(
      manifestPath,
      `${encodeUnknownJson(
        buildDiagnosticManifest({ launchId: "launch-e2e", workdir, origin, pythonPath }),
      )}\n`,
    );

    const run = yield* runner.run({
      command: pythonPath,
      args: [
        path.join(pinnedRoot, "ringer.py"),
        "--no-self-update",
        "run",
        manifestPath,
        "--config",
        configPath,
        "--identity",
        "unlock-ai-workbench",
        "--no-dashboard",
        "--no-artifact",
      ],
      env: {
        PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
        HOME: process.env.HOME,
        TMPDIR: process.env.TMPDIR,
        LANG: process.env.LANG ?? "en_US.UTF-8",
        LC_ALL: process.env.LC_ALL ?? "en_US.UTF-8",
        RINGER_HOME: stateRoot,
        RINGER_CONFIG: configPath,
        RINGER_NO_SELF_UPDATE: "1",
        RINGER_NO_CATALOG_REFRESH: "1",
        RINGER_ORIGIN_JSON: encodeUnknownJson(origin),
        RINGER_CONTROL_TOKEN: "test-control-token-no-spend",
        RINGER_RUN_ID_FILE: handoffPath,
      },
      timeout: "30 seconds",
      maxOutputBytes: 64 * 1_024,
    });
    expect(run.code).toBe(0);
    const handoff = yield* Schema.decodeUnknownEffect(
      Schema.fromJsonString(Schema.Struct({ run_id: Schema.String })),
    )(yield* fs.readFileString(handoffPath));
    const state = yield* Schema.decodeUnknownEffect(
      Schema.fromJsonString(
        Schema.Struct({
          state: Schema.String,
          tasks: Schema.Array(
            Schema.Struct({
              status: Schema.String,
              verdict: Schema.String,
              tokens: Schema.optional(Schema.NullOr(Schema.Number)),
              deliverables: Schema.Array(
                Schema.Struct({ name: Schema.String, path: Schema.String }),
              ),
            }),
          ),
          totals: Schema.Struct({ tokens: Schema.Number }),
        }),
      ),
    )(yield* fs.readFileString(path.join(stateRoot, "runs", `${handoff.run_id}.json`)));
    expect(state.state).toBe("finished");
    expect(state.tasks[0]).toMatchObject({ status: "pass", verdict: "PASS" });
    expect(state.tasks[0]?.tokens ?? 0).toBe(0);
    expect(state.totals.tokens).toBe(0);
    const diagnostic = state.tasks[0]?.deliverables.find(
      (deliverable) => deliverable.name === "diagnostic.md",
    );
    expect(diagnostic).toBeDefined();
    expect(yield* fs.readFileString(diagnostic!.path)).toContain("Model calls: 0");
  }).pipe(Effect.scoped, Effect.provide(ProcessRunnerTestLayer)),
);
