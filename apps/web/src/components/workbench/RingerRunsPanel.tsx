import { useAtomValue } from "@effect/atom-react";
import type {
  RingerArtifactDescriptor,
  RingerMemberProjection,
  RingerRunId,
  RingerRunProjection,
  ScopedThreadRef,
} from "@t3tools/contracts";
import {
  Check,
  ChevronDown,
  ChevronRight,
  FileCheck2,
  FileText,
  ScrollText,
  Square,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "../../lib/utils";
import { ringerEnvironment } from "../../state/ringer";
import {
  ringerArtifactSupportsUtf8Preview,
  ringerRunCapabilityNote,
  ringerRunIsLive,
} from "./ringerPanelModel";

const RUN_STATUS: Record<
  RingerRunProjection["status"],
  { readonly label: string; readonly dot: string }
> = {
  queued: { label: "Queued", dot: "bg-info" },
  running: { label: "Running", dot: "bg-info" },
  canceling: { label: "Stopping", dot: "bg-warning" },
  canceled: { label: "Stopped", dot: "bg-muted-foreground/60" },
  succeeded: { label: "Passed", dot: "bg-success" },
  failed: { label: "Failed", dot: "bg-destructive" },
  lost: { label: "Lost", dot: "bg-destructive" },
};

const MEMBER_STATUS: Record<
  RingerMemberProjection["status"],
  { readonly label: string; readonly dot: string }
> = {
  queued: { label: "Queued", dot: "bg-info" },
  running: { label: "Running", dot: "bg-info" },
  retrying: { label: "Retrying", dot: "bg-info" },
  verifying: { label: "Verifying", dot: "bg-warning" },
  passed: { label: "Passed", dot: "bg-success" },
  failed: { label: "Failed", dot: "bg-destructive" },
  canceled: { label: "Stopped", dot: "bg-muted-foreground/60" },
};

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
}

function formatTokens(tokens: number): string {
  if (tokens < 1_000) return String(tokens);
  return `${(tokens / 1_000).toFixed(tokens < 10_000 ? 1 : 0)}k`;
}

