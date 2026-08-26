import {
  blueprintInstallName,
  renderSkillMarkdown,
  type SkillBlueprint,
  type SkillManifest,
} from "@t3tools/unlock-catalog";

/**
 * Where an installed skill must be written. When the server advertises its
 * managed skills directory the skill lands inside the workbench's own state
 * (loaded into every session as a plugin / extra skills root); the provider's
 * personal config dir is only the fallback for servers that predate managed
 * skills.
 */
function installLocationInstruction(
  installName: string,
  workbenchSkillsDir: string | null | undefined,
): string {
  if (workbenchSkillsDir) {
    return `Install it INSIDE the Unlock AI Workbench's managed skills directory: write the skill to "${workbenchSkillsDir}/${installName}/SKILL.md". Do NOT install into the provider's personal config (such as ~/.claude/skills or ~/.codex/skills) — the Workbench owns its skills and loads that managed directory into every session automatically.`;
  }
  return `Install it at user scope using the provider's native skill directory.`;
}

export function verifiedSkillSetupPrompt(
  skill: SkillManifest,
  workbenchSkillsDir?: string | null,
): string {
  return `Set up this verified Unlock AI skill pack for the agent provider running this thread.

${installLocationInstruction(skill.install.name, workbenchSkillsDir)} Codex and Claude Code are verified in this v1. If this provider cannot load skills from that location, do not improvise a hidden installation: explain the limitation and use the instructions only for this thread.

Do not overwrite unrelated files. After writing the skill, validate its frontmatter, report the exact installed path, and explain how I invoke it. If you collect my setup answers and write them into the skill, also set "x-unlock-personalized: <today's date as YYYY-MM-DD>" in its frontmatter — that marker means the interview happened, so never set it without my answers. Tell me to start a new thread to use the skill — fresh sessions load newly installed skills, and this session cannot. Then stop; do not begin a separate task.

<skill_file>
${renderSkillMarkdown(skill)}
</skill_file>`;
}

export function blueprintSkillSetupPrompt(
  skill: SkillBlueprint,
  workbenchSkillsDir?: string | null,
): string {
  return `Adapt this Unlock AI blueprint into a native skill for the agent provider running this thread.

This is a library blueprint, not a pre-verified pack. First identify this provider's native skill format and interview me for every missing preference or input. Never ask me to paste a secret into chat; propose an environment variable or secure provider-native store instead. Stop after the interview and wait for my answers before writing files.

When I answer, name the skill exactly "${blueprintInstallName(skill)}". ${installLocationInstruction(blueprintInstallName(skill), workbenchSkillsDir)} Validate the finished skill and report its exact path. In the finished skill's frontmatter set "x-unlock-pack: ${skill.id}@blueprint" and "x-unlock-personalized: <today's date as YYYY-MM-DD>" — my interview answers are what earn the personalized marker. Do not install software, call a paid API, publish, send, mutate an account, or transmit private material without a separate explicit approval. Any test must use a safe fixture unless I approve the real input and cost.

<unlock_ai_blueprint id="${skill.id}">
${skill.setupPrompt}
</unlock_ai_blueprint>`;
}

export function skillUsePrompt(skillName: string): string {
  return `Use the ${skillName} skill for my next request. Briefly tell me what input you need, then wait.`;
}
