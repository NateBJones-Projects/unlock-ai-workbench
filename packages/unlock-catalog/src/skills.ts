import { V1_SKILL_PROVIDER_COMPATIBILITY } from "./compatibility.ts";
import type { GuideId } from "./guides.ts";
import type { PermissionPolicy, SkillManifest } from "./types.ts";

const OPEN_SKILLS_ORIGIN = "https://unlock-ai.natebjones.com/open-skills";

const localArtifactPolicy = (extraRules: PermissionPolicy["rules"] = []): PermissionPolicy => ({
  default: "deny",
  rules: [
    {
      capability: "filesystem.read",
      decision: "allow",
      reason: "Read only the source material the user selected for the job.",
    },
    {
      capability: "filesystem.write",
      decision: "allow",
      reason: "Write local artifacts inside the user-selected workspace or output folder.",
    },
    ...extraRules,
  ],
});

const guideIds = <T extends readonly GuideId[]>(...ids: T): T => ids;

export const SKILLS = [
  {
    schemaVersion: 1,
    kind: "skill",
    id: "current-information-search",
    version: "0.1.0",
    title: "Current-Information Search",
    summary:
      "Research fast-changing claims with dated, primary sources instead of trusting stale model knowledge.",
    category: "core-infrastructure",
    install: { name: "current-information-search", entrypoint: "SKILL.md" },
    triggers: [
      "A question involves recent releases, prices, rules, schedules, news, or APIs.",
      "A factual claim may have changed since the model was trained.",
    ],
    requirements: ["Internet access", "A search provider available to the harness"],
    setup: [
      {
        id: "search-provider",
        label: "Search provider",
        kind: "choice",
        required: true,
        help: "Prefer the harness browser; use Perplexity API when configured.",
      },
      {
        id: "perplexity-api-key",
        label: "Perplexity API key",
        kind: "secret",
        required: false,
        sensitive: true,
        help: "Store in the provider environment, never in the skill file.",
      },
    ],
    instructions: [
      "Search before answering any fast-moving factual question.",
      "Prefer primary sources, record publication and event dates, and distinguish them.",
      "When current sources contradict model memory, use the sources and explain the conflict.",
      "Cite every claim that depends on the search.",
    ],
    outputs: ["A concise answer", "Dated source links", "Any unresolved conflicts"],
    providers: V1_SKILL_PROVIDER_COMPATIBILITY,
    permissions: {
      default: "deny",
      rules: [
        {
          capability: "network.read",
          decision: "allow",
          reason: "Retrieve public sources relevant to the user's question.",
        },
        {
          capability: "credentials.use",
          decision: "ask",
          reason: "Use a configured search API credential only after the user enables it.",
        },
        {
          capability: "sensitive-data.transmit",
          decision: "deny",
          reason: "Never include private source material in a web-search request.",
        },
      ],
    },
    verification: {
      mode: "hybrid",
      blocking: true,
      summary: "Prove one recent claim using dated primary sources.",
      checks: [
        "At least one source is primary.",
        "The answer distinguishes publication date from event date.",
        "Every time-sensitive claim has a source.",
      ],
      evidence: ["Search query", "Source URLs", "Final cited answer"],
    },
    guideIds: guideIds("open-stack-field-guide"),
    sourceUrl: `${OPEN_SKILLS_ORIGIN}/core-infrastructure#current-information-search`,
  },
  {
    schemaVersion: 1,
    kind: "skill",
    id: "heavy-file-ingestion",
    version: "0.1.0",
    title: "Heavy File Ingestion",
    summary:
      "Convert large PDFs, decks, spreadsheets, and documents into lean, indexed artifacts before analysis.",
    category: "core-infrastructure",
    install: { name: "heavy-file-ingestion", entrypoint: "SKILL.md" },
    triggers: [
      "The job includes a large or binary document.",
      "A source is too large to read safely into one model context.",
    ],
    requirements: ["Local conversion tools appropriate to each source type"],
    setup: [
      {
        id: "output-directory",
        label: "Ingested artifact folder",
        kind: "path",
        required: false,
        help: "Default to an _ingested folder beside the source.",
      },
    ],
    instructions: [
      "Preserve originals and convert before analysis.",
      "Use Markdown for prose and CSV for tabular data; chunk oversized outputs.",
      "Create an index with source path, artifact path, type, and one-line summary.",
      "Analyze converted artifacts, never the original heavy file when an artifact exists.",
    ],
    outputs: ["Converted artifacts", "Artifact index", "Conversion warnings"],
    providers: V1_SKILL_PROVIDER_COMPATIBILITY,
    permissions: localArtifactPolicy([
      {
        capability: "process.execute",
        decision: "ask",
        reason: "Run a local converter selected for the source format.",
      },
      {
        capability: "sensitive-data.transmit",
        decision: "deny",
        reason: "Keep document conversion local unless the user starts a separate approved flow.",
      },
    ]),
    verification: {
      mode: "hybrid",
      blocking: true,
      summary: "Trace one converted passage or row back to the original source.",
      checks: [
        "The source file is unchanged.",
        "The index lists every generated artifact.",
        "A sampled artifact retains a usable source anchor.",
      ],
      evidence: ["Artifact index", "Sample source anchor", "Conversion command"],
    },
    guideIds: guideIds("open-stack-field-guide"),
    sourceUrl: `${OPEN_SKILLS_ORIGIN}/core-infrastructure#heavy-file-ingestion`,
  },
  {
    schemaVersion: 1,
    kind: "skill",
    id: "html-artifact-builder",
    version: "0.1.0",
    title: "HTML Artifact Builder",
    summary: "Render dense results as one polished, self-contained HTML file that works offline.",
    category: "core-infrastructure",
    install: { name: "html-artifact-builder", entrypoint: "SKILL.md" },
    triggers: [
      "Output is dense, visual, interactive, or worth keeping.",
      "The user asks for a report, comparison, timeline, diagram, or dashboard.",
    ],
    requirements: ["A local browser for final rendering checks"],
    setup: [
      {
        id: "output-directory",
        label: "Artifact folder",
        kind: "path",
        required: false,
        help: "Default to an artifacts folder in the active workspace.",
      },
    ],
    instructions: [
      "Produce one HTML file with inline CSS and JavaScript and no remote dependencies.",
      "Use Unlock AI's near-black, cream, and cyan editorial system by default.",
      "Choose the smallest layout that makes the material easy to inspect.",
      "Open the file locally and fix visible rendering problems before delivery.",
    ],
    outputs: ["Self-contained HTML artifact", "Render-check result"],
    providers: V1_SKILL_PROVIDER_COMPATIBILITY,
    permissions: localArtifactPolicy([
      {
        capability: "process.execute",
        decision: "ask",
        reason: "Open or render the local artifact for verification.",
      },
      {
        capability: "external.publish",
        decision: "deny",
        reason: "Building an artifact never implies permission to publish it.",
      },
    ]),
    verification: {
      mode: "hybrid",
      blocking: true,
      summary: "Open the artifact offline and verify its layout and interactions.",
      checks: [
        "Only one HTML file is required to view the result.",
        "No network dependency is needed after load.",
        "The primary content is readable at desktop and narrow widths.",
      ],
      evidence: ["Artifact path", "Render result", "Any corrected defects"],
    },
    guideIds: guideIds("open-stack-field-guide"),
    sourceUrl: `${OPEN_SKILLS_ORIGIN}/core-infrastructure#html-artifact-builder`,
  },
  {
    schemaVersion: 1,
    kind: "skill",
    id: "token-saver",
    version: "0.1.0",
    title: "Token Saver",
    summary:
      "Reduce context waste by selecting passages, using local code for exact work, and carrying one accepted result forward.",
    category: "context-engineering",
    install: { name: "token-saver", entrypoint: "SKILL.md" },
    triggers: [
      "A job involves a long conversation, large source, token limit, or plan limit.",
      "The same accepted result is being revised repeatedly.",
    ],
    requirements: ["Local shell and standard text-search tools"],
    setup: [],
    instructions: [
      "Search large sources and load only bounded matching passages.",
      "Use local code first for exact counting, sorting, extraction, conversion, and validation.",
      "Carry exactly one accepted result plus the requested change; never carry a growing history.",
      "Never retry a token-limit failure. Reduce the input instead.",
      "State the limit: this skill cannot shrink the call that loaded it, only subsequent work.",
    ],
    outputs: ["Requested result", "Compact usage report when requested"],
    providers: V1_SKILL_PROVIDER_COMPATIBILITY,
    permissions: localArtifactPolicy([
      {
        capability: "process.execute",
        decision: "allow",
        reason: "Run narrowly scoped local search, selection, and exact-work commands.",
      },
      {
        capability: "network.read",
        decision: "deny",
        reason: "Token discipline does not itself authorize another model or network call.",
      },
    ]),
    verification: {
      mode: "hybrid",
      blocking: false,
      summary: "Run one representative job and report measured token behavior without estimates.",
      checks: [
        "A large source is reduced to bounded passages.",
        "Only one accepted result is retained.",
        "Unavailable metrics are labeled unavailable rather than estimated.",
      ],
      evidence: ["Selected passage packet", "Accepted-result state", "Usage report"],
    },
    guideIds: guideIds("cut-token-waste"),
    sourceUrl: `${OPEN_SKILLS_ORIGIN}/context-engineering#token-saver`,
  },
  {
    schemaVersion: 1,
    kind: "skill",
    id: "citation-guard",
    version: "0.1.0",
    title: "Citation Guard",
    summary:
      "Reject substantive claims whose citations do not resolve to evidence that supports them.",
    category: "context-engineering",
    install: { name: "citation-guard", entrypoint: "SKILL.md" },
    triggers: [
      "A draft contains amounts, dates, deadlines, rules, counts, or quoted language.",
      "A workflow requires evidence-grounded output before export.",
    ],
    requirements: ["A draft", "A citation map or source registry"],
    setup: [],
    instructions: [
      "Choose one machine-checkable citation syntax and create or reuse a local validator for it.",
      "Resolve every substantive claim and verify support, not citation existence alone.",
      "Classify each claim as pass, needs_review, or fail; unsupported claims fail.",
      "Exit nonzero when any claim fails so downstream export can stop.",
    ],
    outputs: ["Claim-level validation report", "Process exit status"],
    providers: V1_SKILL_PROVIDER_COMPATIBILITY,
    permissions: localArtifactPolicy([
      {
        capability: "process.execute",
        decision: "allow",
        reason: "Run the job's deterministic local citation validator and its fixtures.",
      },
    ]),
    verification: {
      mode: "automated",
      blocking: true,
      summary: "Use a two-sided fixture: supported claims pass and one fabricated citation fails.",
      checks: [
        "The valid fixture exits zero.",
        "The fabricated citation fixture exits nonzero.",
        "The seeded fabricated sentence appears in the failure report.",
      ],
      evidence: ["Passing report", "Failing report", "Exit codes"],
    },
    guideIds: guideIds(
      "build-a-healthcare-claim-appeals-agent",
      "build-a-tax-prep-organizer-agent",
      "build-an-email-follow-up-agent",
    ),
    sourceUrl: `${OPEN_SKILLS_ORIGIN}/context-engineering#citation-guard`,
  },
  {
    schemaVersion: 1,
    kind: "skill",
    id: "packet-export",
    version: "0.1.0",
    title: "Packet Export",
    summary:
      "Package validated Markdown, source evidence, open questions, and a rendered PDF for review.",
    category: "context-engineering",
    install: { name: "packet-export", entrypoint: "SKILL.md" },
    triggers: [
      "Validated work needs an editable handoff folder and PDF.",
      "A document-grounded workflow reaches its review boundary.",
    ],
    requirements: ["Validated Markdown", "Source manifest", "Local PDF renderer"],
    setup: [
      {
        id: "packet-directory",
        label: "Packet output folder",
        kind: "path",
        required: false,
        help: "Default to a packet folder in the active workspace.",
      },
    ],
    instructions: [
      "Refuse export while Citation Guard reports any fail verdict.",
      "Keep editable Markdown, JSON, and CSV as source-of-truth files.",
      "Include the source manifest, unresolved questions, checklist, and citation verdict summary.",
      "Render one combined PDF, verify it opens, and never send or submit it.",
    ],
    outputs: ["Editable packet folder", "Combined PDF", "Source manifest"],
    providers: V1_SKILL_PROVIDER_COMPATIBILITY,
    permissions: localArtifactPolicy([
      {
        capability: "process.execute",
        decision: "ask",
        reason: "Run the local HTML-to-PDF renderer and inspect its output.",
      },
      {
        capability: "external.send",
        decision: "deny",
        reason: "Export creates a review artifact; it never sends or files it.",
      },
      {
        capability: "sensitive-data.transmit",
        decision: "deny",
        reason: "Packet creation stays local.",
      },
    ]),
    verification: {
      mode: "hybrid",
      blocking: true,
      summary:
        "Open the rendered packet and inspect page count, tables, and included review material.",
      checks: [
        "Citation Guard has no fail verdicts.",
        "The PDF exists and opens.",
        "No raw Markdown artifacts or clipped tables are visible.",
      ],
      evidence: ["Packet folder listing", "PDF path and page count", "Render review"],
    },
    guideIds: guideIds(
      "build-a-healthcare-claim-appeals-agent",
      "build-a-tax-prep-organizer-agent",
      "build-an-email-follow-up-agent",
    ),
    sourceUrl: `${OPEN_SKILLS_ORIGIN}/context-engineering#packet-export`,
  },
  {
    schemaVersion: 1,
    kind: "skill",
    id: "human-gate",
    version: "0.1.0",
    title: "Human Gate",
    summary:
      "Stop high-stakes work at review so only a person can sign, send, file, pay, or submit.",
    category: "context-engineering",
    install: { name: "human-gate", entrypoint: "SKILL.md" },
    triggers: [
      "A workflow touches healthcare, taxes, legal, financial, identity, or other high-stakes action.",
      "The next action would transmit, authorize, pay, sign, file, send, or submit.",
    ],
    requirements: ["An explicit review checklist", "A named human decision point"],
    setup: [],
    instructions: [
      "Allow organizing, drafting, validating, summarizing, and local export.",
      "Stop before signing, sending, filing, submitting, authorizing, paying, or transmitting sensitive data.",
      "Present the review checklist, unresolved questions, and exact next action.",
      "An ignored or rejected draft means no action.",
    ],
    outputs: ["Review checkpoint", "Handoff checklist", "Explicit stopped state"],
    providers: V1_SKILL_PROVIDER_COMPATIBILITY,
    permissions: {
      default: "deny",
      rules: [
        {
          capability: "filesystem.read",
          decision: "allow",
          reason: "Inspect the packet and checklist being handed to the user.",
        },
        {
          capability: "external.publish",
          decision: "deny",
          reason: "Publication requires a separate, explicit user-approved workflow.",
        },
        {
          capability: "external.send",
          decision: "deny",
          reason: "The agent stops before sending, filing, or submitting.",
        },
        {
          capability: "account.mutate",
          decision: "deny",
          reason: "The agent never authorizes payments or account changes at this gate.",
        },
        {
          capability: "sensitive-data.transmit",
          decision: "deny",
          reason: "Sensitive transmission remains a human action outside this workflow.",
        },
      ],
    },
    verification: {
      mode: "manual",
      blocking: true,
      summary: "Demonstrate that a sample workflow stops before its irreversible action.",
      checks: [
        "The stopped state names the forbidden next action.",
        "The user receives a review checklist.",
        "No external action is attempted.",
      ],
      evidence: ["Stopped-state message", "Review checklist", "No-action confirmation"],
    },
    guideIds: guideIds(
      "the-one-minute-test",
      "build-a-healthcare-claim-appeals-agent",
      "build-a-tax-prep-organizer-agent",
      "build-an-email-follow-up-agent",
    ),
    sourceUrl: `${OPEN_SKILLS_ORIGIN}/context-engineering#human-gate`,
  },
  {
    schemaVersion: 1,
    kind: "skill",
    id: "meeting-synthesis",
    version: "0.1.0",
    title: "Meeting Synthesis",
    summary:
      "Turn a recording or transcript into decisions, actions, questions, and durable context.",
    category: "research-thinking",
    install: { name: "meeting-synthesis", entrypoint: "SKILL.md" },
    triggers: [
      "The user supplies a meeting transcript or recording.",
      "The user asks what happened, what was decided, or who owns next steps.",
    ],
    requirements: ["A transcript, or a recording that the provider can transcribe"],
    setup: [
      {
        id: "output-directory",
        label: "Synthesis folder",
        kind: "path",
        required: false,
        help: "Default to a meetings folder in the active workspace.",
      },
    ],
    instructions: [
      "Organize multi-topic meetings by topic, not chronology.",
      "Separate takeaways, decisions, action items, open questions, and durable context.",
      "Name owners and deadlines only when stated; label every inference.",
      "Preserve exact quotes for contentious statements and commitments.",
    ],
    outputs: ["Structured synthesis", "Action-item list", "Marked inferences"],
    providers: V1_SKILL_PROVIDER_COMPATIBILITY,
    permissions: localArtifactPolicy([
      {
        capability: "external.send",
        decision: "deny",
        reason: "Producing notes does not authorize sending them or creating external tasks.",
      },
    ]),
    verification: {
      mode: "manual",
      blocking: false,
      summary: "Check a real or fixture transcript against the fixed synthesis structure.",
      checks: [
        "Every required section is present.",
        "Owners and deadlines are grounded in the transcript.",
        "Inferences are visibly labeled.",
      ],
      evidence: ["Source transcript", "Synthesis", "Grounding spot-check"],
    },
    guideIds: guideIds("the-one-minute-test"),
    sourceUrl: `${OPEN_SKILLS_ORIGIN}/research-thinking#meeting-synthesis`,
  },
  {
    schemaVersion: 1,
    kind: "skill",
    id: "assumption-checker",
    version: "0.1.0",
    title: "Assumption Checker",
    summary:
      "Adversarially audit plans and arguments for load-bearing assumptions and missing evidence.",
    category: "research-thinking",
    install: { name: "assumption-checker", entrypoint: "SKILL.md" },
    triggers: [
      "The user asks to stress-test, red-team, or challenge a plan.",
      "A conclusion should be checked independently before it becomes a decision.",
    ],
    requirements: ["The plan, argument, or strategy to audit"],
    setup: [],
    instructions: [
      "Adopt a skeptical posture and do not soften findings with praise.",
      "List each assumption and rate how load-bearing and well-evidenced it is.",
      "Check available sources or code, not internal consistency alone.",
      "Lead with the single most dangerous assumption and end with three risk-reducing questions.",
    ],
    outputs: ["Assumption register", "Most dangerous assumption", "Three next questions"],
    providers: V1_SKILL_PROVIDER_COMPATIBILITY,
    permissions: {
      default: "deny",
      rules: [
        {
          capability: "filesystem.read",
          decision: "allow",
          reason: "Inspect only the plan and supporting sources selected for the audit.",
        },
        {
          capability: "network.read",
          decision: "ask",
          reason: "Check external facts only when the user approves current research.",
        },
      ],
    },
    verification: {
      mode: "manual",
      blocking: false,
      summary: "Apply the audit to a representative plan and trace key findings to evidence gaps.",
      checks: [
        "Every finding states the assumption plainly.",
        "Load-bearing and evidence ratings are present.",
        "The most dangerous assumption is called out first.",
      ],
      evidence: ["Audited plan", "Assumption register", "Source checks"],
    },
    guideIds: guideIds("open-stack-field-guide"),
    sourceUrl: `${OPEN_SKILLS_ORIGIN}/research-thinking#assumption-checker`,
  },
  {
    schemaVersion: 1,
    kind: "skill",
    id: "personal-voice-skill",
    version: "0.1.0",
    title: "Personal Voice",
    summary: "Draft across the user's real writing registers while avoiding generic AI prose.",
    category: "writing-voice-content",
    install: { name: "personal-voice", entrypoint: "SKILL.md" },
    triggers: [
      "The user asks for a draft, rewrite, or review in their voice.",
      "A workflow produces publication, email, or stakeholder copy attributed to the user.",
    ],
    requirements: ["Five to ten representative writing samples across different contexts"],
    setup: [
      {
        id: "writing-samples",
        label: "Writing sample folder",
        kind: "path",
        required: true,
        help: "Use samples the user intentionally selected for voice calibration.",
      },
    ],
    instructions: [
      "Model distinct registers and state when each applies.",
      "Preserve recurring sentence patterns while avoiding words, openings, and constructions the user rejects.",
      "Choose register from audience and stakes, not from one generic tone label.",
      "Accuracy beats voice; never bend a fact to sound more like the user.",
    ],
    outputs: ["Voice-calibrated draft", "Register used", "Any accuracy caveats"],
    providers: V1_SKILL_PROVIDER_COMPATIBILITY,
    permissions: localArtifactPolicy([
      {
        capability: "external.publish",
        decision: "deny",
        reason: "Drafting in someone's voice never authorizes publishing as that person.",
      },
      {
        capability: "external.send",
        decision: "deny",
        reason: "Drafting in someone's voice never authorizes impersonation or sending.",
      },
      {
        capability: "sensitive-data.transmit",
        decision: "deny",
        reason: "Keep private writing samples local.",
      },
    ]),
    verification: {
      mode: "manual",
      blocking: false,
      summary: "Have the user grade one short email and one short post from different registers.",
      checks: [
        "The two drafts use visibly different appropriate registers.",
        "No declared anti-pattern appears.",
        "The user can accept, revise, or reject the calibration.",
      ],
      evidence: ["Selected writing samples", "Two draft fixtures", "User calibration result"],
    },
    guideIds: guideIds("build-an-email-follow-up-agent"),
    sourceUrl: `${OPEN_SKILLS_ORIGIN}/writing-voice-content#personal-voice-skill`,
  },
] as const satisfies readonly SkillManifest[];

