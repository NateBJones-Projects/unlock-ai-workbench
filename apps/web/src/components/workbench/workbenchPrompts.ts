import {
  blueprintInstallName,
  renderSkillMarkdown,
  type SkillBlueprint,
  type SkillManifest,
} from "@t3tools/unlock-catalog";

export function verifiedSkillSetupPrompt(skill: SkillManifest): string {
  return `Set up this verified Unlock AI skill pack for the agent provider running this thread.

Install it at user scope using the provider's native skill directory. Codex and Claude Code are verified in this v1. If this provider does not support native skills, do not improvise a hidden installation: explain the limitation and use the instructions only for this thread.

Do not overwrite unrelated files. After writing the skill, validate its frontmatter, report the exact installed path, and explain how I invoke it. Tell me to start a new thread to use the skill — fresh sessions load newly installed skills, and this session cannot. Then stop; do not begin a separate task.

<skill_file>
${renderSkillMarkdown(skill)}
</skill_file>`;
}

export function blueprintSkillSetupPrompt(skill: SkillBlueprint): string {
  return `Adapt this Unlock AI blueprint into a native skill for the agent provider running this thread.

This is a library blueprint, not a pre-verified pack. First identify this provider's native skill format and interview me for every missing preference or input. Never ask me to paste a secret into chat; propose an environment variable or secure provider-native store instead. Stop after the interview and wait for my answers before writing files.

When I answer, keep the installation user-scoped, name the skill exactly "${blueprintInstallName(skill)}", validate the finished skill, and report its exact path. Do not install software, call a paid API, publish, send, mutate an account, or transmit private material without a separate explicit approval. Any test must use a safe fixture unless I approve the real input and cost.

<unlock_ai_blueprint id="${skill.id}">
${skill.setupPrompt}
</unlock_ai_blueprint>`;
}

export function skillUsePrompt(skillName: string): string {
  return `Use the ${skillName} skill for my next request. Briefly tell me what input you need, then wait.`;
}