function RingerMemberDetailView(props: {
  readonly threadRef: ScopedThreadRef;
  readonly runId: RingerRunId;
  readonly member: RingerMemberProjection;
  readonly mode: "log" | "proof";
}) {
  const result = useAtomValue(
    ringerEnvironment.proof({
      environmentId: props.threadRef.environmentId,
      input: {
        threadId: props.threadRef.threadId,
        runId: props.runId,
        memberId: props.member.id,
      },
    }),
  );
  if (result._tag === "Failure") {
    return (
      <p className="text-destructive-foreground">
        {props.mode === "log" ? "Worker log" : "Proof"} could not be loaded.
      </p>
    );
  }
  if (result._tag !== "Success") {
    return (
      <p className="text-muted-foreground">
        Loading {props.mode === "log" ? "worker log" : "proof"}…
      </p>
    );
  }
  const proof = result.value;
  if (props.mode === "log") {
    return proof.logTail ? (
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-[.68rem] text-foreground/90">
        {proof.logTail}
      </pre>
    ) : (
      <div className="space-y-2">
        <p className="whitespace-pre-wrap break-words text-foreground/90">
          {props.member.activity ?? MEMBER_STATUS[props.member.status].label}
        </p>
        <p className="text-muted-foreground">
          Ringer has not published retained log output for this worker. The latest activity snapshot
          is shown above.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <dl className="grid grid-cols-[6rem_1fr] gap-x-2 gap-y-1">
        <dt className="text-muted-foreground">Verdict</dt>
        <dd className="font-mono text-foreground">{proof.verdict}</dd>
        <dt className="text-muted-foreground">Check</dt>
        <dd className="font-mono text-foreground">{proof.checkStatus}</dd>
        <dt className="text-muted-foreground">Exit code</dt>
        <dd className="font-mono text-foreground">
          {proof.exitCode === undefined || proof.exitCode === null ? "—" : proof.exitCode}
        </dd>
        <dt className="text-muted-foreground">Evidence</dt>
        <dd className="font-mono text-foreground">
          {proof.evidenceAvailable ? "available" : "not published"}
        </dd>
      </dl>
      {proof.verificationCriteria ? (
        <div>
          <p className="font-medium text-muted-foreground">Verification criteria</p>
          <p className="whitespace-pre-wrap break-words text-foreground/90">
            {proof.verificationCriteria}
          </p>
        </div>
      ) : null}
      {proof.checkOutputTail ? (
        <div>
          <p className="font-medium text-muted-foreground">Check output</p>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-sm bg-muted/35 p-1.5 font-mono text-[.68rem] text-foreground/90">
            {proof.checkOutputTail}
          </pre>
        </div>
      ) : null}
      {proof.setupError ? (
        <div>
          <p className="font-medium text-destructive-foreground">Setup error</p>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-sm bg-destructive/5 p-1.5 font-mono text-[.68rem] text-destructive-foreground">
            {proof.setupError}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

function RingerArtifactContentView(props: {
  readonly threadRef: ScopedThreadRef;
  readonly runId: RingerRunId;
  readonly artifact: RingerArtifactDescriptor;
}) {
  const result = useAtomValue(
    ringerEnvironment.artifact({
      environmentId: props.threadRef.environmentId,
      input: {
        threadId: props.threadRef.threadId,
        runId: props.runId,
        artifactId: props.artifact.id,
      },
    }),
  );
  if (result._tag === "Failure") {
    return <p className="p-2 text-destructive-foreground">Artifact could not be loaded.</p>;
  }
  if (result._tag !== "Success") {
    return <p className="p-2 text-muted-foreground">Loading artifact…</p>;
  }
  return (
    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words border-t border-border/50 p-2 font-mono text-[.68rem] text-foreground/90">
      {result.value.content}
      {result.value.truncated ? "\n… (truncated)" : ""}
    </pre>
  );
}

function RingerArtifactListView(props: {
  readonly threadRef: ScopedThreadRef;
  readonly runId: RingerRunId;
  readonly artifacts: ReadonlyArray<RingerArtifactDescriptor>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = props.artifacts.find((artifact) => artifact.id === selectedId) ?? null;
  if (props.artifacts.length === 0) {
    return <p className="text-muted-foreground">No artifact has been published.</p>;
  }
  return (
    <div className="rounded-sm border border-border/50">
      <div className="divide-y divide-border/50">
        {props.artifacts.map((artifact) => {
          const previewable = ringerArtifactSupportsUtf8Preview(artifact);
          return (
            <button
              key={artifact.id}
              type="button"
              disabled={!previewable}
              onClick={() =>
                setSelectedId((current) => (current === artifact.id ? null : artifact.id))
              }
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-accent/50 disabled:cursor-default disabled:hover:bg-transparent"
            >
              <FileText
                aria-hidden
                className={cn(
                  "size-3.5 shrink-0",
                  previewable ? "text-[var(--unlock-cyan)]" : "text-muted-foreground/50",
                )}
              />
              <span className="min-w-0 flex-1 truncate font-mono">{artifact.name}</span>
              <span className="shrink-0 text-[.6rem] tracking-wider text-muted-foreground uppercase">
                {previewable ? artifact.kind : "Binary preview unavailable"}
              </span>
            </button>
          );
        })}
      </div>
      {selected && ringerArtifactSupportsUtf8Preview(selected) ? (
        <RingerArtifactContentView
          key={selected.id}
          threadRef={props.threadRef}
          runId={props.runId}
          artifact={selected}
        />
      ) : null}
    </div>
  );
}

type MemberEvidenceTab = "log" | "proof" | "artifact";

function RingerMemberEvidence(props: {
  readonly threadRef: ScopedThreadRef;
  readonly runId: RingerRunId;
  readonly member: RingerMemberProjection;
}) {
  const [tab, setTab] = useState<MemberEvidenceTab>("log");
  const tabs = [
    { id: "log" as const, label: "Log", icon: ScrollText },
    { id: "proof" as const, label: "Proof", icon: FileCheck2 },
    { id: "artifact" as const, label: "Artifact", icon: FileText },
  ];
  return (
    <div className="mx-1.5 mb-1 rounded-md border border-border/60 bg-background/55">
      <div className="flex items-center gap-1 border-b border-border/50 p-1" role="tablist">
        {tabs.map((entry) => {
          const Icon = entry.icon;
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={tab === entry.id}
              onClick={() => setTab(entry.id)}
              className={cn(
                "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[.65rem] text-muted-foreground hover:text-foreground",
                tab === entry.id && "bg-accent text-foreground",
              )}
            >
              <Icon aria-hidden className="size-3" />
              {entry.label}
            </button>
          );
        })}
      </div>
      <div className="p-2 text-[.7rem] leading-relaxed">
        {tab === "log" ? (
          <RingerMemberDetailView
            threadRef={props.threadRef}
            runId={props.runId}
            member={props.member}
            mode="log"
          />
        ) : tab === "proof" ? (
          <RingerMemberDetailView
            threadRef={props.threadRef}
            runId={props.runId}
            member={props.member}
            mode="proof"
          />
        ) : (
          <RingerArtifactListView
            threadRef={props.threadRef}
            runId={props.runId}
            artifacts={props.member.artifacts}
          />
        )}
      </div>
    </div>
  );
}

function RingerMemberRow(props: {
  readonly threadRef: ScopedThreadRef;
  readonly runId: RingerRunId;
  readonly member: RingerMemberProjection;
}) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const visual = MEMBER_STATUS[props.member.status];
  return (
    <div>
      <div className="grid h-[3.875rem] grid-cols-[0.375rem_minmax(0,1fr)_auto] grid-rows-[1.25rem_1.125rem_1rem] items-center gap-x-2 rounded-md px-1.5 py-1">
        <span aria-hidden className={cn("size-1.5 rounded-full", visual.dot)} />
        <span className="col-start-2 row-start-1 flex min-w-0 items-baseline gap-2">
          <span className="truncate text-sm font-medium">{props.member.name}</span>
          {props.member.engine ? (
            <span className="max-w-24 truncate rounded-sm border border-border/60 px-1 font-mono text-[.65rem] text-muted-foreground">
              {props.member.engine}
            </span>
          ) : null}
        </span>
        <span className="col-start-3 row-start-1 font-mono text-[.7rem] text-muted-foreground">
          {formatElapsed(props.member.elapsedSeconds)}
          {props.member.status === "passed" ? (
            <Check aria-hidden className="ml-1 inline size-3 text-success" />
          ) : null}
        </span>
        <span className="col-start-2 row-start-2 truncate text-xs text-muted-foreground">
          {props.member.activity ?? visual.label}
        </span>
        <button
          type="button"
          aria-expanded={evidenceOpen}
          onClick={() => setEvidenceOpen((value) => !value)}
          className="col-start-3 row-start-2 rounded-sm px-1 font-mono text-[.65rem] text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {evidenceOpen ? "Hide" : "Evidence"}
        </button>
        <span className="col-start-2 col-end-4 row-start-3 truncate font-mono text-[.7rem] text-muted-foreground/70">
          {props.member.model ?? "deterministic"} · {formatTokens(props.member.tokens)} tok ·
          attempt {props.member.attempt}/{props.member.maxAttempts}
        </span>
      </div>
      {evidenceOpen ? (
        <RingerMemberEvidence
          threadRef={props.threadRef}
          runId={props.runId}
          member={props.member}
        />
      ) : null}
    </div>
  );
}

function RingerRunSection(props: {
  readonly threadRef: ScopedThreadRef;
  readonly run: RingerRunProjection;
  readonly stopping: boolean;
  readonly onCancel: (runId: RingerRunId) => void | Promise<void>;
}) {
  const live = ringerRunIsLive(props.run);
  const [open, setOpen] = useState(live);
  const wasLive = useRef(live);
  useEffect(() => {
    if (live && !wasLive.current) setOpen(true);
    wasLive.current = live;
  }, [live]);
  const visual = RUN_STATUS[props.run.status];

  return (
    <section className="rounded-lg border border-[var(--unlock-cyan)]/20 bg-[var(--unlock-cyan)]/[0.025] p-1.5">
      <div className="flex min-w-0 items-center gap-2 px-1.5 py-0.5">
        <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", visual.dot)} />
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <span className="truncate text-[.68rem] font-black tracking-wider uppercase">
            {props.run.name}
          </span>
          <span className="font-mono text-[.62rem] text-muted-foreground">
            {visual.label} · {props.run.totals.passed}/{props.run.totals.total} passed
          </span>
          {open ? (
            <ChevronDown aria-hidden className="ml-auto size-3 text-muted-foreground" />
          ) : (
            <ChevronRight aria-hidden className="ml-auto size-3 text-muted-foreground" />
          )}
        </button>
        {live && props.run.operations.cancel ? (
          <button
            type="button"
            disabled={props.stopping || props.run.status === "canceling"}
            onClick={() => void props.onCancel(props.run.runId)}
            className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-border/60 px-1.5 py-0.5 font-mono text-[.65rem] hover:bg-accent disabled:opacity-60"
          >
            <Square aria-hidden className="size-2.5 fill-current" />
            {props.stopping || props.run.status === "canceling" ? "Stopping…" : "Stop run"}
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="pt-1">
          <div className="flex flex-wrap gap-x-3 gap-y-1 px-1.5 pb-1 font-mono text-[.62rem] text-muted-foreground/75">
            <span>{props.run.runId}</span>
            <span>{props.run.totals.active} active</span>
            <span>{formatTokens(props.run.totals.tokens)} tok</span>
          </div>
          {props.run.members.map((member) => (
            <RingerMemberRow
              key={member.id}
              threadRef={props.threadRef}
              runId={props.run.runId}
              member={member}
            />
          ))}
          {props.run.members.length === 0 ? (
            <p className="px-1.5 py-2 text-xs text-muted-foreground">
              Ringer is preparing this run. Workers will appear when its projection advances.
            </p>
          ) : null}
          {props.run.artifacts.length > 0 ? (
            <div className="px-1.5 pb-1 pt-2 text-[.7rem]">
              <p className="mb-1 font-black tracking-wider text-muted-foreground uppercase">
                Run artifacts
              </p>
              <RingerArtifactListView
                threadRef={props.threadRef}
                runId={props.run.runId}
                artifacts={props.run.artifacts}
              />
            </div>
          ) : null}
          {live ? (
            <p className="px-1.5 pb-1 pt-1 text-[.65rem] text-muted-foreground/70">
              {ringerRunCapabilityNote(props.run)}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function RingerRunsPanel(props: {
  readonly threadRef: ScopedThreadRef;
  readonly runs: ReadonlyArray<RingerRunProjection>;
  readonly stoppingRunId: RingerRunId | null;
  readonly onCancel: (runId: RingerRunId) => void | Promise<void>;
}) {
  if (props.runs.length === 0) return null;
  return (
    <section className="flex flex-col gap-2" data-ringer-run-count={props.runs.length}>
      <div className="flex items-center justify-between px-1.5 pt-1 text-[.65rem] font-medium uppercase tracking-wider text-muted-foreground">
        <span>Ringer runs</span>
        <span className="font-mono normal-case">{props.runs.length} in this thread</span>
      </div>
      {props.runs.map((run) => (
        <RingerRunSection
          key={run.runId}
          threadRef={props.threadRef}
          run={run}
          stopping={props.stoppingRunId === run.runId}
          onCancel={props.onCancel}
        />
      ))}
    </section>
  );
}
