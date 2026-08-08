// @effect-diagnostics nodeBuiltinImport:off - HUD fixtures run a real Node HTTP identity server and detect python synchronously for skip decisions.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as NodeHttp from "node:http";
import { fileURLToPath } from "node:url";

import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as ChildProcess from "effect/unstable/process/ChildProcess";
import * as ChildProcessSpawner from "effect/unstable/process/ChildProcessSpawner";

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

const PYTHON_VERSION_PROBE =
  "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}'); print(sys.executable)";

const stubHandle = (pid: number, stdout = "") =>
  ChildProcessSpawner.makeHandle({
    pid: ChildProcessSpawner.ProcessId(pid),
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
    isRunning: Effect.succeed(true),
    kill: () => Effect.void,
    stdin: Sink.drain,
    stdout: stdout.length === 0 ? Stream.empty : Stream.make(new TextEncoder().encode(stdout)),
    stderr: Stream.empty,
    all: Stream.empty,
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    unref: Effect.succeed(Effect.void),
  });

const fakeSpawnerLayer = (
  onHudSpawn: (command: ChildProcess.StandardCommand) => ChildProcessSpawner.ChildProcessHandle,
) =>
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make((command) =>
      Effect.sync(() => {
        if (!ChildProcess.isStandardCommand(command)) {
          throw new Error("piped commands are not supported by this fixture");
        }
        if (command.args.some((arg) => arg.includes("sys.version_info"))) {
          return stubHandle(101, "3.13\n/fake/python3.13\n");
        }
        return onHudSpawn(command);
      }),
    ),
  );

const hudRuntimeLayer = (
  runtimeRoot: string,
  baseDir: string,
  onHudSpawn: (command: ChildProcess.StandardCommand) => ChildProcessSpawner.ChildProcessHandle,
) =>
  layerWithOptions({ runtimeRoot }).pipe(
    Layer.provide(ServerConfig.layerTest(process.cwd(), baseDir)),
    Layer.provide(FetchHttpClient.layer),
    Layer.provide(fakeSpawnerLayer(onHudSpawn)),
    Layer.provide(NodeServices.layer),
  );

const identityServer = (nonce: string) =>
  NodeHttp.createServer((request, response) => {
    if (request.url === "/api/workbench/identity") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          schema_version: 1,
          client: "ringer",
          protocol: "unlock-workbench-v1",
          instance_nonce: nonce,
        }),
      );
      return;
    }
    response.writeHead(404);
    response.end();
  });

it.effect("accepts the real pinned runtime lock and compatible Python resolver", () => {
  const pinnedRoot = fileURLToPath(new URL("../../../desktop/resources/ringer/", import.meta.url));
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
    const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));

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
      const pinnedRoot = fileURLToPath(
        new URL("../../../desktop/resources/ringer/", import.meta.url),
      );
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
    const pinnedRoot = fileURLToPath(
      new URL("../../../desktop/resources/ringer/", import.meta.url),
    );
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

it.live(
  "ensures a HUD whose identity endpoint starts answering about a second after spawn",
  () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const baseDir = yield* fs.makeTempDirectoryScoped({ prefix: "ringer-hud-slow-bind-" });
      const pinnedRoot = fileURLToPath(
        new URL("../../../desktop/resources/ringer/", import.meta.url),
      );
      const nonce = "workbench-hud-nonce-slow-bind-1";
      const servers: Array<NodeHttp.Server> = [];
      const hudPorts: Array<number> = [];
      const onHudSpawn = (command: ChildProcess.StandardCommand) => {
        const port = Number(command.args[command.args.indexOf("--port") + 1]);
        hudPorts.push(port);
        const server = identityServer(command.options.env?.RINGER_HUD_INSTANCE_NONCE ?? "");
        servers.push(server);
        // @effect-diagnostics-next-line globalTimers:off - the fake HUD binds on a real delay outside the Effect runtime, mirroring a slow first-run python start.
        setTimeout(() => server.listen(port, "127.0.0.1"), 1_000);
        return stubHandle(4_242);
      };

      yield* Effect.gen(function* () {
        const runtime = yield* RingerRuntime;
        const probe = yield* runtime.probe;
        expect(probe.available).toBe(true);
        expect(probe.runtimeDigest).toBeDefined();
        const port = yield* runtime.ensureHud({
          instanceNonce: nonce,
          expectedRuntimeDigest: probe.runtimeDigest!,
        });
        expect(hudPorts).toHaveLength(1);
        expect(port).toBe(hudPorts[0]);
        const record = yield* Schema.decodeUnknownEffect(
          Schema.fromJsonString(
            Schema.Struct({ pid: Schema.Number, port: Schema.Number, nonce: Schema.String }),
          ),
        )(
          yield* fs.readFileString(
            path.join(baseDir, "userdata", "ringer", "workbench", "hud.json"),
          ),
        );
        expect(record).toEqual({ pid: 4_242, port, nonce });
      }).pipe(
        Effect.provide(hudRuntimeLayer(pinnedRoot, baseDir, onHudSpawn)),
        Effect.ensuring(
          Effect.sync(() => {
            for (const server of servers) server.close();
          }),
        ),
      );
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  30_000,
);

