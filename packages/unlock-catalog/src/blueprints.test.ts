import { describe, expect, it } from "vite-plus/test";

import { RUNBOOK_BLUEPRINTS, SKILL_BLUEPRINT_CATEGORIES, SKILL_BLUEPRINTS } from "./blueprints.ts";
import { SKILLS } from "./skills.ts";
import { WORKFLOWS } from "./workflows.ts";

const EXPECTED_SKILL_IDS = [
  "image-generation-gateway",
  "current-information-search",
  "media-transcription",
  "heavy-file-ingestion",
  "html-artifact-builder",
  "token-saver",
  "pdf-document-ingestion",
  "document-chunking-tagging",
  "case-data-normalization",
  "sqlite-case-store",
  "open-brain-case-store",
  "deterministic-retrieval-map",
  "citation-guard",
  "packet-export",
  "human-gate",
  "brain-dump-processor",
  "meeting-synthesis",
  "weekly-signal-diff",
  "assumption-checker",
  "reading-pack-builder",
  "personal-voice-skill",
  "new-release-briefing",
  "audience-calibrated-content-system",
  "branded-image-prompting-guide",
  "frontend-taste-system",
  "personal-site-publisher",
  "image-model-comparison-arena",
  "essay-illustration-gallery",
  "radio-edit",
  "broll-pipeline",
  "ai-editing-assistant",
  "testing-runbook-creator",
  "page-testing-memory",
  "browser-automation-qa",
  "goal-prompt-generator",
  "visible-delegation",
  "session-operating-map",
  "self-authored-pr-merge",
  "stakeholder-update-email",
  "session-to-skill-extractor",
  "agentic-harness-designer",
] as const;

const EXPECTED_RUNBOOK_IDS = [
  "talk-to-published",
  "release-day",
  "video-production-line",
  "ship-a-page-you-can-trust",
  "the-research-engine",
  "delegate-and-verify",
  "the-flywheel",
  "claim-appeal-packet",
  "tax-prep-packet",
  "email-follow-up-packet",
] as const;

describe("Unlock AI Open Skills blueprints", () => {
  it("carries the exact 41-skill inventory in source order", () => {
    expect(SKILL_BLUEPRINTS).toHaveLength(41);
    expect(SKILL_BLUEPRINTS.map((skill) => skill.id)).toEqual(EXPECTED_SKILL_IDS);
  });

  it("carries all eight categories with the exact source distribution", () => {
    expect(SKILL_BLUEPRINT_CATEGORIES).toHaveLength(8);
    expect(
      SKILL_BLUEPRINT_CATEGORIES.map((category) => [
        category.id,
        SKILL_BLUEPRINTS.filter((skill) => skill.category === category.id).length,
      ]),
    ).toEqual([
      ["core-infrastructure", 5],
      ["context-engineering", 10],
      ["research-thinking", 5],
      ["writing-voice-content", 4],
      ["web-publishing-frontend", 4],
      ["video-media-production", 3],
      ["testing-quality", 3],
      ["agent-operations", 7],
    ]);
  });

  it("carries the exact ten-runbook inventory in source order", () => {
    expect(RUNBOOK_BLUEPRINTS).toHaveLength(10);
    expect(RUNBOOK_BLUEPRINTS.map((runbook) => runbook.id)).toEqual(EXPECTED_RUNBOOK_IDS);
  });

  it("keeps every source field and canonical source URL consumable", () => {
    for (const skill of SKILL_BLUEPRINTS) {
      expect(skill.title).not.toHaveLength(0);
      expect(skill.whatItDoes).not.toHaveLength(0);
      expect(skill.whyBuildIt).not.toHaveLength(0);
      expect(skill.whatYouNeed.length).toBeGreaterThan(0);
      expect(skill.setupPrompt).not.toHaveLength(0);
      expect(skill.sourceUrl).toBe(
        `https://unlock-ai.natebjones.com/open-skills/${skill.category}#${skill.id}`,
      );
    }

    for (const runbook of RUNBOOK_BLUEPRINTS) {
      expect(runbook.chain.length).toBeGreaterThan(0);
      expect(runbook.description).not.toHaveLength(0);
      expect(runbook.payoff).not.toHaveLength(0);
      expect(runbook.sourceUrl).toBe(
        `https://unlock-ai.natebjones.com/open-skills/runbooks#${runbook.id}`,
      );
    }
  });

  it("preserves the modeled v1 subsets as overlays on the full library", () => {
    const blueprintSkillIds = new Set(SKILL_BLUEPRINTS.map((skill) => skill.id));
    const blueprintRunbookIds = new Set(RUNBOOK_BLUEPRINTS.map((runbook) => runbook.id));

    expect(SKILLS).toHaveLength(10);
    expect(WORKFLOWS).toHaveLength(3);
    expect(SKILLS.every((skill) => blueprintSkillIds.has(skill.id))).toBe(true);
    expect(WORKFLOWS.every((workflow) => blueprintRunbookIds.has(workflow.id))).toBe(true);
  });
});
