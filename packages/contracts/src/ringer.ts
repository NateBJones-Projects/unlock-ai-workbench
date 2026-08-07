/**
 * Provider-independent Ringer contracts for the Unlock AI Workbench.
 *
 * The public run id is allocated by T3. Ringer's native run id is deliberately
 * kept server-side because current native ids contain process metadata.
 */
import * as Schema from "effect/Schema";

import {
  EnvironmentId,
  IsoDateTime,
  NonNegativeInt,
  PositiveInt,
  ThreadId,
  TrimmedNonEmptyString,
} from "./baseSchemas.ts";

const ShortText = Schema.String.check(Schema.isMaxLength(512));
const SafeId = TrimmedNonEmptyString.check(Schema.isMaxLength(160));

export const RINGER_WORKBENCH_DIAGNOSTIC_TEMPLATE_ID = "unlock.workbench-diagnostic.v1" as const;

export const RingerRunId = SafeId.pipe(Schema.brand("RingerRunId"));
export type RingerRunId = typeof RingerRunId.Type;

export const RingerMemberId = SafeId.pipe(Schema.brand("RingerMemberId"));
export type RingerMemberId = typeof RingerMemberId.Type;

export const RingerArtifactId = SafeId.pipe(Schema.brand("RingerArtifactId"));
export type RingerArtifactId = typeof RingerArtifactId.Type;

export const RingerTemplateId = Schema.Literal(RINGER_WORKBENCH_DIAGNOSTIC_TEMPLATE_ID);
export type RingerTemplateId = typeof RingerTemplateId.Type;

export const RingerExecutionStrategy = Schema.Literals([
  "deterministic-diagnostic",
  "single-agent-diagnostic",
  "parallel-agent-swarm",
]);
export type RingerExecutionStrategy = typeof RingerExecutionStrategy.Type;

export const RingerOperation = Schema.Literals([
  "capabilities",
  "list",
  "launch",
  "status",
  "cancel",
  "retry",
  "gate",
  "proof",
  "artifacts",
]);
export type RingerOperation = typeof RingerOperation.Type;

export const RingerRunStatus = Schema.Literals([
  "queued",
  "running",
  "canceling",
  "canceled",
  "succeeded",
  "failed",
  "lost",
]);
export type RingerRunStatus = typeof RingerRunStatus.Type;

export const RingerMemberStatus = Schema.Literals([
  "queued",
  "running",
  "retrying",
  "verifying",
  "passed",
  "failed",
  "canceled",
]);
export type RingerMemberStatus = typeof RingerMemberStatus.Type;

export const RingerVerdict = Schema.Literals(["pending", "pass", "fail", "error", "timeout"]);
export type RingerVerdict = typeof RingerVerdict.Type;

export const RingerCheckStatus = Schema.Literals([
  "pending",
  "running",
  "passed",
  "failed",
  "timed-out",
  "unavailable",
]);
export type RingerCheckStatus = typeof RingerCheckStatus.Type;

export const RingerTemplateDescriptor = Schema.Struct({
  id: RingerTemplateId,
  name: TrimmedNonEmptyString.check(Schema.isMaxLength(120)),
  description: ShortText,
  executionStrategy: RingerExecutionStrategy,
  agentBacked: Schema.Boolean,
  estimatedAgentCalls: NonNegativeInt,
});
export type RingerTemplateDescriptor = typeof RingerTemplateDescriptor.Type;

export const RingerOperationCapabilities = Schema.Struct({
  launch: Schema.Boolean,
  cancel: Schema.Boolean,
  retry: Schema.Boolean,
  gate: Schema.Boolean,
});
export type RingerOperationCapabilities = typeof RingerOperationCapabilities.Type;

export const RingerCapabilitiesInput = Schema.Struct({
  threadId: ThreadId,
});
export type RingerCapabilitiesInput = typeof RingerCapabilitiesInput.Type;

export const RingerCapabilitySnapshot = Schema.Struct({
  available: Schema.Boolean,
  reason: Schema.optional(ShortText),
  operations: RingerOperationCapabilities,
  templates: Schema.Array(RingerTemplateDescriptor),
});
export type RingerCapabilitySnapshot = typeof RingerCapabilitySnapshot.Type;

export const RingerProofSummary = Schema.Struct({
  memberId: RingerMemberId,
  verdict: RingerVerdict,
  checkStatus: RingerCheckStatus,
  exitCode: Schema.optional(Schema.NullOr(Schema.Int)),
  evidenceAvailable: Schema.Boolean,
});
export type RingerProofSummary = typeof RingerProofSummary.Type;

