import type { ProviderCompatibility } from "./types.ts";

export const V1_SKILL_PROVIDER_COMPATIBILITY = [
  {
    driver: "codex",
    status: "ready",
    delivery: "skill-file",
    note: "Install as a native Codex skill.",
  },
  {
    driver: "claudeAgent",
    status: "ready",
    delivery: "skill-file",
    note: "Install as a native Claude Code skill.",
  },
  {
    driver: "opencode",
    status: "planned",
    delivery: "prompt",
    note: "The v1 catalog can show this skill, but native installation is not verified yet.",
  },
  {
    driver: "cursor",
    status: "unsupported",
    delivery: "none",
    note: "No v1 skill-package adapter.",
  },
  {
    driver: "grok",
    status: "unsupported",
    delivery: "none",
    note: "No v1 skill-package adapter.",
  },
] as const satisfies readonly ProviderCompatibility[];

export const V1_WORKFLOW_PROVIDER_COMPATIBILITY = [
  {
    driver: "codex",
    status: "ready",
    delivery: "prompt",
    note: "Launch in a Codex thread with native v1 skills available.",
  },
  {
    driver: "claudeAgent",
    status: "ready",
    delivery: "prompt",
    note: "Launch in a Claude Code thread with native v1 skills available.",
  },
  {
    driver: "opencode",
    status: "planned",
    delivery: "prompt",
    note: "Prompt launch is planned after the OpenCode skill adapter is verified.",
  },
  {
    driver: "cursor",
    status: "unsupported",
    delivery: "none",
    note: "No v1 workflow adapter.",
  },
  {
    driver: "grok",
    status: "unsupported",
    delivery: "none",
    note: "No v1 workflow adapter.",
  },
] as const satisfies readonly ProviderCompatibility[];
