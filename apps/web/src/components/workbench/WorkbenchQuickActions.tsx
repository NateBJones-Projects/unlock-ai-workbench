import type { ProjectScript, ScopedProjectRef } from "@t3tools/contracts";
import { SKILLS, WORKFLOWS } from "@t3tools/unlock-catalog";
import {
  BotIcon,
  ChevronDownIcon,
  LibraryBigIcon,
  LoaderCircleIcon,
  PlayIcon,
  SparklesIcon,
  StarIcon,
  WorkflowIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import * as Schema from "effect/Schema";

import { useLocalStorage } from "../../hooks/useLocalStorage";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { ScrollArea } from "../ui/scroll-area";
import { stackedThreadToast, toastManager } from "../ui/toast";
import {
  buildWorkbenchQuickActions,
  filterAndOrderWorkbenchQuickActions,
  type WorkbenchQuickAction,
  type WorkbenchRingerQuickActionCapability,
} from "./quickActions";
import { skillUsePrompt, verifiedSkillSetupPrompt } from "./workbenchPrompts";
import { useWorkbenchLaunch } from "./useWorkbenchLaunch";

const FAVORITES_STORAGE_KEY = "unlock-ai:quick-action-favorites:v1";
const FavoriteIdsSchema = Schema.Array(Schema.String);
const EMPTY_FAVORITES: ReadonlyArray<string> = [];

function QuickActionIcon({ kind }: { readonly kind: WorkbenchQuickAction["kind"] }) {
  if (kind === "ringer") return <BotIcon className="size-4 text-[var(--unlock-cyan)]" />;
  if (kind === "ringer-unavailable") return <BotIcon className="size-4 text-muted-foreground/60" />;
  if (kind === "workflow") return <WorkflowIcon className="size-4 text-[var(--unlock-cyan)]" />;
  if (kind === "skill") return <LibraryBigIcon className="size-4 text-violet-500" />;
  return <PlayIcon className="size-4 text-emerald-500" />;
}

function kindLabel(kind: WorkbenchQuickAction["kind"]): string {
  if (kind === "ringer") return "Ringer";
  if (kind === "ringer-unavailable") return "Unavailable";
  if (kind === "workflow") return "Workflow";
  if (kind === "skill") return "Skill";
  return "Action";
}

export function WorkbenchQuickActions(props: {
  readonly projectRef: ScopedProjectRef;
  readonly scripts: ReadonlyArray<ProjectScript>;
  readonly detectedSkillNames: ReadonlySet<string>;
  readonly providerName: string | null;
  readonly ringer: WorkbenchRingerQuickActionCapability | null;
  readonly onRunScript: (script: ProjectScript) => void | Promise<void>;
  readonly onRunRinger?: (templateId: string) => void | Promise<void>;
}) {
  const { launchingId, launchPrompt } = useWorkbenchLaunch();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [runningActionId, setRunningActionId] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useLocalStorage(
    FAVORITES_STORAGE_KEY,
    EMPTY_FAVORITES,
    FavoriteIdsSchema,
  );
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const actions = useMemo(
    () =>
      buildWorkbenchQuickActions({
        workflows: WORKFLOWS,
        skills: SKILLS,
        scripts: props.scripts,
        detectedSkillNames: props.detectedSkillNames,
        ringer: props.ringer,
      }),
    [props.detectedSkillNames, props.ringer, props.scripts],
  );
  const visibleActions = useMemo(
    () => filterAndOrderWorkbenchQuickActions(actions, query, favoriteSet),
    [actions, favoriteSet, query],
  );

  const toggleFavorite = (id: string) => {
    setFavoriteIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
  };

  const dispatch = async (action: WorkbenchQuickAction) => {
    if (action.kind === "ringer-unavailable") {
      toastManager.add(
        stackedThreadToast({
          type: "info",
          title: "Ringer Readiness Check is unavailable",
          description: action.reason,
        }),
      );
      return;
    }
    setRunningActionId(action.id);
    try {
      if (action.kind === "workflow") {
        await launchPrompt(action.id, action.workflow.launchPrompt, {
          projectRef: props.projectRef,
          provenance: {
            kind: "workflow",
            catalogId: action.workflow.id,
            title: action.workflow.title,
            version: action.workflow.version,
            strategy: "prepared-prompt",
          },
          openRingside: true,
        });
      } else if (action.kind === "skill") {
        await launchPrompt(
          action.id,
          action.installed
            ? skillUsePrompt(action.skill.install.name)
            : verifiedSkillSetupPrompt(action.skill),
          {
            projectRef: props.projectRef,
            provenance: {
              kind: "skill",
              catalogId: action.skill.id,
              title: action.skill.title,
              version: action.skill.version,
              strategy: action.installed ? "native-skill" : "prepared-prompt",
            },
            openRingside: true,
          },
        );
      } else if (action.kind === "shell") {
        await props.onRunScript(action.script);
      } else if (props.onRunRinger) {
        await props.onRunRinger(action.templateId);
      }
      setOpen(false);
      setQuery("");
    } catch (error) {
      toastManager.add(
        stackedThreadToast({
          type: "error",
          title: `Could not start ${action.title}`,
          description: error instanceof Error ? error.message : "An unexpected error occurred.",
        }),
      );
    } finally {
      setRunningActionId(null);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            size="xs"
            variant="outline"
            className="w-7 px-0 sm:w-6 @3xl/header-actions:w-auto! @3xl/header-actions:px-[calc(--spacing(2)-1px)]"
            aria-label="Open Unlock AI Quick Actions"
          />
        }
      >
        <SparklesIcon className="size-3.5" />
        <span className="sr-only @3xl/header-actions:not-sr-only @3xl/header-actions:ml-0.5">
          Quick Actions
        </span>
        <ChevronDownIcon className="hidden size-3 @3xl/header-actions:block" />
      </PopoverTrigger>
      <PopoverPopup
        align="end"
        side="bottom"
        sideOffset={8}
        className="w-[min(32rem,calc(100vw-1rem))]"
        viewportClassName="p-0!"
      >
        <div className="border-b border-border/70 p-3">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <div>
              <p className="text-sm font-black">Quick Actions</p>
              <p className="text-[11px] text-muted-foreground">
                Typed launchers—each keeps its real execution strategy.
              </p>
            </div>
            <span className="shrink-0 text-[9px] font-black tracking-[0.08em] text-muted-foreground/70 uppercase">
              {props.providerName ?? "No provider selected"}
            </span>
          </div>
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search workflows, skills, actions, and Ringer"
            aria-label="Search Quick Actions"
            size="sm"
          />
        </div>
        <ScrollArea className="max-h-[min(30rem,70vh)]">
          <div className="p-2">
            {visibleActions.length > 0 ? (
              visibleActions.map((action) => {
                const favorite = favoriteSet.has(action.id);
                const running = runningActionId === action.id || launchingId === action.id;
                return (
                  <div
                    key={action.id}
                    className="group/action grid grid-cols-[minmax(0,1fr)_2rem] rounded-md hover:bg-accent/60"
                  >
                    <button
                      type="button"
                      disabled={runningActionId !== null || launchingId !== null}
                      onClick={() => void dispatch(action)}
                      className="flex min-w-0 items-start gap-3 px-2.5 py-2.5 text-left disabled:opacity-60"
                    >
                      <span className="mt-0.5 shrink-0">
                        {running ? (
                          <LoaderCircleIcon className="size-4 animate-spin text-muted-foreground" />
                        ) : (
                          <QuickActionIcon kind={action.kind} />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "truncate text-sm font-black",
                              action.kind === "ringer-unavailable"
                                ? "text-muted-foreground"
                                : "text-foreground",
                            )}
                          >
                            {action.title}
                          </span>
                          <span className="text-[8px] font-black tracking-[0.1em] text-muted-foreground/65 uppercase">
                            {kindLabel(action.kind)}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {action.description}
                        </span>
                        <span className="mt-1 block text-[9px] font-medium tracking-[0.035em] text-muted-foreground/75 uppercase">
                          {action.strategyLabel}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={
                        favorite ? `Unfavorite ${action.title}` : `Favorite ${action.title}`
                      }
                      aria-pressed={favorite}
                      onClick={() => toggleFavorite(action.id)}
                      className="flex items-center justify-center text-muted-foreground/55 hover:text-foreground"
                    >
                      <StarIcon
                        className={cn("size-3.5", favorite && "fill-warning text-warning")}
                      />
                    </button>
                  </div>
                );
              })
            ) : (
              <p className="px-3 py-8 text-center text-xs text-muted-foreground">
                No Quick Actions match “{query}”.
              </p>
            )}
          </div>
        </ScrollArea>
        <div className="border-t border-border/70 px-3 py-2 text-[10px] leading-4 text-muted-foreground">
          Workflows prepare editable, human-gated prompts. Skills use the selected provider. Project
          Actions run visibly in a terminal. Ringer appears only when its reviewed diagnostic
          template is available.
        </div>
      </PopoverPopup>
    </Popover>
  );
}
