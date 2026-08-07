import { V1_WORKFLOW_PROVIDER_COMPATIBILITY } from "./compatibility.ts";
import type { GuideId } from "./guides.ts";
import type { PermissionPolicy, WorkflowManifest } from "./types.ts";

const RUNBOOK_ORIGIN = "https://unlock-ai.natebjones.com/open-skills/runbooks";

const guideIds = <T extends readonly GuideId[]>(...ids: T): T => ids;

const localWorkflowPolicy = (externalRules: PermissionPolicy["rules"] = []): PermissionPolicy => ({
  default: "deny",
  rules: [
    {
      capability: "filesystem.read",
      decision: "allow",
      reason: "Read only the sources the user selected for this workflow.",
    },
    {
      capability: "filesystem.write",
      decision: "allow",
      reason: "Write drafts and evidence inside the active workspace.",
    },
    ...externalRules,
  ],
});

export const WORKFLOWS = [
  {
    schemaVersion: 1,
    kind: "workflow",
    id: "talk-to-published",
    version: "0.1.0",
    title: "Talk to Published",
    summary: "Turn a voice memo or rough transcript into a polished, voice-matched page.",
    payoff: "A voice memo becomes a publication-ready page with a deliberate human publish gate.",
    inputPrompt: "Choose a voice memo, recording, or transcript and name the intended audience.",
    launchPrompt: `Run the Unlock AI Talk to Published workflow.

Start from the source I provide. If it is audio, create a local transcript. Separate the distinct ideas, recommend the strongest one, and stop for my choice. Draft only the chosen idea using Personal Voice, then build and verify one self-contained HTML artifact. Do not publish, email, or upload anything until I review the exact artifact and explicitly approve a separate publish action. Preserve the source, transcript, draft, and final artifact in the workspace.`,
    steps: [
      {
        id: "capture",
        title: "Capture the words",
        instruction: "Transcribe locally when needed and preserve the original source.",
      },
      {
        id: "choose-idea",
        title: "Find the piece",
        instruction: "Separate distinct ideas, rank them, and recommend one with reasons.",
        gate: {
          type: "human",
          prompt: "Choose which idea should become the piece.",
          required: true,
        },
      },
      {
        id: "draft",
        title: "Draft in your voice",
        instruction: "Write the selected piece for the named audience.",
        skillId: "personal-voice-skill",
      },
      {
        id: "build-artifact",
        title: "Build the page",
        instruction: "Create and locally verify a self-contained HTML artifact.",
        skillId: "html-artifact-builder",
      },
      {
        id: "publish-gate",
        title: "Review before publishing",
        instruction: "Present the exact artifact and stop without any external action.",
        skillId: "human-gate",
        gate: {
          type: "human",
          prompt: "Approve, revise, or reject the artifact. Publishing is a separate action.",
          required: true,
        },
      },
    ],
    providers: V1_WORKFLOW_PROVIDER_COMPATIBILITY,
    permissions: localWorkflowPolicy([
      {
        capability: "process.execute",
        decision: "ask",
        reason: "Use a local transcription or rendering tool when the source requires it.",
      },
      {
        capability: "external.publish",
        decision: "deny",
        reason: "The v1 workflow ends at a reviewed artifact; publishing is a separate action.",
      },
      {
        capability: "external.send",
        decision: "deny",
        reason: "Never announce or distribute the draft from this workflow.",
      },
    ]),
    verification: {
      mode: "hybrid",
      blocking: true,
      summary:
        "Trace the artifact to the chosen idea and verify it locally before the publish gate.",
      checks: [
        "The chosen idea has explicit human approval.",
        "The artifact is self-contained and renders locally.",
        "No publish or send action occurred.",
      ],
      evidence: ["Transcript", "Idea selection", "Draft", "Verified HTML path"],
    },
    guideIds: guideIds("open-stack-field-guide"),
    sourceUrl: `${RUNBOOK_ORIGIN}#talk-to-published`,
  },
  {
    schemaVersion: 1,
    kind: "workflow",
    id: "release-day",
    version: "0.1.0",
    title: "Release Day",
    summary: "Research a new release and produce an accurate, on-brand briefing while it is fresh.",
    payoff: "A same-day briefing that is fast without trading away dates, sources, or review.",
    inputPrompt: "Name the release, intended audience, and desired briefing format.",
    launchPrompt: `Run the Unlock AI Release Day workflow.

Research the release using Current-Information Search. Prefer first-party announcements, documentation, changelogs, and pricing pages; record publication and event dates. Separate confirmed facts from interpretation and unresolved claims. Draft a concise briefing in my Personal Voice, then build and verify one self-contained HTML artifact. Stop for my factual and editorial review. Do not publish, email, or post anything from this workflow.`,
    steps: [
      {
        id: "research",
        title: "Establish current facts",
        instruction: "Gather dated primary sources and identify unresolved claims.",
        skillId: "current-information-search",
      },
      {
        id: "stress-test",
        title: "Challenge the framing",
        instruction: "Test the emerging briefing for assumptions and unsupported conclusions.",
        skillId: "assumption-checker",
      },
      {
        id: "draft",
        title: "Write the briefing",
        instruction: "Draft for the named audience without blurring fact and interpretation.",
        skillId: "personal-voice-skill",
      },
      {
        id: "build-artifact",
        title: "Package the briefing",
        instruction: "Build and locally verify a self-contained briefing page.",
        skillId: "html-artifact-builder",
      },
      {
        id: "review",
        title: "Review before release",
        instruction: "Present the sources and final artifact, then stop.",
        skillId: "human-gate",
        gate: {
          type: "human",
          prompt: "Approve the facts and framing before any separate publication workflow.",
          required: true,
        },
      },
    ],
    providers: V1_WORKFLOW_PROVIDER_COMPATIBILITY,
    permissions: localWorkflowPolicy([
      {
        capability: "network.read",
        decision: "allow",
        reason: "Research public, current sources about the named release.",
      },
      {
        capability: "credentials.use",
        decision: "ask",
        reason: "Use an optional configured search API only after setup approval.",
      },
      {
        capability: "external.publish",
        decision: "deny",
        reason: "The v1 workflow creates a reviewed briefing but never publishes it.",
      },
      {
        capability: "external.send",
        decision: "deny",
        reason: "The v1 workflow never emails or posts the briefing.",
      },
    ]),
    verification: {
      mode: "hybrid",
      blocking: true,
      summary: "Verify the briefing's time-sensitive claims and render before review.",
      checks: [
        "Every time-sensitive claim has a dated source.",
        "Fact, interpretation, and unresolved claims are distinct.",
        "The artifact renders locally and no external action occurred.",
      ],
      evidence: ["Source ledger", "Assumption audit", "Briefing artifact", "Review gate"],
    },
    guideIds: guideIds("open-stack-field-guide", "the-one-minute-test"),
    sourceUrl: `${RUNBOOK_ORIGIN}#release-day`,
  },
  {
    schemaVersion: 1,
    kind: "workflow",
    id: "the-research-engine",
    version: "0.1.0",
    title: "The Research Engine",
    summary:
      "Turn messy documents, meetings, and current sources into a stress-tested research artifact.",
    payoff:
      "Research with a chain of custody: claims trace to artifacts and conclusions are challenged.",
    inputPrompt:
      "State the research question and select the files, recordings, or starting claims.",
    launchPrompt: `Run the Unlock AI Research Engine workflow.

State the research question in one sentence. Preserve the original inputs and use Heavy File Ingestion before analyzing large or binary files. Synthesize any meeting transcripts separately. Use Current-Information Search only to fill identified gaps, recording dated primary sources. Build a claim-and-source ledger, then run Assumption Checker as an adversarial pass. Validate substantive claims with Citation Guard. Produce a verified self-contained HTML report, name unresolved questions plainly, and stop for review. Keep all artifacts local.`,
    steps: [
      {
        id: "ingest",
        title: "Ingest the evidence",
        instruction: "Convert heavy sources into lean artifacts and create an index.",
        skillId: "heavy-file-ingestion",
      },
      {
        id: "meetings",
        title: "Synthesize meetings",
        instruction: "Extract grounded decisions, actions, questions, and durable context.",
        skillId: "meeting-synthesis",
      },
      {
        id: "fill-gaps",
        title: "Fill current-information gaps",
        instruction: "Search only for named gaps and capture dated primary sources.",
        skillId: "current-information-search",
      },
      {
        id: "challenge",
        title: "Challenge the conclusions",
        instruction: "Audit the emerging argument independently for load-bearing assumptions.",
        skillId: "assumption-checker",
      },
      {
        id: "validate",
        title: "Validate the claims",
        instruction: "Resolve substantive claims against the source ledger and block failures.",
        skillId: "citation-guard",
      },
      {
        id: "report",
        title: "Build the research artifact",
        instruction: "Produce and locally verify a self-contained HTML report.",
        skillId: "html-artifact-builder",
      },
      {
        id: "review",
        title: "Hand off for review",
        instruction:
          "Present the report, source ledger, and unresolved questions without publishing.",
        skillId: "human-gate",
        gate: {
          type: "human",
          prompt: "Review the evidence, conclusions, and unresolved questions.",
          required: true,
        },
      },
    ],
    providers: V1_WORKFLOW_PROVIDER_COMPATIBILITY,
    permissions: localWorkflowPolicy([
      {
        capability: "process.execute",
        decision: "ask",
        reason: "Run local converters, validators, or renderers needed by selected sources.",
      },
      {
        capability: "network.read",
        decision: "ask",
        reason: "Use current web research only for gaps named during the workflow.",
      },
      {
        capability: "sensitive-data.transmit",
        decision: "deny",
        reason: "Private source material stays local and out of search queries.",
      },
      {
        capability: "external.publish",
        decision: "deny",
        reason: "The research workflow ends at a local review artifact.",
      },
    ]),
    verification: {
      mode: "hybrid",
      blocking: true,
      summary:
        "Prove chain of custody from sampled conclusions through claims to source artifacts.",
      checks: [
        "Heavy sources were converted before analysis.",
        "Citation Guard reports no failed substantive claims.",
        "The report names unresolved questions and renders locally.",
      ],
      evidence: [
        "Ingestion index",
        "Claim-and-source ledger",
        "Assumption audit",
        "Citation report",
        "HTML report",
      ],
    },
    guideIds: guideIds("open-stack-field-guide", "the-one-minute-test", "ringer"),
    sourceUrl: `${RUNBOOK_ORIGIN}#the-research-engine`,
  },
] as const satisfies readonly WorkflowManifest[];

export type WorkflowId = (typeof WORKFLOWS)[number]["id"];
