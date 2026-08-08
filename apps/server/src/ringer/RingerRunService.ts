import {
  EnvironmentId,
  RINGER_WORKBENCH_DIAGNOSTIC_TEMPLATE_ID,
  RingerArtifactId,
  RingerExecutionError,
  RingerMemberId,
  RingerOperationUnsupportedError,
  RingerRunId,
  RingerRunNotDismissableError,
  RingerRunNotFoundError,
  RingerUnavailableError,
  ThreadId,
  type RingerArtifactContent,
  type RingerArtifactDescriptor,
  type RingerArtifactList,
  type RingerArtifactReadInput,
  type RingerCapabilitySnapshot,
  type RingerGateInput,
  type RingerLaunchInput,
  type RingerMemberProjection,
  type RingerProofInput,
  type RingerProofDetail,
  type RingerProofSummary,
  type RingerRetryInput,
  type RingerRunProjection,
  type RingerRunTargetInput,
  type RingerTemplateDescriptor,
  type RingerThreadEvent,
  type RingerThreadRunsEvent,
  type RingerThreadInput,
  type RingerThreadRunList,
  type RingerError,
} from "@t3tools/contracts";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as PubSub from "effect/PubSub";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Stream from "effect/Stream";
import * as SynchronizedRef from "effect/SynchronizedRef";

import { writeFileStringAtomically } from "../atomicWrite.ts";
import * as ServerConfig from "../config.ts";
import * as ServerEnvironment from "../environment/ServerEnvironment.ts";
import { subscribeBeforeSnapshotWithoutMutex } from "../utils/subscribeBeforeSnapshot.ts";
import {
  type RawRingerRunState,
  RingerRuntime,
  layer as RingerRuntimeLayer,
} from "./RingerRuntime.ts";

const TEMPLATE: RingerTemplateDescriptor = {
  id: RINGER_WORKBENCH_DIAGNOSTIC_TEMPLATE_ID,
  name: "Ringer integration diagnostic",
  description:
    "Exercises Ringer launch, live state, verification, and artifact collection with a deterministic fixture and zero model calls.",
  executionStrategy: "deterministic-diagnostic",
  agentBacked: false,
  estimatedAgentCalls: 0,
};

const CANCEL_SUPPORTED = process.platform === "darwin";
const OPERATIONS = {
  launch: true,
  cancel: CANCEL_SUPPORTED,
  retry: false,
  gate: false,
};

const TERMINAL_STATUS_VALUES = ["canceled", "succeeded", "failed", "lost"] as const;
const TERMINAL_STATUSES = new Set<RingerRunProjection["status"]>(TERMINAL_STATUS_VALUES);
const LOST_AFTER_MS = 30_000;
const LOST_RECHECK_EVERY_TICKS = 10;

const PersistedTerminalSnapshot = Schema.Struct({
  status: Schema.Literals(TERMINAL_STATUS_VALUES),
  name: Schema.String,
  finishedAt: Schema.String,
  totals: Schema.Struct({
    total: Schema.Number,
    queued: Schema.Number,
    active: Schema.Number,
    passed: Schema.Number,
    failed: Schema.Number,
    tokens: Schema.Number,
  }),
});
type PersistedTerminalSnapshot = typeof PersistedTerminalSnapshot.Type;

const PersistedAttachment = Schema.Struct({
  publicRunId: Schema.String,
  backendRunId: Schema.optional(Schema.String),
  environmentId: Schema.String,
  threadId: Schema.String,
  templateId: Schema.Literal(RINGER_WORKBENCH_DIAGNOSTIC_TEMPLATE_ID),
  controlToken: Schema.String,
  createdAt: Schema.String,
  createdAtMs: Schema.Number,
  cancelRequestedAt: Schema.optional(Schema.String),
  terminal: Schema.optional(PersistedTerminalSnapshot),
});
type PersistedAttachment = typeof PersistedAttachment.Type;

const PersistedRingerState = Schema.Struct({
  version: Schema.Literal(1),
  hudPort: Schema.optional(Schema.Number),
  hudNonce: Schema.optional(Schema.String),
  hudRuntimeDigest: Schema.optional(Schema.String),
  attachments: Schema.Array(PersistedAttachment),
});
type PersistedRingerState = typeof PersistedRingerState.Type;

interface ServiceState {
  readonly hudPort?: number;
  readonly hudNonce?: string;
  readonly hudRuntimeDigest?: string;
  readonly attachments: ReadonlyMap<string, PersistedAttachment>;
  readonly projections: ReadonlyMap<string, RingerRunProjection>;
}