export type SkillId = (typeof SKILLS)[number]["id"];

export function renderSkillMarkdown(skill: SkillManifest): string {
  const normalizeTrigger = (trigger: string): string => {
    const withoutPeriod = trigger.replace(/\.$/, "");
    return `${withoutPeriod.charAt(0).toLowerCase()}${withoutPeriod.slice(1)}`;
  };
  const description = `${skill.summary} Use this skill when ${skill.triggers
    .map(normalizeTrigger)
    .join("; or when ")}.`;
  const numbered = (items: readonly string[]): string =>
    items.map((item, index) => `${index + 1}. ${item}`).join("\n");
  const bullets = (items: readonly string[]): string => items.map((item) => `- ${item}`).join("\n");
  const setup = skill.setup
    .map(
      (field) =>
        `- **${field.label}${field.required ? " (required)" : " (optional)"}:** ${field.help}${
          field.sensitive
            ? " Treat this value as sensitive and never write it into this skill."
            : ""
        }`,
    )
    .join("\n");
  const permissions = skill.permissions.rules
    .map((rule) => `- **${rule.decision.toUpperCase()} · ${rule.capability}:** ${rule.reason}`)
    .join("\n");

  return [
    "---",
    `name: ${skill.install.name}`,
    `description: ${JSON.stringify(description)}`,
    // Marks which catalog entry produced this installed skill so the
    // Workbench can show it as installed. `x-unlock-personalized` is earned
    // by completing the setup interview and is never emitted here.
    `x-unlock-pack: ${skill.id}@${skill.version}`,
    "---",
    "",
    `# ${skill.title}`,
    "",
    "## Requirements",
    "",
    bullets(skill.requirements),
    "",
    "## Setup",
    "",
    setup || "- No one-time setup. Confirm the active workspace before starting.",
    "",
    "## Procedure",
    "",
    numbered(skill.instructions),
    "",
    "## Outputs",
    "",
    bullets(skill.outputs),
    "",
    "## Boundaries",
    "",
    "Default stance: deny any capability not explicitly listed below. A skill instruction never overrides the harness permission system.",
    "",
    permissions || "- No capabilities are pre-authorized.",
    "",
    "## Verification",
    "",
    skill.verification.summary,
    "",
    numbered(skill.verification.checks),
    "",
  ].join("\n");
}
