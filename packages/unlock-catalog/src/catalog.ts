import { GUIDE_LINKS } from "./guides.ts";
import { SKILLS } from "./skills.ts";
import type {
  CatalogIssue,
  PermissionPolicy,
  ProviderCompatibility,
  SkillBlueprint,
  UnlockCatalog,
  VerificationContract,
} from "./types.ts";
import { WORKFLOWS } from "./workflows.ts";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

export const UNLOCK_CATALOG = {
  schemaVersion: 1,
  version: "0.1.0",
  skills: SKILLS,
  workflows: WORKFLOWS,
  guides: GUIDE_LINKS,
} as const satisfies UnlockCatalog;

function findDuplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }
  return [...duplicates];
}

function validateProviders(
  path: string,
  providers: readonly ProviderCompatibility[],
): CatalogIssue[] {
  const issues: CatalogIssue[] = [];
  for (const duplicate of findDuplicates(providers.map((provider) => provider.driver))) {
    issues.push({ path: `${path}.providers`, message: `Duplicate provider ${duplicate}.` });
  }
  if (!providers.some((provider) => provider.status === "ready")) {
    issues.push({ path: `${path}.providers`, message: "At least one provider must be ready." });
  }
  for (const provider of providers) {
    if (provider.status === "ready" && provider.delivery === "none") {
      issues.push({
        path: `${path}.providers.${provider.driver}`,
        message: "A ready provider needs a delivery mechanism.",
      });
    }
  }
  return issues;
}

function validatePermissions(path: string, policy: PermissionPolicy): CatalogIssue[] {
  const issues: CatalogIssue[] = [];
  if (policy.default !== "deny") {
    issues.push({
      path: `${path}.permissions.default`,
      message: "Catalog policies must deny by default.",
    });
  }
  for (const duplicate of findDuplicates(policy.rules.map((rule) => rule.capability))) {
    issues.push({
      path: `${path}.permissions.rules`,
      message: `Duplicate capability ${duplicate}.`,
    });
  }
  return issues;
}

function validateVerification(path: string, verification: VerificationContract): CatalogIssue[] {
  const issues: CatalogIssue[] = [];
  if (verification.checks.length === 0) {
    issues.push({
      path: `${path}.verification.checks`,
      message: "Add at least one verification check.",
    });
  }
  if (verification.evidence.length === 0) {
    issues.push({ path: `${path}.verification.evidence`, message: "Name required evidence." });
  }
  return issues;
}

export function validateCatalog(catalog: UnlockCatalog): readonly CatalogIssue[] {
  const issues: CatalogIssue[] = [];
  const skillIds = new Set(catalog.skills.map((skill) => skill.id));
  const guideIds = new Set(catalog.guides.map((guide) => guide.id));

  for (const duplicate of findDuplicates(catalog.skills.map((skill) => skill.id))) {
    issues.push({ path: "skills", message: `Duplicate skill id ${duplicate}.` });
  }
  for (const duplicate of findDuplicates(catalog.workflows.map((workflow) => workflow.id))) {
    issues.push({ path: "workflows", message: `Duplicate workflow id ${duplicate}.` });
  }
  for (const duplicate of findDuplicates(catalog.guides.map((guide) => guide.id))) {
    issues.push({ path: "guides", message: `Duplicate guide id ${duplicate}.` });
  }

  catalog.guides.forEach((guide, index) => {
    const path = `guides.${index}`;
    if (guide.status !== "published") {
      issues.push({ path: `${path}.status`, message: "Workbench only exposes published guides." });
    }
    if (!guide.href.startsWith("https://unlock-ai.natebjones.com/")) {
      issues.push({
        path: `${path}.href`,
        message: "Guide links must use the canonical Unlock AI origin.",
      });
    }
    if (guide.title.trim().length === 0 || guide.description.trim().length === 0) {
      issues.push({ path, message: "Guides need a title and description." });
    }
  });

  catalog.skills.forEach((skill, index) => {
    const path = `skills.${index}`;
    if (!SLUG_PATTERN.test(skill.id) || !SLUG_PATTERN.test(skill.install.name)) {
      issues.push({ path, message: "Skill ids and install names must be lowercase hyphen slugs." });
    }
    if (!SEMVER_PATTERN.test(skill.version)) {
      issues.push({ path: `${path}.version`, message: "Skill version must be semantic x.y.z." });
    }
    if (skill.instructions.length === 0 || skill.triggers.length === 0) {
      issues.push({ path, message: "Skills need triggers and executable instructions." });
    }
    for (const duplicate of findDuplicates(skill.setup.map((field) => field.id))) {
      issues.push({ path: `${path}.setup`, message: `Duplicate setup field ${duplicate}.` });
    }
    for (const guideId of skill.guideIds) {
      if (!guideIds.has(guideId)) {
        issues.push({ path: `${path}.guideIds`, message: `Unknown guide ${guideId}.` });
      }
    }
    issues.push(...validateProviders(path, skill.providers));
    issues.push(...validatePermissions(path, skill.permissions));
    issues.push(...validateVerification(path, skill.verification));
  });

  catalog.workflows.forEach((workflow, index) => {
    const path = `workflows.${index}`;
    if (!SLUG_PATTERN.test(workflow.id) || !SEMVER_PATTERN.test(workflow.version)) {
      issues.push({ path, message: "Workflow id and version must be valid." });
    }
    if (workflow.launchPrompt.trim().length === 0 || workflow.steps.length === 0) {
      issues.push({ path, message: "Launchable workflows need a prompt and at least one step." });
    }
    for (const duplicate of findDuplicates(workflow.steps.map((step) => step.id))) {
      issues.push({ path: `${path}.steps`, message: `Duplicate workflow step ${duplicate}.` });
    }
    for (const step of workflow.steps) {
      if (step.skillId !== undefined && !skillIds.has(step.skillId)) {
        issues.push({
          path: `${path}.steps.${step.id}`,
          message: `Unknown skill ${step.skillId}.`,
        });
      }
    }
    for (const guideId of workflow.guideIds) {
      if (!guideIds.has(guideId)) {
        issues.push({ path: `${path}.guideIds`, message: `Unknown guide ${guideId}.` });
      }
    }
    issues.push(...validateProviders(path, workflow.providers));
    issues.push(...validatePermissions(path, workflow.permissions));
    issues.push(...validateVerification(path, workflow.verification));
  });

  return issues;
}

export function validateSkillBlueprints(
  blueprints: readonly SkillBlueprint[],
): readonly CatalogIssue[] {
  const issues: CatalogIssue[] = [];
  blueprints.forEach((blueprint, index) => {
    if (blueprint.installName !== undefined && !SLUG_PATTERN.test(blueprint.installName)) {
      issues.push({
        path: `blueprints.${index}.installName`,
        message: "Blueprint install names must be lowercase hyphen slugs.",
      });
    }
  });
  return issues;
}

export function assertValidCatalog(catalog: UnlockCatalog): void {
  const issues = validateCatalog(catalog);
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
  }
}

export function getSkill(id: string) {
  return SKILLS.find((skill) => skill.id === id);
}

export function getWorkflow(id: string) {
  return WORKFLOWS.find((workflow) => workflow.id === id);
}

export function getGuide(id: string) {
  return GUIDE_LINKS.find((guide) => guide.id === id);
}
