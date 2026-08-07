export const PROVIDER_DRIVERS = ["codex", "claudeAgent", "opencode", "cursor", "grok"] as const;

export type ProviderDriver = (typeof PROVIDER_DRIVERS)[number];

export type ProviderSupportStatus = "ready" | "planned" | "unsupported";

export type ProviderDelivery = "skill-file" | "prompt" | "none";

export type ProviderCompatibility = {
  readonly driver: ProviderDriver;
  readonly status: ProviderSupportStatus;
  readonly delivery: ProviderDelivery;
  readonly note: string;
};

export const PERMISSION_CAPABILITIES = [
  "filesystem.read",
  "filesystem.write",
  "process.execute",
  "network.read",
  "credentials.use",
  "external.publish",
  "external.send",
  "account.mutate",
  "sensitive-data.transmit",
] as const;

export type PermissionCapability = (typeof PERMISSION_CAPABILITIES)[number];

export type PermissionDecision = "allow" | "ask" | "deny";

export type PermissionRule = {
  readonly capability: PermissionCapability;
  readonly decision: PermissionDecision;
  readonly reason: string;
};

export type PermissionPolicy = {
  readonly default: "deny";
  readonly rules: readonly PermissionRule[];
};

export type SetupField = {
  readonly id: string;
  readonly label: string;
  readonly kind: "path" | "secret" | "choice" | "text";
  readonly required: boolean;
  readonly sensitive?: boolean;
  readonly help: string;
};

export type VerificationContract = {
  readonly mode: "automated" | "manual" | "hybrid";
  readonly blocking: boolean;
  readonly summary: string;
  readonly checks: readonly string[];
  readonly evidence: readonly string[];
};

export type SkillCategory =
  | "core-infrastructure"
  | "context-engineering"
  | "research-thinking"
  | "writing-voice-content";

export type GuideCategory = "agents" | "codex" | "general";

export type GuideStatus = "draft" | "review" | "published";

export type GuideLink = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly category: GuideCategory;
  readonly status: GuideStatus;
  readonly href: `https://${string}`;
};

export type SkillManifest = {
  readonly schemaVersion: 1;
  readonly kind: "skill";
  readonly id: string;
  readonly version: string;
  readonly title: string;
  readonly summary: string;
  readonly category: SkillCategory;
  readonly install: {
    readonly name: string;
    readonly entrypoint: "SKILL.md";
  };
  readonly triggers: readonly string[];
  readonly requirements: readonly string[];
  readonly setup: readonly SetupField[];
  readonly instructions: readonly string[];
  readonly outputs: readonly string[];
  readonly providers: readonly ProviderCompatibility[];
  readonly permissions: PermissionPolicy;
  readonly verification: VerificationContract;
  readonly guideIds: readonly string[];
  readonly sourceUrl: `https://${string}`;
};

/**
 * Lightweight source-library metadata. These blueprints mirror Unlock AI's full
 * Open Skills field guide without claiming the provider, permission, and
 * verification guarantees carried by the installable SkillManifest subset.
 */
export type SkillBlueprintCategory = {
  readonly id: string;
  readonly number: string;
  readonly title: string;
  readonly description: string;
  readonly sourceUrl: GuideLink["href"];
};

export type SkillBlueprint = {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly categoryNumber: string;
  readonly categoryTitle: string;
  readonly categoryDescription: string;
  readonly whatItDoes: string;
  readonly whyBuildIt: string;
  readonly whatYouNeed: readonly string[];
  readonly setupPrompt: string;
  readonly sourceUrl: GuideLink["href"];
};

export type RunbookBlueprint = {
  readonly id: string;
  readonly number: string;
  readonly title: string;
  readonly chain: readonly string[];
  readonly description: string;
  readonly payoff: string;
  readonly sourceUrl: GuideLink["href"];
};

export type WorkflowGate = {
  readonly type: "human";
  readonly prompt: string;
  readonly required: true;
};

export type WorkflowStep = {
  readonly id: string;
  readonly title: string;
  readonly instruction: string;
  readonly skillId?: string;
  readonly gate?: WorkflowGate;
};

export type WorkflowManifest = {
  readonly schemaVersion: 1;
  readonly kind: "workflow";
  readonly id: string;
  readonly version: string;
  readonly title: string;
  readonly summary: string;
  readonly payoff: string;
  readonly inputPrompt: string;
  readonly launchPrompt: string;
  readonly steps: readonly WorkflowStep[];
  readonly providers: readonly ProviderCompatibility[];
  readonly permissions: PermissionPolicy;
  readonly verification: VerificationContract;
  readonly guideIds: readonly string[];
  readonly sourceUrl: `https://${string}`;
};

export type UnlockCatalog = {
  readonly schemaVersion: 1;
  readonly version: string;
  readonly skills: readonly SkillManifest[];
  readonly workflows: readonly WorkflowManifest[];
  readonly guides: readonly GuideLink[];
};

export type CatalogIssue = {
  readonly path: string;
  readonly message: string;
};
