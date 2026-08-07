import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import {
  recordWorkbenchLaunch,
  selectWorkbenchLaunchProvenance,
  useWorkbenchLaunchStore,
} from "./workbenchLaunchStore";

const THREAD_A = scopeThreadRef(EnvironmentId.make("local"), ThreadId.make("thread-a"));
const THREAD_B = scopeThreadRef(EnvironmentId.make("local"), ThreadId.make("thread-b"));

describe("workbenchLaunchStore", () => {
  beforeEach(() => {
    useWorkbenchLaunchStore.getState().clear();
  });

  it("keeps provenance isolated by scoped thread", () => {
    recordWorkbenchLaunch(THREAD_A, {
      kind: "workflow",
      catalogId: "research-engine",
      title: "Research Engine",
      version: "1.0.0",
      strategy: "prepared-prompt",
      preparedAt: "2026-08-07T12:00:00.000Z",
    });

    const state = useWorkbenchLaunchStore.getState();
    expect(selectWorkbenchLaunchProvenance(state.byThreadKey, THREAD_A)).toMatchObject({
      catalogId: "research-engine",
      version: "1.0.0",
    });
    expect(selectWorkbenchLaunchProvenance(state.byThreadKey, THREAD_B)).toBeNull();
  });

  it("records the execution strategy without flattening the action kind", () => {
    recordWorkbenchLaunch(THREAD_A, {
      kind: "shell",
      catalogId: "test",
      title: "Test",
      version: null,
      strategy: "project-shell",
      preparedAt: "2026-08-07T12:00:00.000Z",
    });

    expect(
      selectWorkbenchLaunchProvenance(useWorkbenchLaunchStore.getState().byThreadKey, THREAD_A),
    ).toEqual({
      kind: "shell",
      catalogId: "test",
      title: "Test",
      version: null,
      strategy: "project-shell",
      preparedAt: "2026-08-07T12:00:00.000Z",
    });
  });
});
