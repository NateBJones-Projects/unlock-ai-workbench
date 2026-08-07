# Catalog Sync

> For maintainers. Using T3 Code? See [docs/user](../user/).

The Unlock catalog (`packages/unlock-catalog`) is hand-curated from two files in the private
Unlock AI repository:

- `src/lib/guide-content/open-skills.ts`
- `src/lib/guides.ts`

`packages/unlock-catalog/src/sourceSnapshot.ts` pins a sha256 for each file at the moment the
catalog was last curated. The `Unlock Catalog Sync` workflow
(`.github/workflows/unlock-catalog-sync.yml`) detects when the source library has moved past that
snapshot and keeps one tracked issue up to date. It never edits catalog content, hashes, or any
other repo content — detection is automated, catalog editing stays a reviewed human/agent task.

## How The Pipeline Works

Daily (05:23 UTC) and on manual dispatch, the workflow:

1. checks out this repository, then the Unlock AI repository into `./unlock-ai` inside the
   workspace (`actions/checkout` cannot write outside it, so `UNLOCK_AI_SOURCE_ROOT` points the
   check there instead of the local-default sibling path)
2. runs `node packages/unlock-catalog/scripts/check-source-drift.mjs --require --json` and parses
   the result
3. if drifted: creates — or updates in place — an open issue labeled `catalog-drift` titled
   "Unlock AI library drift detected", listing each drifted source with expected vs actual hash
   and the Unlock AI commit sha that was checked
4. if not drifted: closes any open `catalog-drift` issue with a comment

The workflow runs with `contents: read` and `issues: write` only. A failed run (exit 2 from the
drift step) means the Unlock AI checkout itself broke — usually the token, see below — not that
drift was found.

The Unlock AI repository slug lives in the `UNLOCK_AI_REPOSITORY` env var at the top of the
workflow file; changing it is a one-line edit.

## Required Secret

`UNLOCK_AI_SYNC_TOKEN` — a fine-grained personal access token with read-only **Contents**
permission on the Unlock AI repository, stored as an Actions secret on this repository. It is used
only to check out the source; the issue steps use the default `GITHUB_TOKEN`.

When the token expires the workflow fails at the "Checkout Unlock AI source" step. Rotate by
minting a new fine-grained PAT with the same read-only scope and updating the secret.

## Running The Check Locally

With an Unlock AI checkout as a sibling of this repository (`../unlock-ai`):

```sh
pnpm --filter @t3tools/unlock-catalog source:check
```

With a checkout elsewhere:

```sh
UNLOCK_AI_SOURCE_ROOT=/path/to/unlock-ai node packages/unlock-catalog/scripts/check-source-drift.mjs
```

Flags:

- no flags: human-readable report; missing sources warn and exit 0 so local runs without a
  checkout stay green
- `--require`: missing sources fail with exit 2 (what CI uses)
- `--json`: machine-readable `{drifted, sources: [{label, path, expected, actual|missing}]}` on
  stdout

Exit codes: 0 current (or sources unavailable without `--require`), 1 drift detected, 2 sources
unavailable with `--require`.

## When The Issue Fires

The issue means the source library changed; the catalog itself is still valid, just behind. Update
it deliberately:

1. Diff the drifted files in the Unlock AI repository since the `capturedAt` date in
   `sourceSnapshot.ts` to see what actually changed.
2. Update the curated data in `packages/unlock-catalog/src` (blueprints, guides, skills,
   workflows) to reflect the changes.
3. Re-pin the hashes and counts in `packages/unlock-catalog/src/sourceSnapshot.ts` from the new
   source files.
4. Update the catalog tests.
5. Bump the catalog `version` in `packages/unlock-catalog/src/catalog.ts`.
6. Verify with `pnpm --filter @t3tools/unlock-catalog source:check` against the new source, plus
   the package's tests and typecheck.

The next scheduled run closes the issue once the pinned hashes match the source again.

## Deliberate Boundary

The workflow detects and reports; it never rewrites catalog content or re-pins hashes. Silently
absorbing upstream changes would defeat the point of a curated catalog — every sync is a reviewed
change with a human or agent reading what actually changed upstream.
