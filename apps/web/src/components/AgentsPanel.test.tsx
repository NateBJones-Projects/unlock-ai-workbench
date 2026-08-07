import {
  deriveAgentPanelModel,
  type RuntimeSubagent,
} from "@t3tools/client-runtime/state/subagentRuntime";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { AgentsPanel } from "./AgentsPanel";

function agent(overrides: Partial<RuntimeSubagent> = {}): RuntimeSubagent {
  return {
    id: "native-a",
    kind: "subagent",
    title: "Native researcher",
    role: "researcher",
    model: "claude-sonnet",
    effort: null,
    status: "running",
    activationCount: 1,
    usage: { totalTokens: 120, toolUses: 2 },
    progress: "Reading sources",
    lastToolName: "search",
    result: null,
    error: null,
    outputFile: "reports/research.md",
    parentAgentId: null,
    agentIndex: null,
    phaseIndex: null,
    phaseTitle: null,
    attempt: 1,
    workflowName: null,
    phases: [],
    runHandles: null,
    recentActivity: [{ at: "2026-08-07T12:00:00.000Z", summary: "Reading sources" }],
    firstSeenAt: "2026-08-07T12:00:00.000Z",
    startedAt: "2026-08-07T12:00:00.000Z",
    completedAt: null,
    updatedAt: "2026-08-07T12:00:00.000Z",
    ...overrides,
  };
}

describe("AgentsPanel Workbench presentation", () => {
  it("labels provider-native agents separately and keeps evidence lazy", () => {
    const html = renderToStaticMarkup(
      <AgentsPanel
        model={deriveAgentPanelModel({ agents: [agent()] })}
        presentation={{ directAgentsLabel: "Native agents", showWorkerEvidence: true }}
      />,
    );

    expect(html).toContain("Native agents");
    expect(html).toContain("Evidence");
    expect(html).not.toContain("No retained worker log is available");
  });

  it("labels a provider-wide interrupt honestly as Stop all", () => {
    const workflow = agent({
      id: "workflow-a",
      kind: "workflow",
      title: "Provider workflow",
      workflowName: "Provider workflow",
      runHandles: { runId: "provider-run-a" },
    });
    const html = renderToStaticMarkup(
      <AgentsPanel
        model={deriveAgentPanelModel({ agents: [workflow] })}
        presentation={{ stopScope: "thread" }}
        controls={{ onStopWorkflow: () => {} }}
      />,
    );

    expect(html).toContain("Stop all");
    expect(html).not.toContain("Stop run");
  });

  it("marks every native workflow control as stopping for a thread-wide interrupt", () => {
    const workflows = [
      agent({
        id: "workflow-a",
        kind: "workflow",
        title: "Provider workflow A",
        workflowName: "Provider workflow A",
        runHandles: { runId: "provider-run-a" },
      }),
      agent({
        id: "workflow-b",
        kind: "workflow",
        title: "Provider workflow B",
        workflowName: "Provider workflow B",
        runHandles: { runId: "provider-run-b" },
      }),
    ];
    const html = renderToStaticMarkup(
      <AgentsPanel
        model={deriveAgentPanelModel({ agents: workflows })}
        presentation={{ stopScope: "thread" }}
        controls={{ stoppingAll: true, onStopWorkflow: () => {} }}
      />,
    );

    expect(html.match(/Stopping…/gu)).toHaveLength(2);
    expect(html).not.toContain("Stop all");
  });
});
