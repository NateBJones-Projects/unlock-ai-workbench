import {
  RingerExecutionError,
  RingerUnavailableError,
  type RingerOperation,
} from "@t3tools/contracts";
import * as NetService from "@t3tools/shared/Net";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import * as SynchronizedRef from "effect/SynchronizedRef";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import * as ChildProcess from "effect/unstable/process/ChildProcess";
import * as ChildProcessSpawner from "effect/unstable/process/ChildProcessSpawner";

import * as ServerConfig from "../config.ts";
import * as ProcessRunner from "../processRunner.ts";

export interface RingerRuntimeOrigin {
  readonly client: "unlock-ai-workbench";
  readonly surface: "t3-code";
  readonly environment_id: string;
  readonly thread_id: string;
  readonly launch_id: string;
}

const RawOrigin = Schema.Struct({
  client: Schema.String,
  surface: Schema.optional(Schema.String),
  environment_id: Schema.String,
  thread_id: Schema.String,
  launch_id: Schema.String,
});

const RawDeliverable = Schema.Struct({
  name: Schema.String,
  path: Schema.String,
  bytes: Schema.optional(Schema.Number),
});

const RawTask = Schema.Struct({
  key: Schema.String,
  status: Schema.String,
  verdict: Schema.optional(Schema.String),
  engine: Schema.optional(Schema.String),
  model: Schema.optional(Schema.String),
  activity: Schema.optional(Schema.String),
  elapsed_s: Schema.optional(Schema.Number),
  tokens: Schema.optional(Schema.NullOr(Schema.Number)),
  attempts: Schema.optional(Schema.Number),
  max_attempts: Schema.optional(Schema.Number),
  check_returncode: Schema.optional(Schema.NullOr(Schema.Number)),
  check_timed_out: Schema.optional(Schema.Boolean),
  deliverables: Schema.optional(Schema.Array(RawDeliverable)),
});

export const RawRingerRunState = Schema.Struct({
  schema_version: Schema.optional(Schema.Number),
  revision: Schema.optional(Schema.Number),
  updated_at: Schema.optional(Schema.String),
  run_id: Schema.String,
  run_name: Schema.String,
  state: Schema.String,
  finished: Schema.optional(Schema.Boolean),
  started_at: Schema.String,
  tasks: Schema.Array(RawTask),
  totals: Schema.optional(
    Schema.Struct({
      running: Schema.optional(Schema.Number),
      done: Schema.optional(Schema.Number),
      pass: Schema.optional(Schema.Number),
      fail: Schema.optional(Schema.Number),
      tokens: Schema.optional(Schema.Number),
    }),
  ),
  artifact_path: Schema.optional(Schema.NullOr(Schema.String)),
  live_path: Schema.optional(Schema.NullOr(Schema.String)),
  report_path: Schema.optional(Schema.NullOr(Schema.String)),
  report_ready: Schema.optional(Schema.Boolean),
  origin: Schema.optional(RawOrigin),
});
export type RawRingerRunState = typeof RawRingerRunState.Type;

const ActiveRun = Schema.Struct({
  origin: Schema.optional(RawOrigin),
});

const RunIdHandoff = Schema.Struct({
  run_id: Schema.String,
  origin: RawOrigin,
});

const RuntimeLockFile = Schema.Struct({
  path: Schema.String,
  sha256: Schema.String,
  bytes: Schema.Number,
  mode: Schema.String,
});

const RuntimeLock = Schema.Struct({
  schema_version: Schema.Literal(1),
  product: Schema.Literal("Unlock AI Workbench"),
  runtime: Schema.Literal("Ringer"),
  content_sha256: Schema.String,
  files: Schema.Array(RuntimeLockFile),
});

const HudIdentity = Schema.Struct({
  schema_version: Schema.Literal(1),
  client: Schema.Literal("ringer"),
  protocol: Schema.Literal("unlock-workbench-v1"),
  instance_nonce: Schema.String,
});

const HudProcessRecord = Schema.Struct({
  pid: Schema.Number,
  port: Schema.Number,
  nonce: Schema.String,
});

const ScopedProof = Schema.Struct({
  verified: Schema.optional(Schema.String),
  check_output_tail: Schema.optional(Schema.String),
  setup_error: Schema.optional(Schema.String),
});
export type ScopedProof = typeof ScopedProof.Type;

export interface RingerRuntimeLaunchInput {
  readonly environmentId: string;
  readonly threadId: string;
  readonly launchId: string;
  readonly controlToken: string;
}

export interface RingerRuntimeStateInput {
  readonly environmentId: string;
  readonly threadId: string;
  readonly launchId: string;
  readonly backendRunId: string;
}

export interface RingerRuntimeCancelInput extends RingerRuntimeLaunchInput {
  readonly backendRunId: string;
  readonly hudPort: number;
}

export interface RingerRuntimeProofInput extends RingerRuntimeCancelInput {
  readonly taskKey: string;
}

export interface RingerRuntimeArtifactInput extends RingerRuntimeStateInput {
  readonly artifactPath: string;
}

export interface RingerRuntimeProbe {
  readonly available: boolean;
  readonly reason?: string;
  readonly unavailableReason?: RingerUnavailableError["reason"];
  readonly runtimeDigest?: string;
}

