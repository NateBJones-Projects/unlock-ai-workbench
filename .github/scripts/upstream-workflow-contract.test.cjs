const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "../..");
const workflowPaths = [
  ".github/workflows/upstream-watch.yml",
  ".github/workflows/upstream-sync.yml",
];

for (const workflowPath of workflowPaths) {
  test(`${workflowPath} pins GitHub CLI writes to the fork`, () => {
    const source = fs.readFileSync(path.join(repoRoot, workflowPath), "utf8");

    assert.match(
      source,
      /^  GH_REPO: \$\{\{ github\.repository \}\}$/m,
      "GH_REPO must remain pinned after the workflow adds the upstream remote",
    );
    assert.doesNotMatch(
      source,
      /gh label create[\s\S]{0,200}2>\/dev\/null \|\| true/,
      "label creation errors must remain visible",
    );
  });
}