export const RingerProofDetail = Schema.Struct({
  ...RingerProofSummary.fields,
  verificationCriteria: Schema.optional(Schema.String.check(Schema.isMaxLength(2_048))),
  checkOutputTail: Schema.optional(Schema.String.check(Schema.isMaxLength(16_384))),
  setupError: Schema.optional(Schema.String.check(Schema.isMaxLength(4_096))),
  logTail: Schema.optional(Schema.String.check(Schema.isMaxLength(65_536))),
});
export type RingerProofDetail = typeof RingerProofDetail.Type;

export const RingerArtifactKind = Schema.Literals(["deliverable", "live-report", "final-report"]);
export type RingerArtifactKind = typeof RingerArtifactKind.Type;

export const RingerArtifactDescriptor = Schema.Struct({
  id: RingerArtifactId,
  memberId: Schema.optional(RingerMemberId),
  name: TrimmedNonEmptyString.check(Schema.isMaxLength(255)),
  kind: RingerArtifactKind,
  mediaType: TrimmedNonEmptyString.check(Schema.isMaxLength(128)),
  sizeBytes: Schema.optional(NonNegativeInt),
});
export type RingerArtifactDescriptor = typeof RingerArtifactDescriptor.Type;

export const RingerMemberProjection = Schema.Struct({
  id: RingerMemberId,
  name: TrimmedNonEmptyString.check(Schema.isMaxLength(160)),
  status: RingerMemberStatus,
  engine: Schema.optional(TrimmedNonEmptyString.check(Schema.isMaxLength(120))),
  model: Schema.optional(TrimmedNonEmptyString.check(Schema.isMaxLength(200))),
  attempt: NonNegativeInt,
  maxAttempts: PositiveInt,
  elapsedSeconds: NonNegativeInt,
  tokens: NonNegativeInt,
  activity: Schema.optional(ShortText),
  proof: RingerProofSummary,
  artifacts: Schema.Array(RingerArtifactDescriptor),
});
export type RingerMemberProjection = typeof RingerMemberProjection.Type;

export const RingerRunTotals = Schema.Struct({
  total: NonNegativeInt,
  queued: NonNegativeInt,
  active: NonNegativeInt,
  passed: NonNegativeInt,
  failed: NonNegativeInt,
  tokens: NonNegativeInt,
});
export type RingerRunTotals = typeof RingerRunTotals.Type;

export const RingerRunProjection = Schema.Struct({
  version: Schema.Literal(1),
  revision: NonNegativeInt,
  runId: RingerRunId,
  environmentId: EnvironmentId,
  threadId: ThreadId,
  templateId: RingerTemplateId,
  name: TrimmedNonEmptyString.check(Schema.isMaxLength(160)),
  status: RingerRunStatus,
  startedAt: IsoDateTime,
  updatedAt: IsoDateTime,
  finishedAt: Schema.NullOr(IsoDateTime),
  operations: RingerOperationCapabilities,
  totals: RingerRunTotals,
  members: Schema.Array(RingerMemberProjection),
  artifacts: Schema.Array(RingerArtifactDescriptor),
});
export type RingerRunProjection = typeof RingerRunProjection.Type;

export const RingerThreadInput = Schema.Struct({ threadId: ThreadId });
export type RingerThreadInput = typeof RingerThreadInput.Type;

export const RingerRunTargetInput = Schema.Struct({
  threadId: ThreadId,
  runId: RingerRunId,
});
export type RingerRunTargetInput = typeof RingerRunTargetInput.Type;

export const RingerLaunchInput = Schema.Struct({
  threadId: ThreadId,
  templateId: RingerTemplateId,
});
export type RingerLaunchInput = typeof RingerLaunchInput.Type;

export const RingerRetryInput = Schema.Struct({
  ...RingerRunTargetInput.fields,
  memberId: RingerMemberId,
});
export type RingerRetryInput = typeof RingerRetryInput.Type;

export const RingerGateDecision = Schema.Literals(["approve", "reject"]);
export type RingerGateDecision = typeof RingerGateDecision.Type;

export const RingerGateInput = Schema.Struct({
  ...RingerRunTargetInput.fields,
  gateId: SafeId,
  decision: RingerGateDecision,
});
export type RingerGateInput = typeof RingerGateInput.Type;