export class RingerRunService extends Context.Service<
  RingerRunService,
  {
    readonly capabilities: (input: RingerThreadInput) => Effect.Effect<RingerCapabilitySnapshot>;
    readonly list: (input: RingerThreadInput) => Effect.Effect<RingerThreadRunList, RingerError>;
    readonly launch: (input: RingerLaunchInput) => Effect.Effect<RingerRunProjection, RingerError>;
    readonly status: (
      input: RingerRunTargetInput,
    ) => Effect.Effect<RingerRunProjection, RingerError>;
    readonly cancel: (
      input: RingerRunTargetInput,
    ) => Effect.Effect<RingerRunProjection, RingerError>;
    readonly dismiss: (input: RingerRunTargetInput) => Effect.Effect<void, RingerError>;
    readonly retry: (input: RingerRetryInput) => Effect.Effect<RingerRunProjection, RingerError>;
    readonly gate: (input: RingerGateInput) => Effect.Effect<RingerRunProjection, RingerError>;
    readonly proof: (input: RingerProofInput) => Effect.Effect<RingerProofDetail, RingerError>;
    readonly listArtifacts: (
      input: RingerRunTargetInput,
    ) => Effect.Effect<RingerArtifactList, RingerError>;
    readonly readArtifact: (
      input: RingerArtifactReadInput,
    ) => Effect.Effect<RingerArtifactContent, RingerError>;
    readonly observe: (input: RingerThreadInput) => Stream.Stream<RingerThreadEvent, RingerError>;
  }
>()("t3/ringer/RingerRunService") {}

const nowIso = DateTime.now.pipe(Effect.map(DateTime.formatIso));

const mediaTypeForName = (name: string): string => {
  const normalized = name.toLowerCase();
  if (normalized.endsWith(".html") || normalized.endsWith(".htm")) return "text/html";
  if (normalized.endsWith(".json")) return "application/json";
  if (normalized.endsWith(".csv")) return "text/csv";
  if (normalized.endsWith(".md")) return "text/markdown";
  if (normalized.endsWith(".txt") || normalized.endsWith(".log")) return "text/plain";
  return "application/octet-stream";
};

const isTextMediaType = (mediaType: string): boolean =>
  mediaType.startsWith("text/") || mediaType === "application/json";

const safeName = (value: string, fallback: string, max = 160): string => {
  const normalized = value.trim();
  return (normalized.length > 0 ? normalized : fallback).slice(0, max);
};

const safeArtifactName = (value: string, fallback: string): string => {
  const leaf = value.split(/[\\/]/u).at(-1) ?? "";
  return safeName(leaf, fallback, 255);
};

const memberStatus = (status: string, canceled: boolean): RingerMemberProjection["status"] => {
  if (canceled && status === "fail") return "canceled";
  switch (status) {
    case "running":
      return "running";
    case "retrying":
      return "retrying";
    case "verifying":
      return "verifying";
    case "pass":
      return "passed";
    case "fail":
      return "failed";
    default:
      return "queued";
  }
};

const proofForTask = (
  task: RawRingerRunState["tasks"][number],
  memberId: RingerMemberId,
): RingerProofSummary => {
  const rawVerdict = task.verdict?.toUpperCase();
  const verdict: RingerProofSummary["verdict"] =
    rawVerdict === "PASS"
      ? "pass"
      : rawVerdict === "FAIL"
        ? "fail"
        : rawVerdict === "ERROR"
          ? "error"
          : rawVerdict === "TIMEOUT"
            ? "timeout"
            : "pending";
  const checkStatus: RingerProofSummary["checkStatus"] = task.check_timed_out
    ? "timed-out"
    : task.status === "verifying"
      ? "running"
      : task.check_returncode === 0
        ? "passed"
        : task.check_returncode !== undefined && task.check_returncode !== null
          ? "failed"
          : task.status === "queued" || task.status === "running" || task.status === "retrying"
            ? "pending"
            : "unavailable";
  return {
    memberId,
    verdict,
    checkStatus,
    ...(task.check_returncode === undefined ? {} : { exitCode: task.check_returncode }),
    evidenceAvailable: verdict !== "pending" || checkStatus !== "pending",
  };
};

interface InternalArtifact {
  readonly descriptor: RingerArtifactDescriptor;
  readonly path: string;
}

const artifactsFromRawState = (raw: RawRingerRunState): ReadonlyArray<InternalArtifact> => {
  const artifacts: InternalArtifact[] = [];
  let ordinal = 1;
  raw.tasks.forEach((task, taskIndex) => {
    const memberId = RingerMemberId.make(`member-${taskIndex + 1}`);
    for (const deliverable of task.deliverables ?? []) {
      const name = safeArtifactName(deliverable.name, `Artifact ${ordinal}`);
      const mediaType = mediaTypeForName(name);
      if (!isTextMediaType(mediaType)) continue;
      artifacts.push({
        descriptor: {
          id: RingerArtifactId.make(`artifact-${ordinal}`),
          memberId,
          name,
          kind: "deliverable",
          mediaType,
          ...(deliverable.bytes === undefined
            ? {}
            : { sizeBytes: Math.max(0, Math.round(deliverable.bytes)) }),
        },
        path: deliverable.path,
      });
      ordinal += 1;
    }
  });
  const topLevel = [
    [raw.live_path, "live-report", "Live report"],
    [raw.report_path, "final-report", "Final report"],
  ] as const;
  for (const [artifactPath, kind, label] of topLevel) {
    if (!artifactPath) continue;
    const mediaType = mediaTypeForName(artifactPath);
    if (!isTextMediaType(mediaType)) continue;
    const extension = artifactPath.slice(artifactPath.lastIndexOf(".")).toLowerCase();
    const name = `${label}${extension}`;
    artifacts.push({
      descriptor: {
        id: RingerArtifactId.make(`artifact-${ordinal}`),
        name,
        kind,
        mediaType,
      },
      path: artifactPath,
    });
    ordinal += 1;
  }
  return artifacts;
};