export class RingerRuntime extends Context.Service<
  RingerRuntime,
  {
    readonly probe: Effect.Effect<RingerRuntimeProbe>;
    readonly ensureHud: (input: {
      readonly preferredPort?: number;
      readonly instanceNonce: string;
      readonly expectedRuntimeDigest: string;
    }) => Effect.Effect<number, RingerUnavailableError | RingerExecutionError>;
    readonly launch: (
      input: RingerRuntimeLaunchInput,
    ) => Effect.Effect<void, RingerUnavailableError | RingerExecutionError>;
    readonly discoverBackendRunId: (
      input: RingerRuntimeLaunchInput,
    ) => Effect.Effect<string | undefined, RingerExecutionError>;
    readonly readState: (
      input: RingerRuntimeStateInput,
    ) => Effect.Effect<RawRingerRunState | undefined, RingerExecutionError>;
    readonly cancel: (
      input: RingerRuntimeCancelInput,
    ) => Effect.Effect<void, RingerUnavailableError | RingerExecutionError>;
    readonly readProof: (
      input: RingerRuntimeProofInput,
    ) => Effect.Effect<
      { readonly proof: ScopedProof; readonly logTail: string },
      RingerUnavailableError | RingerExecutionError
    >;
    readonly readArtifactText: (
      input: RingerRuntimeArtifactInput,
    ) => Effect.Effect<
      { readonly content: string; readonly truncated: boolean },
      RingerExecutionError
    >;
  }
>()("t3/ringer/RingerRuntime") {}

const MAX_ARTIFACT_CHARACTERS = 262_144;
const BACKEND_RUN_ID_PATTERN = /^[A-Za-z0-9_.-]+$/;
const HUD_NONCE_PATTERN = /^[A-Za-z0-9_-]{16,256}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const encodeUnknownJson = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
const compareCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const jsonString = (value: string): string => JSON.stringify(value);

export const buildFixtureConfig = (input: {
  readonly stateRoot: string;
  readonly mockWorkerPath: string;
  readonly pythonPath: string;
  readonly evalPath: string;
}): string => `state_dir = ${jsonString(input.stateRoot)}
allow_full_access = false

[artifact]
enabled = false

[eval]
backend = "jsonl"
jsonl_path = ${jsonString(input.evalPath)}

[engines.workbench_fixture]
bin = ${jsonString(input.pythonPath)}
args_template = [${jsonString(input.mockWorkerPath)}, "{spec}"]
full_access_args = []
sandbox_args = []
token_regex = ""
`;

const shellQuote = (value: string): string => `'${value.replaceAll("'", `'"'"'`)}'`;

export const buildDiagnosticManifest = (input: {
  readonly launchId: string;
  readonly workdir: string;
  readonly origin: RingerRuntimeOrigin;
  readonly pythonPath: string;
}) => ({
  run_name: `unlock-workbench-diagnostic-${input.launchId}`,
  workdir: input.workdir,
  max_parallel: 1,
  worktrees: false,
  origin: input.origin,
  tasks: [
    {
      key: "runtime-check",
      task_type: "deterministic-diagnostic",
      engine: "workbench_fixture",
      spec:
        "Run the deterministic Unlock AI Workbench integration diagnostic. This fixture performs no network requests and makes zero model calls.\n" +
        "MOCK_FILE: diagnostic.md\n" +
        "# Unlock AI Workbench Ringer Diagnostic\n\n" +
        "- Runtime: ready\n" +
        "- Orchestration: ready\n" +
        "- Verification: ready\n" +
        "- Model calls: 0\n" +
        "MOCK_END",
      check: `${shellQuote(input.pythonPath)} -c ${shellQuote(
        "from pathlib import Path; p=Path('diagnostic.md'); text=p.read_text(); assert '# Unlock AI Workbench Ringer Diagnostic' in text; assert 'Model calls: 0' in text",
      )}`,
      expect_files: ["diagnostic.md"],
      timeout_s: 60,
      max_attempts: 1,
      verified: "diagnostic.md exists and records a zero-model-call successful fixture run",
    },
  ],
});

const runtimeFailure = (
  operation: RingerOperation,
  stage: RingerExecutionError["stage"],
  runId?: string,
) =>
  new RingerExecutionError({
    operation,
    stage,
    ...(runId === undefined ? {} : { runId: runId as never }),
  });

const originMatches = (
  candidate: typeof RawOrigin.Type | undefined,
  expected: RingerRuntimeOrigin,
) =>
  candidate?.client === expected.client &&
  candidate.surface === expected.surface &&
  candidate.environment_id === expected.environment_id &&
  candidate.thread_id === expected.thread_id &&
  candidate.launch_id === expected.launch_id;

const decodeJson = <A, I, R>(schema: Schema.Codec<A, I, R>, raw: string) =>
  Schema.decodeUnknownEffect(Schema.fromJsonString(schema))(raw);

export interface RingerRuntimeOptions {
  readonly runtimeRoot?: string;
  readonly expectedRuntimeDigest?: string;
  readonly pythonCandidates?: ReadonlyArray<string>;
}

