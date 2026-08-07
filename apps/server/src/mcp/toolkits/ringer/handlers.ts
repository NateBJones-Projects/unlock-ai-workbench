import * as Effect from "effect/Effect";

import * as McpInvocationContext from "../../McpInvocationContext.ts";
import * as RingerRunService from "../../../ringer/RingerRunService.ts";
import { RingerToolkit } from "./tools.ts";

const withScope = Effect.fn("RingerToolkit.withScope")(function* <A, E>(
  operation: (
    service: RingerRunService.RingerRunService["Service"],
    threadId: import("@t3tools/contracts").ThreadId,
  ) => Effect.Effect<A, E>,
) {
  const scope = yield* McpInvocationContext.requireRingerCapability();
  const service = yield* RingerRunService.RingerRunService;
  return yield* operation(service, scope.threadId);
});

const handlers = {
  ringer_start: (input) =>
    withScope((service, threadId) => service.launch({ threadId, templateId: input.templateId })),
  ringer_status: (input) =>
    withScope((service, threadId) => service.status({ threadId, runId: input.runId })),
  ringer_cancel: (input) =>
    withScope((service, threadId) => service.cancel({ threadId, runId: input.runId })),
  ringer_retry: (input) =>
    withScope((service, threadId) =>
      service.retry({ threadId, runId: input.runId, memberId: input.memberId }),
    ),
  ringer_gate: (input) =>
    withScope((service, threadId) =>
      service.gate({
        threadId,
        runId: input.runId,
        gateId: input.gateId,
        decision: input.decision,
      }),
    ),
} satisfies Parameters<typeof RingerToolkit.toLayer>[0];

export const RingerToolkitHandlersLive = RingerToolkit.toLayer(handlers);