const queuedProjection = (attachment: PersistedAttachment): RingerRunProjection => ({
  version: 1,
  revision: 0,
  runId: RingerRunId.make(attachment.publicRunId),
  environmentId: EnvironmentId.make(attachment.environmentId),
  threadId: ThreadId.make(attachment.threadId),
  templateId: attachment.templateId,
  name: TEMPLATE.name,
  status: attachment.cancelRequestedAt ? "canceling" : "queued",
  startedAt: attachment.createdAt,
  updatedAt: attachment.cancelRequestedAt ?? attachment.createdAt,
  finishedAt: null,
  operations: { ...OPERATIONS },
  totals: { total: 1, queued: 1, active: 0, passed: 0, failed: 0, tokens: 0 },
  members: [],
  artifacts: [],
});

const terminalProjection = (
  attachment: PersistedAttachment,
  terminal: PersistedTerminalSnapshot,
): RingerRunProjection => ({
  ...queuedProjection(attachment),
  name: safeName(terminal.name, TEMPLATE.name),
  status: terminal.status,
  updatedAt: terminal.finishedAt,
  finishedAt: terminal.finishedAt,
  operations: { ...OPERATIONS, cancel: false },
  totals: {
    total: Math.max(0, Math.round(terminal.totals.total)),
    queued: Math.max(0, Math.round(terminal.totals.queued)),
    active: Math.max(0, Math.round(terminal.totals.active)),
    passed: Math.max(0, Math.round(terminal.totals.passed)),
    failed: Math.max(0, Math.round(terminal.totals.failed)),
    tokens: Math.max(0, Math.round(terminal.totals.tokens)),
  },
});

const terminalSnapshotFor = (
  projection: RingerRunProjection,
): PersistedTerminalSnapshot | undefined =>
  TERMINAL_STATUSES.has(projection.status)
    ? {
        status: projection.status as PersistedTerminalSnapshot["status"],
        name: projection.name,
        finishedAt: projection.finishedAt ?? projection.updatedAt,
        totals: projection.totals,
      }
    : undefined;

export const projectRingerState = (input: {
  readonly attachment: PersistedAttachment;
  readonly raw: RawRingerRunState;
  readonly revision: number;
}): RingerRunProjection => {
  const canceled = input.attachment.cancelRequestedAt !== undefined;
  const finished = input.raw.finished === true || input.raw.state === "finished";
  const allPassed =
    input.raw.tasks.length > 0 && input.raw.tasks.every((task) => task.status === "pass");
  const status: RingerRunProjection["status"] = finished
    ? canceled
      ? "canceled"
      : allPassed
        ? "succeeded"
        : "failed"
    : canceled
      ? "canceling"
      : "running";
  const internalArtifacts = artifactsFromRawState(input.raw);
  const members = input.raw.tasks.map((task, index): RingerMemberProjection => {
    const id = RingerMemberId.make(`member-${index + 1}`);
    const artifacts = internalArtifacts
      .map((artifact) => artifact.descriptor)
      .filter((artifact) => artifact.memberId === id);
    return {
      id,
      name: safeName(task.key, `Agent ${index + 1}`),
      status: memberStatus(task.status, canceled),
      ...(task.engine?.trim() ? { engine: safeName(task.engine, "engine", 120) } : {}),
      ...(task.model?.trim() ? { model: safeName(task.model, "model", 200) } : {}),
      attempt: Math.max(0, Math.round(task.attempts ?? 0)),
      maxAttempts: Math.max(1, Math.round(task.max_attempts ?? 1)),
      elapsedSeconds: Math.max(0, Math.round(task.elapsed_s ?? 0)),
      tokens: Math.max(0, Math.round(task.tokens ?? 0)),
      ...(task.activity?.trim() ? { activity: safeName(task.activity, "Working", 512) } : {}),
      proof: proofForTask(task, id),
      artifacts,
    };
  });
  const passed = members.filter((member) => member.status === "passed").length;
  const failed = members.filter(
    (member) => member.status === "failed" || member.status === "canceled",
  ).length;
  const active = members.filter((member) =>
    ["running", "retrying", "verifying"].includes(member.status),
  ).length;
  const queued = members.filter((member) => member.status === "queued").length;
  const updatedAt = input.raw.updated_at ?? input.raw.started_at;
  return {
    version: 1,
    revision: input.revision,
    runId: RingerRunId.make(input.attachment.publicRunId),
    environmentId: EnvironmentId.make(input.attachment.environmentId),
    threadId: ThreadId.make(input.attachment.threadId),
    templateId: input.attachment.templateId,
    name: safeName(input.raw.run_name, TEMPLATE.name),
    status,
    startedAt: input.raw.started_at,
    updatedAt,
    finishedAt: finished ? updatedAt : null,
    operations: {
      ...OPERATIONS,
      cancel: CANCEL_SUPPORTED && (status === "running" || status === "canceling"),
    },
    totals: {
      total: members.length,
      queued,
      active,
      passed,
      failed,
      tokens: members.reduce((sum, member) => sum + member.tokens, 0),
    },
    members,
    artifacts: internalArtifacts.map((artifact) => artifact.descriptor),
  };
};

