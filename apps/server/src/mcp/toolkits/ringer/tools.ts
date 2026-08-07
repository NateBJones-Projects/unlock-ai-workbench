import {
  RingerError,
  RingerGateInput,
  RingerLaunchInput,
  RingerRetryInput,
  RingerRunProjection,
  RingerRunTargetInput,
} from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { Tool, Toolkit } from "effect/unstable/ai";

import * as McpInvocationContext from "../../McpInvocationContext.ts";
import * as RingerRunService from "../../../ringer/RingerRunService.ts";

const dependencies = [McpInvocationContext.McpInvocationContext, RingerRunService.RingerRunService];

const StartInput = Schema.Struct({ templateId: RingerLaunchInput.fields.templateId });
const RunInput = Schema.Struct({ runId: RingerRunTargetInput.fields.runId });
const RetryInput = Schema.Struct({
  runId: RingerRetryInput.fields.runId,
  memberId: RingerRetryInput.fields.memberId,
});
const GateInput = Schema.Struct({
  runId: RingerGateInput.fields.runId,
  gateId: RingerGateInput.fields.gateId,
  decision: RingerGateInput.fields.decision,
});

const localTool = <T extends Tool.Any>(tool: T): T => tool.annotate(Tool.OpenWorld, false) as T;

export const RingerStartTool = localTool(
  Tool.make("ringer_start", {
    description:
      "Start an allowlisted Ringer workflow in this agent session's T3 thread. V1 exposes a deterministic integration diagnostic that makes zero model calls.",
    parameters: StartInput,
    success: RingerRunProjection,
    failure: RingerError,
    dependencies,
  })
    .annotate(Tool.Title, "Start Ringer workflow")
    .annotate(Tool.Destructive, true),
);

export const RingerStatusTool = localTool(
  Tool.make("ringer_status", {
    description:
      "Read the current safe projection of one Ringer run attached to this agent session's T3 thread.",
    parameters: RunInput,
    success: RingerRunProjection,
    failure: RingerError,
    dependencies,
  })
    .annotate(Tool.Title, "Get Ringer status")
    .annotate(Tool.Readonly, true)
    .annotate(Tool.Destructive, false)
    .annotate(Tool.Idempotent, true),
);

export const RingerCancelTool = localTool(
  Tool.make("ringer_cancel", {
    description:
      "Request cancellation of one exact Ringer run attached to this agent session's T3 thread.",
    parameters: RunInput,
    success: RingerRunProjection,
    failure: RingerError,
    dependencies,
  })
    .annotate(Tool.Title, "Cancel Ringer run")
    .annotate(Tool.Destructive, true)
    .annotate(Tool.Idempotent, true),
);

export const RingerRetryTool = localTool(
  Tool.make("ringer_retry", {
    description:
      "Retry one member of a Ringer run in this thread when the runtime advertises retry support. Workbench V1 returns an explicit unsupported error.",
    parameters: RetryInput,
    success: RingerRunProjection,
    failure: RingerError,
    dependencies,
  })
    .annotate(Tool.Title, "Retry Ringer member")
    .annotate(Tool.Destructive, true),
);

export const RingerGateTool = localTool(
  Tool.make("ringer_gate", {
    description:
      "Approve or reject a Ringer gate in this thread when the runtime advertises gate support. Workbench V1 returns an explicit unsupported error.",
    parameters: GateInput,
    success: RingerRunProjection,
    failure: RingerError,
    dependencies,
  })
    .annotate(Tool.Title, "Decide Ringer gate")
    .annotate(Tool.Destructive, true),
);

export const RingerToolkit = Toolkit.make(
  RingerStartTool,
  RingerStatusTool,
  RingerCancelTool,
  RingerRetryTool,
  RingerGateTool,
);
