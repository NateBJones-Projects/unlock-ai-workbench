import * as NodeCrypto from "node:crypto";
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import { UNLOCK_SOURCE_SNAPSHOT } from "../src/sourceSnapshot.ts";

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
let drifted = false;

for (const source of sources) {
  let contents;
  try {
    contents = await NodeFSP.readFile(source.path);
  } catch {
    console.error(`${source.label}: source unavailable at ${source.path}`);
    console.error(
      "Set UNLOCK_AI_SOURCE_ROOT to a local Unlock AI checkout before checking catalog drift.",
    );
    process.exitCode = 2;
    break;
  }

  const actual = sha256(contents);
  if (actual === source.expected) {
    console.log(`${source.label}: current`);
    continue;
  }

  drifted = true;
  console.error(`${source.label}: changed since the ${UNLOCK_SOURCE_SNAPSHOT.capturedAt} snapshot`);
  console.error(`  expected ${source.expected}`);
  console.error(`  actual   ${actual}`);
}

if (process.exitCode === undefined && drifted) process.exitCode = 1;
if (process.exitCode === undefined) {
  console.log(
    `Unlock catalog snapshot is current: ${UNLOCK_SOURCE_SNAPSHOT.skillCount} skills, ${UNLOCK_SOURCE_SNAPSHOT.runbookCount} runbooks, ${UNLOCK_SOURCE_SNAPSHOT.publishedGuideCount} published guides.`,
  );
}
