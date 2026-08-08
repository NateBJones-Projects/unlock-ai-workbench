import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { ScopedProjectRef, ScopedThreadRef } from "@t3tools/contracts";
import { useCallback, useState } from "react";

import { openCommandPalette } from "../../commandPaletteBus";
import { useComposerDraftStore } from "../../composerDraftStore";
import { useHandleNewThread } from "../../hooks/useHandleNewThread";
import { startNewThreadFromContext } from "../../lib/chatThreadActions";
import { useRightPanelStore } from "../../rightPanelStore";
import { useProjects } from "../../state/entities";
import { stackedThreadToast, toastManager } from "../ui/toast";
import { recordWorkbenchLaunch, type WorkbenchLaunchProvenance } from "./workbenchLaunchStore";

export interface WorkbenchPromptLaunchOptions {
  readonly projectRef?: ScopedProjectRef;
  readonly provenance?: Omit<WorkbenchLaunchProvenance, "preparedAt">;
  /** Open the thread-scoped native agent monitor after preparing the draft. */
  readonly openRingside?: boolean;
}

export function useWorkbenchLaunch() {
  const context = useHandleNewThread();
  const projects = useProjects();
  const [launchingId, setLaunchingId] = useState<string | null>(null);

  const requireProject = useCallback(
    (preferred?: ScopedProjectRef): ScopedProjectRef | null => {
      if (preferred) return preferred;
      if (context.defaultProjectRef) return context.defaultProjectRef;
      openCommandPalette({ open: "add-project" });
      toastManager.add({
        type: "info",
        title: "Choose a workspace first",
        description: "Add the folder where this workflow should keep its work.",
      });
      return null;
    },
    [context.defaultProjectRef],
  );

  const launchBlankThread = useCallback(async () => {
    const projectRef = requireProject();
    if (!projectRef) return;
    setLaunchingId("blank-thread");
    try {
      await startNewThreadFromContext({
        activeDraftThread: context.activeDraftThread,
        activeThread: context.activeThread ?? undefined,
        defaultProjectRef: projectRef,
        handleNewThread: context.handleNewThread,
      });
    } finally {
      setLaunchingId(null);
    }
  }, [context, requireProject]);

  const launchPrompt = useCallback(
    async (
      id: string,
      prompt: string,
      options?: WorkbenchPromptLaunchOptions,
    ): Promise<ScopedThreadRef | null> => {
      const projectRef = requireProject(options?.projectRef);
      if (!projectRef) return null;

      const beforeStore = useComposerDraftStore.getState();
      const existingSession = beforeStore.getDraftSessionByProjectRef(projectRef);
      const existingPrompt = existingSession
        ? (beforeStore.getComposerDraft(existingSession.draftId)?.prompt.trim() ?? "")
        : "";
      if (
        existingPrompt.length > 0 &&
        !window.confirm(
          "This workspace has an unsent draft. Replace that draft with the selected Unlock AI workflow? Cancel keeps it untouched.",
        )
      ) {
        return null;
      }

      setLaunchingId(id);
      try {
        await context.handleNewThread(projectRef);
        const store = useComposerDraftStore.getState();
        const draft = store.getDraftSessionByProjectRef(projectRef);
        if (!draft) {
          throw new Error("The new draft was not available after navigation.");
        }
        store.setPrompt(draft.draftId, prompt);
        const threadRef = scopeThreadRef(draft.environmentId, draft.threadId);
        if (options?.provenance) {
          recordWorkbenchLaunch(threadRef, options.provenance);
        }
        if (options?.openRingside) {
          useRightPanelStore.getState().open(threadRef, "agents");
        }
        const projectName = projects.find(
          (project) =>
            project.environmentId === projectRef.environmentId &&
            project.id === projectRef.projectId,
        )?.title;
        toastManager.add(
          stackedThreadToast({
            type: "info",
            title: "Nothing has run yet",
            description:
              options?.provenance?.kind === "workflow"
                ? projectName
                  ? `Workflow prepared in "${projectName}" — review the prompt, add your source, then press Send.`
                  : "Workflow prepared — review the prompt, add your source, then press Send."
                : "Prompt prepared — review it and press Send.",
          }),
        );
        return threadRef;
      } catch (error) {
        toastManager.add(
          stackedThreadToast({
            type: "error",
            title: "Could not start the workflow",
            description: error instanceof Error ? error.message : "An unexpected error occurred.",
          }),
        );
        return null;
      } finally {
        setLaunchingId(null);
      }
    },
    [context, projects, requireProject],
  );

  return {
    defaultProjectRef: context.defaultProjectRef,
    activeThread: context.activeThread,
    activeDraftThread: context.activeDraftThread,
    launchingId,
    launchBlankThread,
    launchPrompt,
  };
}
