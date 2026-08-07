import type { GuideLink } from "./types.ts";

const UNLOCK_AI_ORIGIN = "https://unlock-ai.natebjones.com";

export const GUIDE_LINKS = [
  {
    id: "agent-maintenance-loop",
    title: "The Agent Maintenance Loop",
    description:
      "Inspect an agent after launch across job, diet, memory, tools, reach, proof, and value, then decide whether to keep, change, pause, or retire it.",
    category: "agents",
    status: "published",
    href: `${UNLOCK_AI_ORIGIN}/guides/agents/maintenance`,
  },
  {
    id: "open-brain",
    title: "Open Brain — one memory, every AI",
    description:
      "Understand the one-database memory layer and the zero-code path to building one shared memory across AI tools.",
    category: "general",
    status: "published",
    href: `${UNLOCK_AI_ORIGIN}/guides/open-brain`,
  },
  {
    id: "open-stack-field-guide",
    title: "Open Stack",
    description:
      "A practical routing guide for Open Skills, Open Brain, and Open Engine: diagnose the bottleneck, choose where to start, and personalize the stack.",
    category: "general",
    status: "published",
    href: `${UNLOCK_AI_ORIGIN}/guides/open-stack/open-stack-field-guide`,
  },
  {
    id: "first-agent-job",
    title: "Find a Real Job for Your First AI Agent",
    description:
      "Turn one repeated frustration into a checked pattern, an honest automation verdict, and a draft-only pilot you can measure.",
    category: "agents",
    status: "published",
    href: `${UNLOCK_AI_ORIGIN}/guides/first-agent-job`,
  },
  {
    id: "chinese-model-bakeoff",
    title: "How to Run a Chinese-Model Bakeoff in Ringer",
    description:
      "Give two models the same job, sources, and pass/fail check, then see which one earns the work.",
    category: "general",
    status: "published",
    href: `${UNLOCK_AI_ORIGIN}/guides/chinese-model-bakeoff`,
  },
  {
    id: "harness-cleaner",
    title: "Clean My AI Harness",
    description:
      "Find the hidden setup shaping your AI and clean it safely with numbered approval and full rollback.",
    category: "general",
    status: "published",
    href: `${UNLOCK_AI_ORIGIN}/guides/harness-cleaner`,
  },
  {
    id: "build-your-own-token-burn-dashboard",
    title: "Build your own token-burn dashboard",
    description:
      "Track where tokens go across Codex, Claude, and ChatGPT, then use burn rate as a fluency signal.",
    category: "general",
    status: "published",
    href: `${UNLOCK_AI_ORIGIN}/guides/build-your-own-token-burn-dashboard`,
  },
  {
    id: "the-one-minute-test",
    title: "The One-Minute Test",
    description:
      "Route any task to chat, one accountable agent, a small agent team, or the manual path — in about a minute, with a next action for whichever route wins.",
    category: "agents",
    status: "published",
    href: `${UNLOCK_AI_ORIGIN}/guides/the-one-minute-test`,
  },
  {
    id: "codex",
    title: "The Ultimate Guide to Codex",
    description:
      "Install the Codex app, set up real projects, and run an AI-first workflow with copy-paste prompts.",
    category: "codex",
    status: "published",
    href: `${UNLOCK_AI_ORIGIN}/guides/codex`,
  },
  {
    id: "codex-side-panel",
    title: "Codex side panel deep-dive",
    description:
      "Use Files, Side chat, Review, Terminal, and Browser to turn Codex from a chat box into a workbench.",
    category: "codex",
    status: "published",
    href: `${UNLOCK_AI_ORIGIN}/guides/codex/side-panel`,
  },
  {
    id: "codex-browser-annotations",
    title: "Codex browser & annotations",
    description:
      "Click an element, attach a note or screenshot, and steer Codex from inside the page you are building.",
    category: "codex",
    status: "published",
    href: `${UNLOCK_AI_ORIGIN}/guides/codex/browser-annotations`,
  },
  {
    id: "codex-threading",
    title: "Codex threading & child threads",
    description:
      "Learn threads, child threads, steering versus queueing, and workspace habits for long-running work.",
    category: "codex",
    status: "published",
    href: `${UNLOCK_AI_ORIGIN}/guides/codex/threading`,
  },
  {
    id: "automation-discovery",
    title: "Automation Discovery",
    description:
      "Read real work traces, audit the evidence, and identify a small set of automations worth proving.",
    category: "agents",
    status: "published",
    href: `${UNLOCK_AI_ORIGIN}/guides/automation-discovery`,
  },
  {
    id: "clean-sensitive-docs-locally",
    title: "Clean Sensitive Docs with a Local Model",
    description:
      "Use a local model to create proposed redacted copies offline on your own machine.",
    category: "general",
    status: "published",
    href: `${UNLOCK_AI_ORIGIN}/guides/clean-sensitive-docs-locally`,
  },
  {
    id: "ai-airlock",
    title: "AI Airlock: Use AI Without Leaking Sensitive Documents",
    description:
      "Review what a local sanitizer removes, seal a verified working copy, and use that copy with an AI tool.",
    category: "general",
    status: "published",
    href: `${UNLOCK_AI_ORIGIN}/guides/ai-airlock`,
  },
  {
    id: "cut-token-waste",
    title: "15 Ways to Cut Token Waste in Codex and Claude",
    description:
      "What each move saves, why it works, and what proves it — including the standalone Token Saver skill.",
    category: "general",
    status: "published",
    href: `${UNLOCK_AI_ORIGIN}/guides/cut-token-waste`,
  },
  {
    id: "build-a-healthcare-claim-appeals-agent",
    title: "Build a Healthcare Claim Appeals Agent",
    description:
      "Assemble Open Skills primitives into an agent that turns a denial letter, EOB, and plan documents into a cited appeal packet.",
    category: "general",
    status: "published",
    href: `${UNLOCK_AI_ORIGIN}/guides/build-a-healthcare-claim-appeals-agent`,
  },
  {
    id: "build-a-tax-prep-organizer-agent",
    title: "Build a Tax Prep Organizer Agent",
    description:
      "Use document-grounded primitives to turn tax documents and real IRS sources into a structured, CPA-ready prep packet.",
    category: "general",
    status: "published",
    href: `${UNLOCK_AI_ORIGIN}/guides/build-a-tax-prep-organizer-agent`,
  },
  {
    id: "build-an-email-follow-up-agent",
    title: "Build an Email Follow-Up Agent",
    description:
      "Point document-grounded primitives at an inbox and produce cited drafts that stop at the send boundary.",
    category: "general",
    status: "published",
    href: `${UNLOCK_AI_ORIGIN}/guides/build-an-email-follow-up-agent`,
  },
  {
    id: "ringer",
    title: "Ringer — swarm power without the frontier bill",
    description:
      "Use a strong model to plan and review while inexpensive cross-model workers implement in parallel and executable checks decide what passed.",
    category: "general",
    status: "published",
    href: `${UNLOCK_AI_ORIGIN}/guides/ringer`,
  },
] as const satisfies readonly GuideLink[];

export type GuideId = (typeof GUIDE_LINKS)[number]["id"];
