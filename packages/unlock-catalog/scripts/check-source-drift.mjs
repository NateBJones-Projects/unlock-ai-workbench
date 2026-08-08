import * as NodeCrypto from "node:crypto";
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { UNLOCK_SOURCE_SNAPSHOT } from "../src/sourceSnapshot.ts";

const knownFlags = new Set(["--require", "--json"]);
const flags = new Set(process.argv.slice(2));
for (const flag of flags) {
  if (!knownFlags.has(flag)) {
    console.error(`Unknown argument: ${flag}\nUsage: check-source-drift.mjs [--require] [--json]`);
    process.exit(2);
  }
}
const requireSources = flags.has("--require");
const jsonOutput = flags.has("--json");

const packageDirectory = NodePath.resolve(
  NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)),
  "..",
);
const repositoryRoot = NodePath.resolve(packageDirectory, "../..");
const configuredSourceRoot = process.env.UNLOCK_AI_SOURCE_ROOT?.trim();
const sourceRoot = configuredSourceRoot || NodePath.resolve(repositoryRoot, "../unlock-ai");

const sources = [
  {
    label: "Open Skills",
    path: NodePath.join(sourceRoot, "src/lib/guide-content/open-skills.ts"),
    expected: UNLOCK_SOURCE_SNAPSHOT.openSkillsSha256,
  },
  {
    label: "Guides",
    path: NodePath.join(sourceRoot, "src/lib/guides.ts"),
    expected: UNLOCK_SOURCE_SNAPSHOT.guidesSha256,
  },
];

const sha256 = (value) => NodeCrypto.createHash("sha256").update(value).digest("hex");

const sourceRootExists = await NodeFSP.stat(sourceRoot).then(
  (stats) => stats.isDirectory(),
  () => false,
);

const results = [];
for (const source of sources) {
  let contents;
  try {
    contents = await NodeFSP.readFile(source.path);
  } catch {
    results.push({
      label: source.label,
      path: source.path,
      expected: source.expected,
      missing: true,
    });
    continue;
  }

  results.push({
    label: source.label,
    path: source.path,
    expected: source.expected,
    actual: sha256(contents),
  });
}

const anyMissing = results.some((result) => result.missing);
// A file missing under an existing checkout is drift (renamed or deleted
// upstream); a missing checkout root is an environment problem, not drift.
const drifted =
  results.some((result) => result.actual !== undefined && result.actual !== result.expected) ||
  (sourceRootExists && anyMissing);

if (jsonOutput) {
  console.log(JSON.stringify({ drifted, sourceRootMissing: !sourceRootExists, sources: results }));
} else {
  for (const result of results) {
    if (result.missing) {
      console.error(`${result.label}: source unavailable at ${result.path}`);
      continue;
    }

    if (result.actual === result.expected) {
      console.log(`${result.label}: current`);
      continue;
    }

    console.error(
      `${result.label}: changed since the ${UNLOCK_SOURCE_SNAPSHOT.capturedAt} snapshot`,
    );
    console.error(`  expected ${result.expected}`);
    console.error(`  actual   ${result.actual}`);
  }

  if (!sourceRootExists) {
    console.error(
      "Set UNLOCK_AI_SOURCE_ROOT to a local Unlock AI checkout before checking catalog drift.",
    );
    if (!requireSources) {
      console.warn("Skipping drift check: sources unavailable (pass --require to fail instead).");
    }
  }

  if (!anyMissing && !drifted) {
    console.log(
      `Unlock catalog snapshot is current: ${UNLOCK_SOURCE_SNAPSHOT.skillCount} skills, ${UNLOCK_SOURCE_SNAPSHOT.runbookCount} runbooks, ${UNLOCK_SOURCE_SNAPSHOT.publishedGuideCount} published guides.`,
    );
  }
}

if (!sourceRootExists && requireSources) process.exitCode = 2;
else if (drifted) process.exitCode = 1;