it.live(
  "reuses a recorded live HUD instead of spawning a replacement",
  () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const baseDir = yield* fs.makeTempDirectoryScoped({ prefix: "ringer-hud-reuse-" });
      const pinnedRoot = fileURLToPath(
        new URL("../../../desktop/resources/ringer/", import.meta.url),
      );
      const nonce = "workbench-hud-nonce-reuse-0001";
      const server = identityServer(nonce);
      const port = yield* Effect.callback<number>((resume) => {
        server.listen(0, "127.0.0.1", () => {
          const address = server.address();
          resume(
            Effect.succeed(typeof address === "object" && address !== null ? address.port : 0),
          );
        });
      });
      const workbenchDir = path.join(baseDir, "userdata", "ringer", "workbench");
      yield* fs.makeDirectory(workbenchDir, { recursive: true });
      yield* fs.writeFileString(
        path.join(workbenchDir, "hud.json"),
        `${encodeUnknownJson({ pid: 999_999_999, port, nonce })}\n`,
      );
      const hudSpawns: Array<ChildProcess.StandardCommand> = [];
      const onHudSpawn = (command: ChildProcess.StandardCommand) => {
        hudSpawns.push(command);
        return stubHandle(4_243);
      };

      yield* Effect.gen(function* () {
        const runtime = yield* RingerRuntime;
        const probe = yield* runtime.probe;
        expect(probe.runtimeDigest).toBeDefined();
        const ensured = yield* runtime.ensureHud({
          instanceNonce: nonce,
          expectedRuntimeDigest: probe.runtimeDigest!,
        });
        expect(ensured).toBe(port);
        expect(hudSpawns).toHaveLength(0);
      }).pipe(
        Effect.provide(hudRuntimeLayer(pinnedRoot, baseDir, onHudSpawn)),
        Effect.ensuring(Effect.sync(() => server.close())),
      );
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
  30_000,
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

const resolveEndToEndPython = (): string | undefined => {
  for (const candidate of ["python3.13", "python3.12", "python3"] as const) {
    const result = spawnSync(candidate, ["-c", PYTHON_VERSION_PROBE], {
      encoding: "utf8",
      timeout: 3_000,
    });
    if (result.status !== 0 || typeof result.stdout !== "string") continue;
    const [version, executable] = result.stdout.trim().split(/\r?\n/u);
    const [major, minor] = (version ?? "").split(".").map(Number);
    if (
      major !== undefined &&
      minor !== undefined &&
      (major > 3 || (major === 3 && minor >= 12)) &&
      executable
    ) {
      return executable;
    }
  }
  return undefined;
};

const endToEndPython = resolveEndToEndPython();
if (endToEndPython === undefined) {
  // @effect-diagnostics-next-line globalConsole:off - the skip must be loud in raw vitest output, outside any Effect runtime.
  console.warn(
    "Skipping the Ringer zero-spend end-to-end test: no python >= 3.12 found (checked python3.13, python3.12, python3).",
  );
}

it.effect.skipIf(endToEndPython === undefined)(
  "runs the pinned deterministic diagnostic synchronously with zero model spend",
  () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const runner = yield* ProcessRunner.ProcessRunner;
      const pinnedRoot = fileURLToPath(
        new URL("../../../desktop/resources/ringer/", import.meta.url),
      );
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
      const pythonPath = endToEndPython!;

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
