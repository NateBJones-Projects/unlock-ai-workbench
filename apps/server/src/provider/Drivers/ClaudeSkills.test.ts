import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

import { discoverClaudeSkills, readUnlockSkillMarkers } from "./ClaudeSkills.ts";

const writeSkill = Effect.fn(function* (
  skillsDir: string,
  directoryName: string,
  contents: string,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const skillDir = path.join(skillsDir, directoryName);
  yield* fs.makeDirectory(skillDir, { recursive: true });
  yield* fs.writeFileString(path.join(skillDir, "SKILL.md"), contents);
});

it.layer(NodeServices.layer)("discoverClaudeSkills", (it) => {
  it.effect("discovers user and project skills with frontmatter metadata", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tempDir = yield* fs.makeTempDirectoryScoped({ prefix: "t3-claude-skills-" });
      const configDir = path.join(tempDir, "claude-home");
      const workspace = path.join(tempDir, "workspace");

      yield* writeSkill(
        path.join(configDir, "skills"),
        "codex-review",
        [
          "---",
          "name: codex-review",
          "description: Ask Codex for a review.",
          "---",
          "",
          "# Body",
        ].join("\n"),
      );
      yield* writeSkill(
        path.join(workspace, ".claude", "skills"),
        "deploy",
        ["---", "name: deploy", "description: Deploy the app.", "---", "", "# Deploy"].join("\n"),
      );

      const skills = yield* discoverClaudeSkills({ homePath: configDir }, workspace);

      assert.deepEqual(skills, [
        {
          name: "codex-review",
          path: path.join(configDir, "skills", "codex-review", "SKILL.md"),
          enabled: true,
          scope: "user",
          description: "Ask Codex for a review.",
        },
        {
          name: "deploy",
          path: path.join(workspace, ".claude", "skills", "deploy", "SKILL.md"),
          enabled: true,
          scope: "project",
          description: "Deploy the app.",
        },
      ]);
    }),
  );

  it.effect("discovers workbench-managed skills, losing to project on name collision", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tempDir = yield* fs.makeTempDirectoryScoped({ prefix: "t3-claude-skills-" });
      const configDir = path.join(tempDir, "claude-home");
      const workspace = path.join(tempDir, "workspace");
      const workbenchSkillsDir = path.join(tempDir, "workbench-skills");

      // Same name at all three scopes: workbench beats the stale user copy,
      // project beats workbench.
      yield* writeSkill(
        path.join(configDir, "skills"),
        "citation-guard",
        ["---", "name: citation-guard", "description: Stale personal copy.", "---"].join("\n"),
      );
      yield* writeSkill(
        workbenchSkillsDir,
        "citation-guard",
        ["---", "name: citation-guard", "description: Workbench catalog copy.", "---"].join("\n"),
      );
      yield* writeSkill(
        workbenchSkillsDir,
        "token-saver",
        ["---", "name: token-saver", "description: Workbench only.", "---"].join("\n"),
      );
      yield* writeSkill(
        path.join(workspace, ".claude", "skills"),
        "token-saver",
        ["---", "name: token-saver", "description: Project override.", "---"].join("\n"),
      );

      const skills = yield* discoverClaudeSkills(
        { homePath: configDir },
        workspace,
        undefined,
        workbenchSkillsDir,
      );

      assert.deepEqual(skills, [
        {
          name: "citation-guard",
          path: path.join(workbenchSkillsDir, "citation-guard", "SKILL.md"),
          enabled: true,
          scope: "workbench",
          description: "Workbench catalog copy.",
        },
        {
          name: "token-saver",
          path: path.join(workspace, ".claude", "skills", "token-saver", "SKILL.md"),
          enabled: true,
          scope: "project",
          description: "Project override.",
        },
      ]);
    }),
  );

  it.effect("carries Unlock markers from frontmatter and omits them when absent", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tempDir = yield* fs.makeTempDirectoryScoped({ prefix: "t3-claude-skills-" });
      const configDir = path.join(tempDir, "claude-home");
      const skillsDir = path.join(configDir, "skills");

      yield* writeSkill(
        skillsDir,
        "citation-guard",
        [
          "---",
          "name: citation-guard",
          "description: Validate citations.",
          "x-unlock-pack: citation-guard@0.1.0",
          "x-unlock-personalized: 2026-08-07",
          "---",
        ].join("\n"),
      );
      yield* writeSkill(
        skillsDir,
        "plain-skill",
        ["---", "name: plain-skill", "description: No markers.", "---"].join("\n"),
      );

      const skills = yield* discoverClaudeSkills({ homePath: configDir }, undefined);

      const marked = skills.find((skill) => skill.name === "citation-guard");
      assert.equal(marked?.unlockPack, "citation-guard@0.1.0");
      assert.equal(marked?.personalizedAt, "2026-08-07");

      const plain = skills.find((skill) => skill.name === "plain-skill");
      assert.equal(plain?.unlockPack, undefined);
      assert.equal(plain?.personalizedAt, undefined);
    }),
  );

  it.effect("reads Unlock markers from a SKILL.md path or a skill directory", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tempDir = yield* fs.makeTempDirectoryScoped({ prefix: "t3-claude-skills-" });
      const skillsDir = path.join(tempDir, "skills");

      yield* writeSkill(
        skillsDir,
        "packet-export",
        [
          "---",
          "name: packet-export",
          "x-unlock-pack: packet-export@0.1.0",
          "x-unlock-personalized: 2026-08-07",
          "---",
        ].join("\n"),
      );

      // The Codex app-server reports skill paths without frontmatter, so the
      // driver reads markers from disk — from the file or its directory.
      const fromFile = yield* readUnlockSkillMarkers(
        path.join(skillsDir, "packet-export", "SKILL.md"),
      );
      assert.deepEqual(fromFile, {
        unlockPack: "packet-export@0.1.0",
        personalizedAt: "2026-08-07",
      });

      const fromDirectory = yield* readUnlockSkillMarkers(path.join(skillsDir, "packet-export"));
      assert.deepEqual(fromDirectory, fromFile);

      const fromMissing = yield* readUnlockSkillMarkers(path.join(skillsDir, "not-installed"));
      assert.deepEqual(fromMissing, {});
    }),
  );

  it.effect("prefers project skills over user skills on name collisions", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tempDir = yield* fs.makeTempDirectoryScoped({ prefix: "t3-claude-skills-" });
      const configDir = path.join(tempDir, "claude-home");
      const workspace = path.join(tempDir, "workspace");

      yield* writeSkill(
        path.join(configDir, "skills"),
        "deploy",
        ["---", "name: deploy", "description: User deploy.", "---"].join("\n"),
      );
      yield* writeSkill(
        path.join(workspace, ".claude", "skills"),
        "deploy",
        ["---", "name: deploy", "description: Project deploy.", "---"].join("\n"),
      );

      const skills = yield* discoverClaudeSkills({ homePath: configDir }, workspace);

      assert.equal(skills.length, 1);
      assert.equal(skills[0]?.scope, "project");
      assert.equal(skills[0]?.description, "Project deploy.");
    }),
  );

  it.effect("falls back to the directory name and skips malformed frontmatter", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tempDir = yield* fs.makeTempDirectoryScoped({ prefix: "t3-claude-skills-" });
      const configDir = path.join(tempDir, "claude-home");
      const skillsDir = path.join(configDir, "skills");

      yield* writeSkill(skillsDir, "no-frontmatter", "# Just a heading\n");
      yield* writeSkill(skillsDir, "broken-yaml", "---\nname: [unclosed\n---\n");
      // A stray file (not a directory with SKILL.md) must be skipped.
      yield* fs.makeDirectory(skillsDir, { recursive: true });
      yield* fs.writeFileString(path.join(skillsDir, "README.md"), "not a skill");

      const skills = yield* discoverClaudeSkills({ homePath: configDir }, undefined);

      // A skill with no frontmatter falls back to its directory name; a skill
      // whose frontmatter fails to parse is skipped entirely (Claude Code
      // won't load it either).
      assert.deepEqual(
        skills.map((skill) => skill.name),
        ["no-frontmatter"],
      );
      assert.equal(skills[0]?.description, undefined);
    }),
  );

  it.effect("honors CLAUDE_CONFIG_DIR from the environment when homePath is unset", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tempDir = yield* fs.makeTempDirectoryScoped({ prefix: "t3-claude-skills-" });
      const environmentConfigDir = path.join(tempDir, "env-config");

      yield* writeSkill(
        path.join(environmentConfigDir, "skills"),
        "env-skill",
        ["---", "name: env-skill", "description: From env config dir.", "---"].join("\n"),
      );

      const skills = yield* discoverClaudeSkills({ homePath: "" }, undefined, {
        CLAUDE_CONFIG_DIR: environmentConfigDir,
      });

      assert.deepEqual(
        skills.map((skill) => skill.name),
        ["env-skill"],
      );

      // An explicit homePath wins over the environment variable, matching
      // makeClaudeEnvironment which overwrites CLAUDE_CONFIG_DIR for the CLI.
      const explicitHome = path.join(tempDir, "explicit-home");
      yield* writeSkill(
        path.join(explicitHome, "skills"),
        "explicit-skill",
        ["---", "name: explicit-skill", "---"].join("\n"),
      );
      const explicitSkills = yield* discoverClaudeSkills({ homePath: explicitHome }, undefined, {
        CLAUDE_CONFIG_DIR: environmentConfigDir,
      });
      assert.deepEqual(
        explicitSkills.map((skill) => skill.name),
        ["explicit-skill"],
      );
    }),
  );

  it.effect("resolves a relative CLAUDE_CONFIG_DIR against the workspace cwd", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tempDir = yield* fs.makeTempDirectoryScoped({ prefix: "t3-claude-skills-" });
      const workspace = path.join(tempDir, "workspace");
      yield* fs.makeDirectory(workspace, { recursive: true });

      // The spawned CLI resolves a relative CLAUDE_CONFIG_DIR against its own
      // cwd (the workspace), so discovery must do the same.
      yield* writeSkill(
        path.join(workspace, "relative-config", "skills"),
        "relative-skill",
        ["---", "name: relative-skill", "---"].join("\n"),
      );

      const skills = yield* discoverClaudeSkills({ homePath: "" }, workspace, {
        CLAUDE_CONFIG_DIR: "relative-config",
      });

      assert.deepEqual(
        skills.map((skill) => skill.name),
        ["relative-skill"],
      );
      assert.equal(skills[0]?.scope, "user");
    }),
  );

  it.effect("returns an empty list when no skill roots exist", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tempDir = yield* fs.makeTempDirectoryScoped({ prefix: "t3-claude-skills-" });

      const skills = yield* discoverClaudeSkills(
        { homePath: path.join(tempDir, "missing-home") },
        path.join(tempDir, "missing-workspace"),
      );

      assert.deepEqual(skills, []);
    }),
  );
});
