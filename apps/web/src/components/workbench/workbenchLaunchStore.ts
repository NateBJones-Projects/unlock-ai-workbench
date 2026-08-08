import { scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { resolveStorage } from "../../lib/storage";

export type WorkbenchLaunchKind = "workflow" | "skill" | "shell" | "ringer";

export type WorkbenchExecutionStrategy =
  | "prepared-prompt"
  | "native-skill"
  | "project-shell"
  | "ringer";

/**
 * Product provenance for the most recently prepared or started Workbench
 * action in a thread. This is deliberately presentation metadata rather than
 * orchestration truth: provider and Ringer run state continue to come from the
 * server projections rendered by Ringside.
 */
export interface WorkbenchLaunchProvenance {
  readonly kind: WorkbenchLaunchKind;
  readonly catalogId: string;
  readonly title: string;
  readonly version: string | null;
  readonly strategy: WorkbenchExecutionStrategy;
  readonly preparedAt: string;
}

interface WorkbenchLaunchStoreState {
  readonly byThreadKey: Record<string, WorkbenchLaunchProvenance>;
  readonly record: (ref: ScopedThreadRef, provenance: WorkbenchLaunchProvenance) => void;
  readonly removeThread: (ref: ScopedThreadRef) => void;
  readonly clear: () => void;
}

const WORKBENCH_LAUNCH_STORAGE_KEY = "unlock-ai:workbench-launches:v1";

// Provenance persists per thread in localStorage; prune the oldest entries on
// write so long-lived installs do not accumulate unbounded state.
const MAX_PERSISTED_LAUNCHES = 50;

function pruneOldestLaunches(
  byThreadKey: Readonly<Record<string, WorkbenchLaunchProvenance>>,
): Record<string, WorkbenchLaunchProvenance> {
  const entries = Object.entries(byThreadKey);
  if (entries.length <= MAX_PERSISTED_LAUNCHES) return { ...byThreadKey };
  return Object.fromEntries(
    entries
      .sort(([, a], [, b]) => b.preparedAt.localeCompare(a.preparedAt))
      .slice(0, MAX_PERSISTED_LAUNCHES),
  );
}

export const useWorkbenchLaunchStore = create<WorkbenchLaunchStoreState>()(
  persist(
    (set) => ({
      byThreadKey: {},
      record: (ref, provenance) =>
        set((state) => ({
          byThreadKey: pruneOldestLaunches({
            ...state.byThreadKey,
            [scopedThreadKey(ref)]: provenance,
          }),
        })),
      removeThread: (ref) =>
        set((state) => {
          const key = scopedThreadKey(ref);
          if (!(key in state.byThreadKey)) return state;
          const { [key]: _removed, ...byThreadKey } = state.byThreadKey;
          return { byThreadKey };
        }),
      clear: () => set({ byThreadKey: {} }),
    }),
    {
      name: WORKBENCH_LAUNCH_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() =>
        resolveStorage(typeof window !== "undefined" ? window.localStorage : undefined),
      ),
      partialize: (state) => ({ byThreadKey: state.byThreadKey }),
    },
  ),
);

export function selectWorkbenchLaunchProvenance(
  byThreadKey: Readonly<Record<string, WorkbenchLaunchProvenance>>,
  ref: ScopedThreadRef | null | undefined,
): WorkbenchLaunchProvenance | null {
  if (!ref) return null;
  return byThreadKey[scopedThreadKey(ref)] ?? null;
}

export function recordWorkbenchLaunch(
  ref: ScopedThreadRef,
  input: Omit<WorkbenchLaunchProvenance, "preparedAt"> & { readonly preparedAt?: string },
): void {
  useWorkbenchLaunchStore.getState().record(ref, {
    ...input,
    preparedAt: input.preparedAt ?? new Date().toISOString(),
  });
}