export const makeWithOptions = (options: RingerRuntimeOptions = {}) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const crypto = yield* Crypto.Crypto;
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const net = yield* NetService.NetService;
    const httpClient = yield* HttpClient.HttpClient;
    const serverConfig = yield* ServerConfig.ServerConfig;
    const processRunner = yield* ProcessRunner.ProcessRunner;

    const stateRoot = path.join(serverConfig.stateDir, "ringer");
    const integrationRoot = path.join(stateRoot, "workbench");
    const configPath = path.join(integrationRoot, "config.toml");
    const manifestsDir = path.join(integrationRoot, "manifests");
    const runIdsDir = path.join(integrationRoot, "run-ids");
    const workspacesDir = path.join(integrationRoot, "workspaces");
    const evalPath = path.join(integrationRoot, "runs.jsonl");
    const hudStatePath = path.join(integrationRoot, "hud.json");
    const hudLogPath = path.join(integrationRoot, "hud.log");
    const expectedRuntimeDigest =
      options.expectedRuntimeDigest?.trim().toLowerCase() ??
      process.env.UNLOCK_RINGER_EXPECTED_SHA256?.trim().toLowerCase();
    const configuredPython = process.env.UNLOCK_RINGER_PYTHON?.trim();
    const pythonCandidates = Array.from(
      new Set(
        (
          options.pythonCandidates ?? [configuredPython, "python3.13", "python3.12", "python3"]
        ).filter(
          (candidate): candidate is string => candidate !== undefined && candidate.length > 0,
        ),
      ),
    );
    const configuredRoot = options.runtimeRoot ?? process.env.UNLOCK_RINGER_ROOT?.trim();
    const developmentRoot = path.resolve(serverConfig.cwd, "apps/desktop/resources/ringer");
    // An explicitly configured runtime is an authority boundary. Falling back
    // after that root fails validation could silently execute a different
    // development checkout than the caller selected.
    const candidateRoots = configuredRoot ? [configuredRoot] : [developmentRoot];

    interface Installation {
      readonly ringerPath: string;
      readonly mockWorkerPath: string;
      readonly pythonPath: string;
      readonly runtimeDigest: string;
    }

    const digestHex = (bytes: Uint8Array) =>
      crypto
        .digest("SHA-256", bytes)
        .pipe(
          Effect.map((digest) =>
            Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join(""),
          ),
        );

    const listRuntimeFiles = Effect.fn("RingerRuntime.listRuntimeFiles")(function* (
      root: string,
      relative = "",
    ): Effect.fn.Return<ReadonlyArray<string>, RingerExecutionError> {
      const directory = relative.length === 0 ? root : path.join(root, ...relative.split("/"));
      const names = yield* fs
        .readDirectory(directory)
        .pipe(Effect.mapError(() => runtimeFailure("capabilities", "read-state")));
      const files: string[] = [];
      for (const name of names) {
        const childRelative = relative.length === 0 ? name : `${relative}/${name}`;
        const childPath = path.join(root, ...childRelative.split("/"));
        const info = yield* fs
          .stat(childPath)
          .pipe(Effect.mapError(() => runtimeFailure("capabilities", "read-state")));
        if (info.type === "Directory") {
          files.push(...(yield* listRuntimeFiles(root, childRelative)));
        } else if (info.type === "File") {
          files.push(childRelative);
        } else {
          return yield* runtimeFailure("capabilities", "read-state");
        }
      }
      return files.toSorted();
    });

    const verifyRuntimeBundle = (root: string) =>
      Effect.gen(function* () {
        const canonicalRoot = yield* fs.realPath(root);
        const lockRaw = yield* fs.readFileString(path.join(root, "runtime-lock.json"));
        const lock = yield* decodeJson(RuntimeLock, lockRaw);
        if (!SHA256_PATTERN.test(lock.content_sha256)) return undefined;
        if (
          expectedRuntimeDigest !== undefined &&
          expectedRuntimeDigest !== lock.content_sha256.toLowerCase()
        ) {
          return undefined;
        }
        const sortedEntries = [...lock.files].toSorted((left, right) =>
          compareCodeUnits(left.path, right.path),
        );
        const entryPaths = sortedEntries.map((entry) => entry.path);
        if (!entryPaths.includes("ringer.py") || !entryPaths.includes("engines/mock_worker.py")) {
          return undefined;
        }
        if (new Set(entryPaths).size !== entryPaths.length) return undefined;
        for (const entry of sortedEntries) {
          const segments = entry.path.split("/");
          if (
            entry.path.length === 0 ||
            entry.path.includes("\\") ||
            segments.some(
              (segment) => segment.length === 0 || segment === "." || segment === "..",
            ) ||
            !SHA256_PATTERN.test(entry.sha256) ||
            !Number.isSafeInteger(entry.bytes) ||
            entry.bytes < 0
          ) {
            return undefined;
          }
          const absolute = path.join(root, ...segments);
          const canonical = yield* fs.realPath(absolute);
          if (canonical !== canonicalRoot && !canonical.startsWith(`${canonicalRoot}${path.sep}`)) {
            return undefined;
          }
          const info = yield* fs.stat(absolute);
          if (info.type !== "File" || Number(info.size) !== entry.bytes) return undefined;
          if (
            process.platform !== "win32" &&
            (info.mode & 0o777).toString(8).padStart(3, "0") !== entry.mode
          ) {
            return undefined;
          }
          const bytes = yield* fs.readFile(absolute);
          if ((yield* digestHex(bytes)) !== entry.sha256) return undefined;
        }
        const actualPaths = yield* listRuntimeFiles(root);
        const expectedPaths = [...entryPaths, "runtime-lock.json"].toSorted();
        if (
          actualPaths.length !== expectedPaths.length ||
          actualPaths.some((actual, index) => actual !== expectedPaths[index])
        ) {
          return undefined;
        }
        const aggregate = sortedEntries
          .map((entry) => `${entry.path}\0${entry.sha256}\0${entry.bytes}`)
          .join("\n");
        return (yield* digestHex(new TextEncoder().encode(aggregate))) === lock.content_sha256
          ? lock.content_sha256
          : undefined;
      }).pipe(Effect.orElseSucceed(() => undefined));

    const resolvePython = Effect.gen(function* () {
      for (const candidate of pythonCandidates) {
        const version = yield* processRunner
          .run({
            command: candidate,
            args: [
              "-c",
              "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}'); print(sys.executable)",
            ],
            timeout: "3 seconds",
            maxOutputBytes: 128,
          })
          .pipe(Effect.option);
        if (version._tag === "None" || version.value.code !== 0) continue;
        const [versionLine, executableLine] = version.value.stdout.trim().split(/\r?\n/u);
        const [major, minor] = (versionLine ?? "").split(".").map(Number);
        if (
          major !== undefined &&
          minor !== undefined &&
          Number.isInteger(major) &&
          Number.isInteger(minor) &&
          (major > 3 || (major === 3 && minor >= 12)) &&
          executableLine !== undefined &&
          executableLine.trim().length > 0
        ) {
          return path.resolve(executableLine.trim());
        }
      }
      return undefined;
    });

    const resolveInstallationUncached = Effect.gen(function* () {
      let sawRingerWithoutFixture = false;
      let sawInvalidBundle = false;
      for (const root of candidateRoots) {
        const candidateRinger = path.join(root, "ringer.py");
        if (!(yield* fs.exists(candidateRinger).pipe(Effect.orElseSucceed(() => false)))) continue;
        const runtimeDigest = yield* verifyRuntimeBundle(root);
        if (runtimeDigest === undefined) {
          sawInvalidBundle = true;
          continue;
        }
        const candidateMock = path.join(root, "engines", "mock_worker.py");
        if (!(yield* fs.exists(candidateMock).pipe(Effect.orElseSucceed(() => false)))) {
          sawRingerWithoutFixture = true;
          continue;
        }
        const python = yield* resolvePython;
        if (python === undefined) {
          return {
            probe: {
              available: false,
              unavailableReason: "python-incompatible",
              reason:
                "Python 3.12 or newer is required. Checked UNLOCK_RINGER_PYTHON, python3.13, python3.12, and python3.",
            } satisfies RingerRuntimeProbe,
          } as const;
        }
        return {
          probe: { available: true, runtimeDigest } satisfies RingerRuntimeProbe,
          installation: {
            ringerPath: candidateRinger,
            mockWorkerPath: candidateMock,
            pythonPath: python,
            runtimeDigest,
          } satisfies Installation,
        } as const;
      }
      return {
        probe: {
          available: false,
          unavailableReason:
            sawInvalidBundle || sawRingerWithoutFixture ? "runtime-invalid" : "runtime-not-found",
          reason: sawInvalidBundle
            ? "The Ringer bundle failed its runtime-lock.json integrity check. Reinstall Workbench."
            : sawRingerWithoutFixture
              ? "The Ringer bundle is missing engines/mock_worker.py. Reinstall the Workbench runtime."
              : "Set UNLOCK_RINGER_ROOT to a locked Ringer bundle containing ringer.py and engines/mock_worker.py.",
        } satisfies RingerRuntimeProbe,
      } as const;
    });

    interface UnavailableResolution {
      readonly probe: RingerRuntimeProbe;
    }

    interface VerifiedResolution extends UnavailableResolution {
      readonly installation: Installation;
    }

    type Resolution = UnavailableResolution | VerifiedResolution;

    interface InstallationCacheEntry {
      readonly lockPath: string;
      readonly signature: string;
      readonly resolution: VerifiedResolution;
    }

    const installationCache = yield* SynchronizedRef.make<InstallationCacheEntry | undefined>(
      undefined,
    );

    const lockSignature = (lockPath: string) =>
      fs.stat(lockPath).pipe(
        Effect.map(
          (info) => `${info.mtime._tag === "Some" ? info.mtime.value.getTime() : -1}:${info.size}`,
        ),
        Effect.orElseSucceed(() => undefined),
      );

    // Bundle verification hashes every runtime file and probes python, so a
    // verified resolution is reused until runtime-lock.json changes on disk.
    // Failures are never cached.
    const resolveInstallation = SynchronizedRef.modifyEffect(
      installationCache,
      (cached): Effect.Effect<readonly [Resolution, InstallationCacheEntry | undefined]> =>
        Effect.gen(function* () {
          if (
            cached !== undefined &&
            (yield* lockSignature(cached.lockPath)) === cached.signature
          ) {
            return [cached.resolution, cached] as const;
          }
          const resolution: Resolution = yield* resolveInstallationUncached;
          if (!("installation" in resolution)) {
            return [resolution, undefined] as const;
          }
          const lockPath = path.join(
            path.dirname(resolution.installation.ringerPath),
            "runtime-lock.json",
          );
          const signature = yield* lockSignature(lockPath);
          return [
            resolution,
            signature === undefined ? undefined : { lockPath, signature, resolution },
          ] as const;
        }),
    );

    const probe = resolveInstallation.pipe(Effect.map((result) => result.probe));

    const requireRuntime = (operation: RingerOperation) =>
      resolveInstallation.pipe(
        Effect.flatMap((result) =>
          "installation" in result
            ? Effect.succeed(result.installation)
            : Effect.fail(
                new RingerUnavailableError({
                  operation,
                  reason: result.probe.unavailableReason ?? "runtime-not-found",
                }),
              ),
        ),
      );

    const runtimeEnv = (extra: Record<string, string> = {}): NodeJS.ProcessEnv => ({
      PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
      ...(process.env.HOME === undefined ? {} : { HOME: process.env.HOME }),
      ...(process.env.TMPDIR === undefined ? {} : { TMPDIR: process.env.TMPDIR }),
      LANG: process.env.LANG ?? "en_US.UTF-8",
      LC_ALL: process.env.LC_ALL ?? "en_US.UTF-8",
      RINGER_HOME: stateRoot,
      RINGER_CONFIG: configPath,
      RINGER_NO_SELF_UPDATE: "1",
      RINGER_NO_CATALOG_REFRESH: "1",
      ...extra,
    });

    const prepare = Effect.fn("RingerRuntime.prepare")(function* () {
      const installation = yield* requireRuntime("launch");
      yield* fs
        .makeDirectory(manifestsDir, { recursive: true })
        .pipe(Effect.mapError(() => runtimeFailure("launch", "prepare")));
      yield* fs
        .makeDirectory(workspacesDir, { recursive: true })
        .pipe(Effect.mapError(() => runtimeFailure("launch", "prepare")));
      yield* fs
        .makeDirectory(runIdsDir, { recursive: true })
        .pipe(Effect.mapError(() => runtimeFailure("launch", "prepare")));
      yield* fs
        .writeFileString(
          configPath,
          buildFixtureConfig({
            stateRoot,
            mockWorkerPath: installation.mockWorkerPath,
            pythonPath: installation.pythonPath,
            evalPath,
          }),
        )
        .pipe(Effect.mapError(() => runtimeFailure("launch", "prepare")));
      return installation;
    });

    const spawnDetached = Effect.fn("RingerRuntime.spawnDetached")(function* (
      command: string,
      args: ReadonlyArray<string>,
      env: NodeJS.ProcessEnv,
      operation: RingerOperation,
      logPath?: string,
    ) {
      return yield* spawner
        .spawn(
          ChildProcess.make(command, args, {
            detached: true,
            stdin: "ignore",
            stdout: logPath === undefined ? "ignore" : "pipe",
            stderr: logPath === undefined ? "ignore" : "pipe",
            env,
            extendEnv: false,
          }),
        )
        .pipe(
          Effect.tap((handle) =>
            // The detached fiber drains interleaved output into the log file
            // for the child's lifetime, truncating on each spawn.
            logPath === undefined
              ? Effect.void
              : Effect.forkDetach(
                  Stream.run(handle.all, fs.sink(logPath, { flag: "w" })).pipe(Effect.ignore),
                ),
          ),
          Effect.flatMap((handle) => Effect.as(handle.unref, handle.pid)),
          Effect.mapError(() => runtimeFailure(operation, "spawn")),
        );
    });

    const fetchHudIdentity = (port: number): Effect.Effect<typeof HudIdentity.Type | undefined> =>
      Effect.gen(function* () {
        const response = yield* httpClient.execute(
          HttpClientRequest.get(`http://127.0.0.1:${port}/api/workbench/identity`).pipe(
            HttpClientRequest.acceptJson,
          ),
        );
        if (response.status !== 200) return undefined;
        const raw = yield* response.text;
        return yield* decodeJson(HudIdentity, raw);
      }).pipe(
        Effect.timeout("500 millis"),
        Effect.orElseSucceed(() => undefined),
      );

    const hudIdentityMatches = (port: number, instanceNonce: string): Effect.Effect<boolean> =>
      fetchHudIdentity(port).pipe(
        Effect.map((identity) => identity?.instance_nonce === instanceNonce),
      );

    const readHudRecord = fs.readFileString(hudStatePath).pipe(
      Effect.flatMap((raw) => decodeJson(HudProcessRecord, raw)),
      Effect.orElseSucceed(() => undefined),
    );

    const writeHudRecord = (record: typeof HudProcessRecord.Type) =>
      fs
        .writeFileString(hudStatePath, `${encodeUnknownJson(record)}\n`)
        .pipe(Effect.mapError(() => runtimeFailure("launch", "prepare")));

    const ensureHud: RingerRuntime["Service"]["ensureHud"] = Effect.fn("RingerRuntime.ensureHud")(
      function* (input) {
        if (!HUD_NONCE_PATTERN.test(input.instanceNonce)) {
          return yield* new RingerUnavailableError({
            operation: "launch",
            reason: "hud-unavailable",
          });
        }
        const installation = yield* prepare();
        if (installation.runtimeDigest !== input.expectedRuntimeDigest) {
          return yield* new RingerUnavailableError({
            operation: "launch",
            reason: "runtime-invalid",
          });
        }
        if (
          input.preferredPort !== undefined &&
          (yield* hudIdentityMatches(input.preferredPort, input.instanceNonce))
        ) {
          return input.preferredPort;
        }
        const recorded = yield* readHudRecord;
        if (recorded !== undefined) {
          const identity = yield* fetchHudIdentity(recorded.port);
          if (identity?.instance_nonce === input.instanceNonce) {
            // A previously spawned HUD (for example one that outlived a
            // readiness timeout) is still serving this instance; reuse it.
            return recorded.port;
          }
          if (
            identity !== undefined &&
            identity.instance_nonce === recorded.nonce &&
            Number.isSafeInteger(recorded.pid) &&
            recorded.pid > 0
          ) {
            // The recorded port still answers with the recorded nonce, proving
            // the recorded pid is our superseded HUD; terminate it before
            // spawning a replacement. Any other probe result means the pid may
            // have been reused and is never signaled.
            yield* Effect.sync(() => {
              try {
                process.kill(recorded.pid);
              } catch {
                // The process exited between the probe and the signal.
              }
            });
          }
        }
        const port = yield* net
          .reserveLoopbackPort()
          .pipe(Effect.mapError(() => runtimeFailure("launch", "prepare")));
        const pid = yield* Effect.scoped(
          spawnDetached(
            installation.pythonPath,
            [
              installation.ringerPath,
              "--no-self-update",
              "hud",
              "--config",
              configPath,
              "--no-open",
              "--port",
              String(port),
            ],
            runtimeEnv({ RINGER_HUD_INSTANCE_NONCE: input.instanceNonce }),
            "launch",
            hudLogPath,
          ),
        );
        yield* writeHudRecord({ pid, port, nonce: input.instanceNonce });
        const ready = yield* hudIdentityMatches(port, input.instanceNonce).pipe(
          Effect.repeat({
            until: (alive) => alive,
            times: 150,
            schedule: Schedule.spaced("100 millis"),
          }),
          Effect.orElseSucceed(() => false),
        );
        if (!ready) {
          return yield* new RingerUnavailableError({
            operation: "launch",
            reason: "hud-unavailable",
          });
        }
        return port;
      },
    );

    const launch: RingerRuntime["Service"]["launch"] = Effect.fn("RingerRuntime.launch")(
      function* (input) {
        const installation = yield* prepare();
        const origin: RingerRuntimeOrigin = {
          client: "unlock-ai-workbench",
          surface: "t3-code",
          environment_id: input.environmentId,
          thread_id: input.threadId,
          launch_id: input.launchId,
        };
        const manifestPath = path.join(manifestsDir, `${input.launchId}.json`);
        const runIdFile = path.join(runIdsDir, `${input.launchId}.json`);
        const workdir = path.join(workspacesDir, input.launchId);
        const manifest = buildDiagnosticManifest({
          launchId: input.launchId,
          workdir,
          origin,
          pythonPath: installation.pythonPath,
        });
        yield* fs
          .writeFileString(manifestPath, `${encodeUnknownJson(manifest)}\n`)
          .pipe(Effect.mapError(() => runtimeFailure("launch", "prepare", input.launchId)));
        yield* Effect.scoped(
          spawnDetached(
            installation.pythonPath,
            [
              installation.ringerPath,
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
            runtimeEnv({
              RINGER_ORIGIN_JSON: encodeUnknownJson(origin),
              RINGER_CONTROL_TOKEN: input.controlToken,
              RINGER_RUN_ID_FILE: runIdFile,
            }),
            "launch",
          ),
        );
      },
    );

    const readJsonFile = (filePath: string, operation: RingerOperation) =>
      fs.readFileString(filePath).pipe(
        Effect.map((raw) => raw.trim()),
        Effect.catch((cause) =>
          cause.reason._tag === "NotFound"
            ? Effect.succeed(undefined)
            : Effect.fail(runtimeFailure(operation, "read-state")),
        ),
      );

    const decodeStateFile = (filePath: string) =>
      Effect.gen(function* () {
        const raw = yield* readJsonFile(filePath, "status");
        if (raw === undefined || raw.length === 0) return undefined;
        return yield* decodeJson(RawRingerRunState, raw).pipe(
          Effect.mapError(() => runtimeFailure("status", "read-state")),
        );
      });

    const discoverBackendRunId: RingerRuntime["Service"]["discoverBackendRunId"] = Effect.fn(
      "RingerRuntime.discoverBackendRunId",
    )(function* (input) {
      const origin: RingerRuntimeOrigin = {
        client: "unlock-ai-workbench",
        surface: "t3-code",
        environment_id: input.environmentId,
        thread_id: input.threadId,
        launch_id: input.launchId,
      };
      const handoffRaw = yield* readJsonFile(
        path.join(runIdsDir, `${input.launchId}.json`),
        "status",
      );
      if (handoffRaw) {
        const handoff = yield* decodeJson(RunIdHandoff, handoffRaw).pipe(
          Effect.catch(() => Effect.succeed(undefined)),
        );
        if (
          handoff !== undefined &&
          BACKEND_RUN_ID_PATTERN.test(handoff.run_id) &&
          originMatches(handoff.origin, origin)
        ) {
          return handoff.run_id;
        }
      }
      const activeRaw = yield* readJsonFile(path.join(stateRoot, "active-runs.json"), "status");
      if (activeRaw) {
        const activeUnknown = yield* decodeJson(Schema.Unknown, activeRaw).pipe(
          Effect.mapError(() => runtimeFailure("status", "discover", input.launchId)),
        );
        if (typeof activeUnknown === "object" && activeUnknown !== null) {
          for (const [backendRunId, candidate] of Object.entries(activeUnknown)) {
            const decoded = Schema.decodeUnknownOption(ActiveRun)(candidate);
            if (
              decoded._tag === "Some" &&
              BACKEND_RUN_ID_PATTERN.test(backendRunId) &&
              originMatches(decoded.value.origin, origin)
            ) {
              return backendRunId;
            }
          }
        }
      }

      // A deterministic fixture can finish before the active registry is polled.
      // This bounded one-time launch discovery is the only directory scan; after
      // attachment, polling reads exactly one run state file.
      const runsDir = path.join(stateRoot, "runs");
      const entries = yield* fs
        .readDirectory(runsDir)
        .pipe(
          Effect.catch((cause) =>
            cause.reason._tag === "NotFound"
              ? Effect.succeed([] as ReadonlyArray<string>)
              : Effect.fail(runtimeFailure("status", "discover", input.launchId)),
          ),
        );
      for (const entry of entries.slice(-256)) {
        if (!entry.endsWith(".json")) continue;
        const backendRunId = entry.slice(0, -".json".length);
        if (!BACKEND_RUN_ID_PATTERN.test(backendRunId)) continue;
        const state = yield* decodeStateFile(path.join(runsDir, entry)).pipe(
          Effect.catch(() => Effect.succeed(undefined)),
        );
        if (state && originMatches(state.origin, origin)) return backendRunId;
      }
      return undefined;
    });

    const readState: RingerRuntime["Service"]["readState"] = Effect.fn("RingerRuntime.readState")(
      function* (input) {
        if (!BACKEND_RUN_ID_PATTERN.test(input.backendRunId)) {
          return yield* runtimeFailure("status", "read-state", input.launchId);
        }
        const state = yield* decodeStateFile(
          path.join(stateRoot, "runs", `${input.backendRunId}.json`),
        );
        const expectedOrigin: RingerRuntimeOrigin = {
          client: "unlock-ai-workbench",
          surface: "t3-code",
          environment_id: input.environmentId,
          thread_id: input.threadId,
          launch_id: input.launchId,
        };
        if (
          state !== undefined &&
          (state.run_id !== input.backendRunId || !originMatches(state.origin, expectedOrigin))
        ) {
          return yield* runtimeFailure("status", "read-state", input.launchId);
        }
        return state;
      },
    );

    const cancel: RingerRuntime["Service"]["cancel"] = Effect.fn("RingerRuntime.cancel")(
      function* (input) {
        yield* requireRuntime("cancel");
        const response = yield* httpClient
          .execute(
            HttpClientRequest.post(
              `http://127.0.0.1:${input.hudPort}/api/scoped/runs/${encodeURIComponent(input.backendRunId)}/cancel`,
            ).pipe(
              HttpClientRequest.setHeaders({
                authorization: `Bearer ${input.controlToken}`,
                "x-ringer-client": "unlock-ai-workbench",
                "x-ringer-environment-id": input.environmentId,
                "x-ringer-thread-id": input.threadId,
              }),
            ),
          )
          .pipe(
            Effect.timeout("5 seconds"),
            Effect.mapError(() => runtimeFailure("cancel", "control", input.launchId)),
          );
        if (response.status < 200 || response.status >= 300) {
          return yield* runtimeFailure("cancel", "control", input.launchId);
        }
      },
    );

    const scopedHeaders = (input: RingerRuntimeLaunchInput) => ({
      authorization: `Bearer ${input.controlToken}`,
      "x-ringer-client": "unlock-ai-workbench",
      "x-ringer-environment-id": input.environmentId,
      "x-ringer-thread-id": input.threadId,
    });

    const readProof: RingerRuntime["Service"]["readProof"] = Effect.fn("RingerRuntime.readProof")(
      function* (input) {
        yield* requireRuntime("proof");
        const base =
          `http://127.0.0.1:${input.hudPort}/api/scoped/runs/` +
          `${encodeURIComponent(input.backendRunId)}/tasks/${encodeURIComponent(input.taskKey)}`;
        const [proofResponse, logResponse] = yield* Effect.all(
          [
            httpClient.execute(
              HttpClientRequest.get(`${base}/proof`).pipe(
                HttpClientRequest.setHeaders(scopedHeaders(input)),
              ),
            ),
            httpClient.execute(
              HttpClientRequest.get(`${base}/log`).pipe(
                HttpClientRequest.setHeaders(scopedHeaders(input)),
              ),
            ),
          ],
          { concurrency: "unbounded" },
        ).pipe(
          Effect.timeout("5 seconds"),
          Effect.mapError(() => runtimeFailure("proof", "control", input.launchId)),
        );
        if (
          proofResponse.status < 200 ||
          proofResponse.status >= 300 ||
          logResponse.status < 200 ||
          logResponse.status >= 300
        ) {
          return yield* runtimeFailure("proof", "control", input.launchId);
        }
        const proofRaw = yield* proofResponse.text.pipe(
          Effect.mapError(() => runtimeFailure("proof", "read-state", input.launchId)),
        );
        const logTail = yield* logResponse.text.pipe(
          Effect.mapError(() => runtimeFailure("proof", "read-state", input.launchId)),
        );
        const proof = yield* decodeJson(ScopedProof, proofRaw).pipe(
          Effect.mapError(() => runtimeFailure("proof", "read-state", input.launchId)),
        );
        return { proof, logTail: logTail.slice(-65_536) };
      },
    );

    const readArtifactText: RingerRuntime["Service"]["readArtifactText"] = Effect.fn(
      "RingerRuntime.readArtifactText",
    )(function* (input) {
      if (
        !BACKEND_RUN_ID_PATTERN.test(input.backendRunId) ||
        !BACKEND_RUN_ID_PATTERN.test(input.launchId) ||
        input.backendRunId === "." ||
        input.backendRunId === ".." ||
        input.launchId === "." ||
        input.launchId === ".."
      ) {
        return yield* runtimeFailure("artifacts", "artifact", input.launchId);
      }

      const candidate = path.resolve(input.artifactPath);
      const canonicalCandidate = yield* fs
        .realPath(candidate)
        .pipe(Effect.mapError(() => runtimeFailure("artifacts", "artifact", input.launchId)));
      const artifactsRoot = path.resolve(path.join(stateRoot, "artifacts"));
      const workspaceRoot = path.resolve(workspacesDir);
      const sanitizedBackendRunId = input.backendRunId
        .replace(/[^A-Za-z0-9._-]+/gu, "-")
        .replace(/^[.-]+|[.-]+$/gu, "");
      const artifactIdentity = sanitizedBackendRunId || "artifact";
      const scopedRoots = [
        {
          base: artifactsRoot,
          root: path.join(artifactsRoot, "deliverables", artifactIdentity),
          relative: ["deliverables", artifactIdentity],
        },
        {
          base: artifactsRoot,
          root: path.join(artifactsRoot, "versions", artifactIdentity),
          relative: ["versions", artifactIdentity],
        },
        {
          base: workspaceRoot,
          root: path.join(workspaceRoot, input.launchId),
          relative: [input.launchId],
        },
      ];
      const exactArtifactPaths = [
        path.join(artifactsRoot, `${artifactIdentity}.html`),
        path.join(artifactsRoot, `${artifactIdentity}-report.html`),
        path.join(artifactsRoot, "live", `${artifactIdentity}.html`),
      ].map((artifactPath) => path.resolve(artifactPath));
      const isWithin = (root: string, target: string) =>
        target !== root && target.startsWith(`${root}${path.sep}`);

      let allowedByScopedRoot = false;
      for (const scoped of scopedRoots) {
        if (!isWithin(path.resolve(scoped.root), candidate)) continue;
        const canonical = yield* Effect.all({
          base: fs.realPath(scoped.base).pipe(Effect.option),
          root: fs.realPath(scoped.root).pipe(Effect.option),
        });
        if (
          canonical.base._tag === "Some" &&
          canonical.root._tag === "Some" &&
          canonical.root.value ===
            path.resolve(path.join(canonical.base.value, ...scoped.relative)) &&
          isWithin(canonical.base.value, canonical.root.value) &&
          isWithin(canonical.root.value, canonicalCandidate)
        ) {
          allowedByScopedRoot = true;
          break;
        }
      }
      const exactMatch = exactArtifactPaths.includes(candidate);
      const allowedByExactPath = exactMatch
        ? yield* fs.realPath(artifactsRoot).pipe(
            Effect.map((canonicalRoot) => isWithin(canonicalRoot, canonicalCandidate)),
            Effect.orElseSucceed(() => false),
          )
        : false;
      const allowed = allowedByScopedRoot || allowedByExactPath;
      if (!allowed) {
        return yield* runtimeFailure("artifacts", "artifact", input.launchId);
      }
      const content = yield* fs
        .readFileString(canonicalCandidate)
        .pipe(Effect.mapError(() => runtimeFailure("artifacts", "artifact", input.launchId)));
      return content.length > MAX_ARTIFACT_CHARACTERS
        ? { content: content.slice(0, MAX_ARTIFACT_CHARACTERS), truncated: true }
        : { content, truncated: false };
    });

    return RingerRuntime.of({
      probe,
      ensureHud,
      launch,
      discoverBackendRunId,
      readState,
      cancel,
      readProof,
      readArtifactText,
    });
  });

export const layerWithOptions = (options: RingerRuntimeOptions = {}) =>
  Layer.effect(RingerRuntime, makeWithOptions(options)).pipe(
    Layer.provide(ProcessRunner.layer),
    Layer.provide(NetService.layer),
  );

export const layer = layerWithOptions();