export const RingerProofInput = Schema.Struct({
  ...RingerRunTargetInput.fields,
  memberId: RingerMemberId,
});
export type RingerProofInput = typeof RingerProofInput.Type;

export const RingerArtifactListInput = RingerRunTargetInput;
export type RingerArtifactListInput = typeof RingerArtifactListInput.Type;

export const RingerArtifactReadInput = Schema.Struct({
  ...RingerRunTargetInput.fields,
  artifactId: RingerArtifactId,
});
export type RingerArtifactReadInput = typeof RingerArtifactReadInput.Type;

export const RingerArtifactList = Schema.Struct({
  runId: RingerRunId,
  artifacts: Schema.Array(RingerArtifactDescriptor),
});
export type RingerArtifactList = typeof RingerArtifactList.Type;

export const RingerArtifactContent = Schema.Struct({
  runId: RingerRunId,
  artifact: RingerArtifactDescriptor,
  encoding: Schema.Literal("utf8"),
  content: Schema.String.check(Schema.isMaxLength(262_144)),
  truncated: Schema.Boolean,
});
export type RingerArtifactContent = typeof RingerArtifactContent.Type;

export const RingerThreadRunList = Schema.Struct({
  threadId: ThreadId,
  runs: Schema.Array(RingerRunProjection),
});
export type RingerThreadRunList = typeof RingerThreadRunList.Type;

export const RingerThreadEvent = Schema.Struct({
  type: Schema.Literals(["snapshot", "upsert"]),
  threadId: ThreadId,
  runs: Schema.Array(RingerRunProjection),
});
export type RingerThreadEvent = typeof RingerThreadEvent.Type;

export class RingerUnavailableError extends Schema.TaggedErrorClass<RingerUnavailableError>()(
  "RingerUnavailableError",
  {
    operation: RingerOperation,
    reason: Schema.Literals([
      "runtime-not-found",
      "runtime-invalid",
      "python-incompatible",
      "hud-unavailable",
      "not-configured",
    ]),
  },
) {
  override get message(): string {
    return `Ringer is unavailable for ${this.operation}: ${this.reason}.`;
  }
}

export class RingerTemplateNotAllowedError extends Schema.TaggedErrorClass<RingerTemplateNotAllowedError>()(
  "RingerTemplateNotAllowedError",
  {
    operation: Schema.Literal("launch"),
    templateId: SafeId,
  },
) {
  override get message(): string {
    return `Ringer template '${this.templateId}' is not allowlisted.`;
  }
}

export class RingerRunNotFoundError extends Schema.TaggedErrorClass<RingerRunNotFoundError>()(
  "RingerRunNotFoundError",
  {
    operation: RingerOperation,
    threadId: ThreadId,
    runId: RingerRunId,
  },
) {
  override get message(): string {
    return `Ringer run '${this.runId}' was not found in this thread.`;
  }
}

export class RingerOperationUnsupportedError extends Schema.TaggedErrorClass<RingerOperationUnsupportedError>()(
  "RingerOperationUnsupportedError",
  {
    operation: Schema.Literals(["retry", "gate"]),
    runId: RingerRunId,
  },
) {
  override get message(): string {
    return `Ringer does not currently support ${this.operation} for this run.`;
  }
}

export class RingerExecutionError extends Schema.TaggedErrorClass<RingerExecutionError>()(
  "RingerExecutionError",
  {
    operation: RingerOperation,
    stage: Schema.Literals([
      "prepare",
      "spawn",
      "discover",
      "read-state",
      "control",
      "persist",
      "artifact",
    ]),
    runId: Schema.optional(RingerRunId),
  },
) {
  override get message(): string {
    return `Ringer ${this.operation} failed during ${this.stage}.`;
  }
}

export class RingerMcpCapabilityUnavailableError extends Schema.TaggedErrorClass<RingerMcpCapabilityUnavailableError>()(
  "RingerMcpCapabilityUnavailableError",
  {
    capability: Schema.Literal("ringer"),
    environmentId: EnvironmentId,
    threadId: ThreadId,
  },
) {
  override get message(): string {
    return "MCP credential does not grant the ringer capability.";
  }
}

export const RingerError = Schema.Union([
  RingerUnavailableError,
  RingerTemplateNotAllowedError,
  RingerRunNotFoundError,
  RingerOperationUnsupportedError,
  RingerExecutionError,
  RingerMcpCapabilityUnavailableError,
]);
export type RingerError = typeof RingerError.Type;
