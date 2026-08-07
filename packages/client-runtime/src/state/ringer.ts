import { WS_METHODS, type RingerRunProjection, type RingerThreadEvent } from "@t3tools/contracts";
import * as Stream from "effect/Stream";
import { Atom } from "effect/unstable/reactivity";

import type { EnvironmentRegistry } from "../connection/registry.ts";
import {
  createAtomCommandScheduler,
  createEnvironmentRpcCommand,
  createEnvironmentRpcQueryAtomFamily,
  createEnvironmentRpcSubscriptionAtomFamily,
} from "./runtime.ts";

/**
 * Project per-run stream events into a complete thread snapshot. Subscription
 * atoms expose their latest value, so retaining the full projection here
 * prevents React batching from dropping an earlier upsert for another run.
 */
export function projectRingerThreadEvent(
  current: ReadonlyArray<RingerRunProjection>,
  event: RingerThreadEvent,
): RingerThreadEvent {
  const runs =
    event.type === "snapshot"
      ? [...event.runs]
      : (() => {
          const byId = new Map(current.map((run) => [run.runId, run]));
          for (const run of event.runs) {
            const existing = byId.get(run.runId);
            if (!existing || run.revision >= existing.revision) byId.set(run.runId, run);
          }
          return [...byId.values()];
        })();
  runs.sort(
    (left, right) =>
      Date.parse(right.startedAt) - Date.parse(left.startedAt) ||
      right.runId.localeCompare(left.runId),
  );
  return { type: "snapshot", threadId: event.threadId, runs };
}

/** Shared thread-scoped Ringer RPC bindings for web and mobile clients. */
export function createRingerEnvironmentAtoms<R, E>(
  runtime: Atom.AtomRuntime<EnvironmentRegistry | R, E>,
) {
  const lifecycleScheduler = createAtomCommandScheduler();
  const memberScheduler = createAtomCommandScheduler();
  return {
    capabilities: createEnvironmentRpcQueryAtomFamily(runtime, {
      label: "environment-data:ringer:capabilities",
      tag: WS_METHODS.ringerGetCapabilities,
      staleTimeMs: 5_000,
      idleTtlMs: 30_000,
    }),
    listRuns: createEnvironmentRpcQueryAtomFamily(runtime, {
      label: "environment-data:ringer:list-runs",
      tag: WS_METHODS.ringerListRuns,
      staleTimeMs: 2_000,
      idleTtlMs: 30_000,
    }),
    events: createEnvironmentRpcSubscriptionAtomFamily(runtime, {
      label: "environment-data:ringer:events",
      tag: WS_METHODS.subscribeRingerRuns,
      idleTtlMs: 5_000,
      transform: (stream) =>
        stream.pipe(
          Stream.mapAccum(
            () => [] as ReadonlyArray<RingerRunProjection>,
            (current, event) => {
              const snapshot = projectRingerThreadEvent(current, event);
              return [snapshot.runs, [snapshot]] as const;
            },
          ),
        ),
    }),
    status: createEnvironmentRpcQueryAtomFamily(runtime, {
      label: "environment-data:ringer:status",
      tag: WS_METHODS.ringerGetStatus,
      staleTimeMs: 1_000,
      idleTtlMs: 30_000,
    }),
    proof: createEnvironmentRpcQueryAtomFamily(runtime, {
      label: "environment-data:ringer:proof",
      tag: WS_METHODS.ringerGetProof,
      staleTimeMs: 2_000,
      idleTtlMs: 30_000,
    }),
    artifacts: createEnvironmentRpcQueryAtomFamily(runtime, {
      label: "environment-data:ringer:artifacts",
      tag: WS_METHODS.ringerListArtifacts,
      staleTimeMs: 2_000,
      idleTtlMs: 30_000,
    }),
    artifact: createEnvironmentRpcQueryAtomFamily(runtime, {
      label: "environment-data:ringer:artifact",
      tag: WS_METHODS.ringerReadArtifact,
      staleTimeMs: 300_000,
      idleTtlMs: 300_000,
    }),
    launch: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:ringer:launch",
      tag: WS_METHODS.ringerLaunch,
      scheduler: lifecycleScheduler,
      concurrency: {
        mode: "serial",
        key: ({ environmentId, input }) =>
          JSON.stringify([environmentId, input.threadId, input.templateId]),
      },
    }),
    cancel: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:ringer:cancel",
      tag: WS_METHODS.ringerCancel,
      scheduler: lifecycleScheduler,
      concurrency: {
        mode: "singleFlight",
        key: ({ environmentId, input }) =>
          JSON.stringify([environmentId, input.threadId, input.runId]),
      },
    }),
    retry: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:ringer:retry",
      tag: WS_METHODS.ringerRetry,
      scheduler: memberScheduler,
      concurrency: {
        mode: "singleFlight",
        key: ({ environmentId, input }) =>
          JSON.stringify([environmentId, input.threadId, input.runId, input.memberId]),
      },
    }),
    gate: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:ringer:gate",
      tag: WS_METHODS.ringerGate,
      scheduler: memberScheduler,
      concurrency: {
        mode: "singleFlight",
        key: ({ environmentId, input }) =>
          JSON.stringify([environmentId, input.threadId, input.runId, input.gateId]),
      },
    }),
  };
}