const projectionMaterial = (projection: RingerRunProjection): string => {
  const { revision: _revision, ...material } = projection;
  return JSON.stringify(material);
};

const scrubEvidence = (value: string, limit: number): string =>
  value
    .replace(/\bpid\s*[=:]\s*\d+/gi, "pid=[redacted]")
    .replace(/(?:\/[A-Za-z0-9_. -]+){3,}/g, "[local path]")
    .replace(/[A-Za-z]:\\(?:[^\s'\"]+\\)+[^\s'\"]+/g, "[local path]")
    .slice(-limit);

export const make = Effect.gen(function* () {
  const runtime = yield* RingerRuntime;
  const config = yield* ServerConfig.ServerConfig;
  const environment = yield* ServerEnvironment.ServerEnvironment;
  const environmentId = yield* environment.getEnvironmentId;
  const crypto = yield* Crypto.Crypto;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const persistedPath = path.join(config.stateDir, "ringer-attachments.json");
  const events = yield* PubSub.unbounded<RingerThreadEvent>();
  const hudMutex = yield* Semaphore.make(1);

  const loadPersisted: Effect.Effect<PersistedRingerState> = fs.readFileString(persistedPath).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(Schema.fromJsonString(PersistedRingerState))),
    Effect.orElseSucceed((): PersistedRingerState => ({ version: 1, attachments: [] })),
  );
  const persisted = yield* loadPersisted;
  const matchingAttachments = persisted.attachments.filter(
    (attachment) => attachment.environmentId === environmentId,
  );
  const initialAttachments = new Map(
    matchingAttachments.map((attachment) => [attachment.publicRunId, attachment]),
  );
  const initialProjections = new Map(
    matchingAttachments.map((attachment) => [
      attachment.publicRunId,
      attachment.terminal
        ? terminalProjection(attachment, attachment.terminal)
        : queuedProjection(attachment),
    ]),
  );
  const stateRef = yield* SynchronizedRef.make<ServiceState>({
    ...(persisted.hudPort === undefined ? {} : { hudPort: persisted.hudPort }),
    ...(persisted.hudNonce === undefined ? {} : { hudNonce: persisted.hudNonce }),
    ...(persisted.hudRuntimeDigest === undefined
      ? {}
      : { hudRuntimeDigest: persisted.hudRuntimeDigest }),
    attachments: initialAttachments,
    projections: initialProjections,
  });

  const persist = (state: ServiceState) =>
    writeFileStringAtomically({
      filePath: persistedPath,
      mode: 0o600,
      contents: `${JSON.stringify({
        version: 1,
        ...(state.hudPort === undefined ? {} : { hudPort: state.hudPort }),
        ...(state.hudNonce === undefined ? {} : { hudNonce: state.hudNonce }),
        ...(state.hudRuntimeDigest === undefined
          ? {}
          : { hudRuntimeDigest: state.hudRuntimeDigest }),
        attachments: Array.from(state.attachments.values()),
      } satisfies PersistedRingerState)}\n`,
    }).pipe(
      Effect.mapError(() => new RingerExecutionError({ operation: "status", stage: "persist" })),
      Effect.provideService(FileSystem.FileSystem, fs),
      Effect.provideService(Path.Path, path),
    );

  const setHudIdentity = (hudPort: number, hudNonce: string, hudRuntimeDigest: string) =>
    SynchronizedRef.modifyEffect(stateRef, (state) => {
      const next = { ...state, hudPort, hudNonce, hudRuntimeDigest };
      return persist(next).pipe(Effect.as([hudPort, next] as const));
    });

  const setPendingHudIdentity = (hudNonce: string, hudRuntimeDigest: string) =>
    SynchronizedRef.modifyEffect(stateRef, (state) => {
      const { hudPort: _hudPort, ...rest } = state;
      const next = { ...rest, hudNonce, hudRuntimeDigest };
      return persist(next).pipe(Effect.as([hudNonce, next] as const));
    });

  const ensureManagedHud = hudMutex.withPermits(1)(
    Effect.gen(function* () {
      const state = yield* SynchronizedRef.get(stateRef);
      const probe = yield* runtime.probe;
      if (!probe.available || probe.runtimeDigest === undefined) {
        return yield* new RingerUnavailableError({
          operation: "launch",
          reason: probe.unavailableReason ?? "runtime-invalid",
        });
      }
      const runtimeMatches = state.hudRuntimeDigest === probe.runtimeDigest;
      const persistedNonce = runtimeMatches ? state.hudNonce : undefined;
      const hudNonce =
        persistedNonce ??
        (yield* crypto.randomBytes(32).pipe(
          Effect.map((bytes) => Buffer.from(bytes).toString("base64url")),
          Effect.mapError(
            () => new RingerExecutionError({ operation: "launch", stage: "prepare" }),
          ),
        ));
      if (persistedNonce === undefined) {
        yield* setPendingHudIdentity(hudNonce, probe.runtimeDigest);
      }
      const hudPort = yield* runtime.ensureHud({
        ...(runtimeMatches && state.hudPort !== undefined ? { preferredPort: state.hudPort } : {}),
        instanceNonce: hudNonce,
        expectedRuntimeDigest: probe.runtimeDigest,
      });
      if (
        state.hudPort !== hudPort ||
        state.hudNonce !== hudNonce ||
        state.hudRuntimeDigest !== probe.runtimeDigest
      ) {
        yield* setHudIdentity(hudPort, hudNonce, probe.runtimeDigest);
      }
      return hudPort;
    }),
  );

  const lookupAttachment = (input: RingerRunTargetInput) =>
    SynchronizedRef.get(stateRef).pipe(
      Effect.flatMap((state) => {
        const attachment = state.attachments.get(input.runId);
        return attachment?.threadId === input.threadId
          ? Effect.succeed(attachment)
          : Effect.fail(
              new RingerRunNotFoundError({
                operation: "status",
                threadId: input.threadId,
                runId: input.runId,
              }),
            );
      }),
    );

  const commitAttachment = (attachment: PersistedAttachment) =>
    SynchronizedRef.modifyEffect(stateRef, (state) => {
      const attachments = new Map(state.attachments);
      attachments.set(attachment.publicRunId, attachment);
      const next = { ...state, attachments };
      return persist(next).pipe(Effect.as([attachment, next] as const));
    });

  const commitProjection = (projection: RingerRunProjection) =>
    SynchronizedRef.modifyEffect(stateRef, (state) => {
      if (!state.attachments.has(projection.runId)) {
        // The run was dismissed while this refresh was in flight; committing
        // would resurrect a projection with no backing attachment.
        return Effect.succeed([projection, state] as const);
      }
      const previous = state.projections.get(projection.runId);
      if (previous && projectionMaterial(previous) === projectionMaterial(projection)) {
        return Effect.succeed([previous, state] as const);
      }
      const nextProjection = {
        ...projection,
        revision: (previous?.revision ?? -1) + 1,
      };
      const projections = new Map(state.projections);
      projections.set(projection.runId, nextProjection);
      let next = { ...state, projections };
      const attachment = state.attachments.get(projection.runId);
      const terminal = terminalSnapshotFor(nextProjection);
      const terminalChanged =
        attachment !== undefined &&
        JSON.stringify(attachment.terminal) !== JSON.stringify(terminal);
      if (attachment && terminalChanged) {
        const attachments = new Map(state.attachments);
        const { terminal: _terminal, ...rest } = attachment;
        attachments.set(attachment.publicRunId, terminal ? { ...rest, terminal } : rest);
        next = { ...next, attachments };
      }
      const threadRuns = Array.from(projections.values())
        .filter((candidate) => candidate.threadId === nextProjection.threadId)
        .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
      return (terminalChanged ? persist(next) : Effect.void).pipe(
        Effect.andThen(
          PubSub.publish(events, {
            type: "snapshot",
            threadId: nextProjection.threadId,
            runs: threadRuns,
          }),
        ),
        Effect.as([nextProjection, next] as const),
      );
    });

  const markLost = Effect.fn("RingerRunService.markLost")(function* (
    attachment: PersistedAttachment,
  ) {
    const previous = (yield* SynchronizedRef.get(stateRef)).projections.get(attachment.publicRunId);
    if (previous?.status === "lost") return previous;
    const timestamp = yield* nowIso;
    return yield* commitProjection({
      ...(previous ?? queuedProjection(attachment)),
      revision: previous?.revision ?? 0,
      status: "lost",
      updatedAt: timestamp,
      finishedAt: timestamp,
      operations: { ...OPERATIONS, cancel: false },
    });
  });

  const refreshAttachment = Effect.fn("RingerRunService.refreshAttachment")(function* (
    currentAttachment: PersistedAttachment,
  ) {
    const settled = (yield* SynchronizedRef.get(stateRef)).projections.get(
      currentAttachment.publicRunId,
    );
    if (settled && TERMINAL_STATUSES.has(settled.status) && settled.status !== "lost") {
      return settled;
    }
    let attachment = currentAttachment;
    if (!attachment.backendRunId) {
      const backendRunId = yield* runtime.discoverBackendRunId({
        environmentId: attachment.environmentId,
        threadId: attachment.threadId,
        launchId: attachment.publicRunId,
        controlToken: attachment.controlToken,
      });
      if (backendRunId) {
        attachment = { ...attachment, backendRunId };
        yield* commitAttachment(attachment);
      }
    }
    if (!attachment.backendRunId) {
      const now = yield* Clock.currentTimeMillis;
      if (now - attachment.createdAtMs >= LOST_AFTER_MS) return yield* markLost(attachment);
      return (
        (yield* SynchronizedRef.get(stateRef)).projections.get(attachment.publicRunId) ??
        queuedProjection(attachment)
      );
    }
    const raw = yield* runtime.readState({
      environmentId: attachment.environmentId,
      threadId: attachment.threadId,
      launchId: attachment.publicRunId,
      backendRunId: attachment.backendRunId,
    });
    if (!raw) return yield* markLost(attachment);
    const previous = (yield* SynchronizedRef.get(stateRef)).projections.get(attachment.publicRunId);
    return yield* commitProjection(
      projectRingerState({
        attachment,
        raw,
        revision: previous?.revision ?? 0,
      }),
    );
  });

  const refreshThread = Effect.fn("RingerRunService.refreshThread")(function* (threadId: string) {
    const snapshot = yield* SynchronizedRef.get(stateRef);
    const attachments = Array.from(snapshot.attachments.values()).filter(
      (attachment) => attachment.threadId === threadId,
    );
    yield* Effect.forEach(
      attachments,
      (attachment) => {
        const current = snapshot.projections.get(attachment.publicRunId);
        if (current && TERMINAL_STATUSES.has(current.status)) return Effect.void;
        return refreshAttachment(attachment).pipe(
          Effect.catch((error) =>
            Effect.logWarning("Failed to refresh a thread-scoped Ringer run", {
              runId: attachment.publicRunId,
              errorTag: error._tag,
            }),
          ),
          Effect.asVoid,
        );
      },
      { concurrency: 4, discard: true },
    );
  });

  const list: RingerRunService["Service"]["list"] = Effect.fn("RingerRunService.list")(
    function* (input) {
      yield* refreshThread(input.threadId);
      const state = yield* SynchronizedRef.get(stateRef);
      const runs = Array.from(state.projections.values())
        .filter((projection) => projection.threadId === input.threadId)
        .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
      return { threadId: input.threadId, runs };
    },
  );

  const capabilities: RingerRunService["Service"]["capabilities"] = Effect.fn(
    "RingerRunService.capabilities",
  )(function* (_input) {
    const probe = yield* runtime.probe;
    return {
      available: probe.available,
      ...(probe.available
        ? CANCEL_SUPPORTED
          ? {}
          : { reason: "Ringer cancellation is disabled on this platform in Workbench V1." }
        : { reason: probe.reason ?? "Ringer runtime is unavailable." }),
      operations: probe.available
        ? OPERATIONS
        : { launch: false, cancel: false, retry: false, gate: false },
      templates: [TEMPLATE],
    };
  });

  const launch: RingerRunService["Service"]["launch"] = Effect.fn("RingerRunService.launch")(
    function* (input) {
      const probe = yield* runtime.probe;
      if (!probe.available) {
        return yield* new RingerUnavailableError({
          operation: "launch",
          reason: probe.unavailableReason ?? "runtime-not-found",
        });
      }
      const publicRunId = yield* crypto.randomUUIDv4.pipe(
        Effect.map(RingerRunId.make),
        Effect.mapError(() => new RingerExecutionError({ operation: "launch", stage: "prepare" })),
      );
      const controlToken = yield* crypto.randomBytes(32).pipe(
        Effect.map((bytes) => Buffer.from(bytes).toString("base64url")),
        Effect.mapError(() => new RingerExecutionError({ operation: "launch", stage: "prepare" })),
      );
      const createdAt = yield* nowIso;
      const createdAtMs = yield* Clock.currentTimeMillis;
      const attachment: PersistedAttachment = {
        publicRunId,
        environmentId,
        threadId: input.threadId,
        templateId: input.templateId,
        controlToken,
        createdAt,
        createdAtMs,
      };
      yield* commitAttachment(attachment);
      const initial = yield* commitProjection(queuedProjection(attachment));
      yield* Effect.gen(function* () {
        yield* ensureManagedHud;
        yield* runtime.launch({
          environmentId,
          threadId: input.threadId,
          launchId: publicRunId,
          controlToken,
        });
      }).pipe(
        Effect.catch((error) => markLost(attachment).pipe(Effect.andThen(Effect.fail(error)))),
      );
      return initial;
    },
  );

  const status: RingerRunService["Service"]["status"] = Effect.fn("RingerRunService.status")(
    function* (input) {
      const attachment = yield* lookupAttachment(input);
      return yield* refreshAttachment(attachment);
    },
  );

  const cancel: RingerRunService["Service"]["cancel"] = Effect.fn("RingerRunService.cancel")(
    function* (input) {
      if (!CANCEL_SUPPORTED) {
        return yield* new RingerUnavailableError({
          operation: "cancel",
          reason: "not-configured",
        });
      }
      let attachment = yield* lookupAttachment(input);
      let projection = yield* refreshAttachment(attachment);
      if (TERMINAL_STATUSES.has(projection.status)) return projection;
      attachment =
        (yield* SynchronizedRef.get(stateRef)).attachments.get(input.runId) ?? attachment;
      const backendRunId = attachment.backendRunId;
      if (!backendRunId) {
        return yield* new RingerExecutionError({
          operation: "cancel",
          stage: "discover",
          runId: input.runId,
        });
      }
      const cancelRequestedAt = yield* nowIso;
      attachment = { ...attachment, cancelRequestedAt };
      yield* commitAttachment(attachment);
      projection = yield* commitProjection({
        ...projection,
        status: "canceling",
        updatedAt: cancelRequestedAt,
        operations: { ...projection.operations, cancel: CANCEL_SUPPORTED },
      });
      yield* Effect.gen(function* () {
        const hudPort = yield* ensureManagedHud;
        yield* runtime.cancel({
          environmentId,
          threadId: input.threadId,
          launchId: input.runId,
          backendRunId,
          controlToken: attachment.controlToken,
          hudPort,
        });
      }).pipe(
        Effect.catch((error) =>
          Effect.gen(function* () {
            const current = (yield* SynchronizedRef.get(stateRef)).attachments.get(input.runId);
            if (current?.cancelRequestedAt === cancelRequestedAt) {
              const { cancelRequestedAt: _cancelRequestedAt, ...rest } = current;
              yield* commitAttachment(rest);
              yield* refreshAttachment(rest).pipe(Effect.ignore);
            }
          }).pipe(Effect.andThen(Effect.fail(error))),
        ),
      );
      return projection;
    },
  );

  const dismiss: RingerRunService["Service"]["dismiss"] = Effect.fn("RingerRunService.dismiss")(
    function* (input) {
      yield* SynchronizedRef.modifyEffect(
        stateRef,
        (state): Effect.Effect<readonly [undefined, ServiceState], RingerError> => {
          const attachment = state.attachments.get(input.runId);
          if (attachment?.threadId !== input.threadId) {
            return Effect.fail(
              new RingerRunNotFoundError({
                operation: "dismiss",
                threadId: input.threadId,
                runId: input.runId,
              }),
            );
          }
          const status = state.projections.get(input.runId)?.status ?? "queued";
          if (!TERMINAL_STATUSES.has(status)) {
            return Effect.fail(
              new RingerRunNotDismissableError({
                operation: "dismiss",
                runId: input.runId,
                status,
              }),
            );
          }
          const attachments = new Map(state.attachments);
          attachments.delete(input.runId);
          const projections = new Map(state.projections);
          projections.delete(input.runId);
          const next = { ...state, attachments, projections };
          return persist(next).pipe(
            Effect.andThen(
              PubSub.publish(events, {
                type: "removed",
                threadId: input.threadId,
                runId: input.runId,
              }),
            ),
            Effect.as([undefined, next] as const),
          );
        },
      );
    },
  );

  const retry: RingerRunService["Service"]["retry"] = Effect.fn("RingerRunService.retry")(
    function* (input) {
      yield* lookupAttachment(input);
      return yield* new RingerOperationUnsupportedError({
        operation: "retry",
        runId: input.runId,
      });
    },
  );

  const gate: RingerRunService["Service"]["gate"] = Effect.fn("RingerRunService.gate")(
    function* (input) {
      yield* lookupAttachment(input);
      return yield* new RingerOperationUnsupportedError({
        operation: "gate",
        runId: input.runId,
      });
    },
  );

  const proof: RingerRunService["Service"]["proof"] = Effect.fn("RingerRunService.proof")(
    function* (input) {
      const projection = yield* status(input);
      const member = projection.members.find((candidate) => candidate.id === input.memberId);
      if (!member) {
        return yield* new RingerRunNotFoundError({
          operation: "proof",
          threadId: input.threadId,
          runId: input.runId,
        });
      }
      const attachment = yield* lookupAttachment(input);
      if (!attachment.backendRunId) {
        return yield* new RingerExecutionError({
          operation: "proof",
          stage: "discover",
          runId: input.runId,
        });
      }
      const raw = yield* runtime.readState({
        environmentId: attachment.environmentId,
        threadId: attachment.threadId,
        launchId: attachment.publicRunId,
        backendRunId: attachment.backendRunId,
      });
      const memberOrdinal = Number.parseInt(String(input.memberId).replace(/^member-/, ""), 10);
      const task = raw?.tasks[memberOrdinal - 1];
      if (task === undefined) {
        return yield* new RingerRunNotFoundError({
          operation: "proof",
          threadId: input.threadId,
          runId: input.runId,
        });
      }
      const hudPort = yield* ensureManagedHud;
      const detail = yield* runtime.readProof({
        environmentId,
        threadId: input.threadId,
        launchId: input.runId,
        backendRunId: attachment.backendRunId,
        controlToken: attachment.controlToken,
        hudPort,
        taskKey: task.key,
      });
      return {
        ...member.proof,
        ...(detail.proof.verified?.trim()
          ? { verificationCriteria: scrubEvidence(detail.proof.verified, 2_048) }
          : {}),
        ...(detail.proof.check_output_tail?.trim()
          ? { checkOutputTail: scrubEvidence(detail.proof.check_output_tail, 16_384) }
          : {}),
        ...(detail.proof.setup_error?.trim()
          ? { setupError: scrubEvidence(detail.proof.setup_error, 4_096) }
          : {}),
        ...(detail.logTail.trim() ? { logTail: scrubEvidence(detail.logTail, 65_536) } : {}),
      };
    },
  );

  const listArtifacts: RingerRunService["Service"]["listArtifacts"] = Effect.fn(
    "RingerRunService.listArtifacts",
  )(function* (input) {
    const projection = yield* status(input);
    return { runId: input.runId, artifacts: projection.artifacts };
  });

  const readArtifact: RingerRunService["Service"]["readArtifact"] = Effect.fn(
    "RingerRunService.readArtifact",
  )(function* (input) {
    const attachment = yield* lookupAttachment(input);
    if (!attachment.backendRunId) {
      return yield* new RingerExecutionError({
        operation: "artifacts",
        stage: "discover",
        runId: input.runId,
      });
    }
    const raw = yield* runtime.readState({
      environmentId: attachment.environmentId,
      threadId: attachment.threadId,
      launchId: attachment.publicRunId,
      backendRunId: attachment.backendRunId,
    });
    if (!raw) {
      return yield* new RingerRunNotFoundError({
        operation: "artifacts",
        threadId: input.threadId,
        runId: input.runId,
      });
    }
    const artifact = artifactsFromRawState(raw).find(
      (candidate) => candidate.descriptor.id === input.artifactId,
    );
    if (!artifact) {
      return yield* new RingerRunNotFoundError({
        operation: "artifacts",
        threadId: input.threadId,
        runId: input.runId,
      });
    }
    if (!isTextMediaType(artifact.descriptor.mediaType)) {
      return yield* new RingerExecutionError({
        operation: "artifacts",
        stage: "artifact",
        runId: input.runId,
      });
    }
    const result = yield* runtime.readArtifactText({
      environmentId: attachment.environmentId,
      threadId: attachment.threadId,
      launchId: attachment.publicRunId,
      backendRunId: attachment.backendRunId,
      artifactPath: artifact.path,
    });
    return {
      runId: input.runId,
      artifact: artifact.descriptor,
      encoding: "utf8",
      content: result.content,
      truncated: result.truncated,
    };
  });

  const observe: RingerRunService["Service"]["observe"] = (input) =>
    Stream.unwrap(
      Effect.gen(function* () {
        const subscribed = yield* subscribeBeforeSnapshotWithoutMutex(
          events,
          list(input).pipe(
            Effect.map(
              (snapshot): RingerThreadRunsEvent => ({
                type: "snapshot",
                threadId: snapshot.threadId,
                runs: snapshot.runs,
              }),
            ),
          ),
        );
        const revisions = yield* Ref.make(
          new Map<RingerRunId, number>(
            subscribed.latest.type === "removed"
              ? []
              : subscribed.latest.runs.map((run) => [run.runId, run.revision] as const),
          ),
        );
        const changes = subscribed.changes.pipe(
          Stream.filter((event) => event.threadId === input.threadId),
          Stream.mapEffect((event) =>
            Ref.modify(
              revisions,
              (known): readonly [RingerThreadEvent | undefined, Map<RingerRunId, number>] => {
                if (event.type === "removed") {
                  if (!known.has(event.runId)) return [undefined, known] as const;
                  const remaining = new Map(known);
                  remaining.delete(event.runId);
                  return [event, remaining] as const;
                }
                const isNewer = event.runs.some(
                  (run) => (known.get(run.runId) ?? -1) < run.revision,
                );
                if (!isNewer) return [undefined, known] as const;
                return [
                  event,
                  new Map(event.runs.map((run) => [run.runId, run.revision] as const)),
                ] as const;
              },
            ),
          ),
          Stream.filter((event): event is RingerThreadEvent => event !== undefined),
        );
        return Stream.concat(Stream.make(subscribed.latest), changes);
      }),
    );

  const refreshAll = Effect.fn("RingerRunService.refreshAll")(function* (recheckLost: boolean) {
    const snapshot = yield* SynchronizedRef.get(stateRef);
    yield* Effect.forEach(
      snapshot.attachments.values(),
      (attachment) => {
        const current = snapshot.projections.get(attachment.publicRunId);
        if (
          current &&
          TERMINAL_STATUSES.has(current.status) &&
          !(recheckLost && current.status === "lost")
        ) {
          return Effect.void;
        }
        return refreshAttachment(attachment).pipe(
          Effect.catch((error) =>
            Effect.logWarning("Ringer run refresh failed", {
              runId: attachment.publicRunId,
              errorTag: error._tag,
            }),
          ),
          Effect.asVoid,
        );
      },
      { concurrency: 4, discard: true },
    );
  });
  const refreshTick = yield* Ref.make(0);
  yield* Effect.forkScoped(
    Effect.forever(
      Ref.modify(
        refreshTick,
        (tick) => [tick, (tick + 1) % LOST_RECHECK_EVERY_TICKS] as const,
      ).pipe(
        Effect.flatMap((tick) => refreshAll(tick === LOST_RECHECK_EVERY_TICKS - 1)),
        Effect.andThen(Effect.sleep("500 millis")),
      ),
    ),
  );

  return RingerRunService.of({
    capabilities,
    list,
    launch,
    status,
    cancel,
    dismiss,
    retry,
    gate,
    proof,
    listArtifacts,
    readArtifact,
    observe,
  });
});

export const layerWithoutRuntime = Layer.effect(RingerRunService, make);

export const layer = layerWithoutRuntime.pipe(Layer.provide(RingerRuntimeLayer));
