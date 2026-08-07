# Upstream sync and watch

Unlock AI Workbench is a fork of [pingdotgg/t3code](https://github.com/pingdotgg/t3code). Two GitHub Actions keep the T3 Code foundation fresh and make sure upstream breaking changes never arrive as a surprise. Neither workflow ever commits to this repository directly.

## Policy

**Upstream merges land through reviewed PRs only — never direct pushes.** The sync workflow opens a PR for clean merges and an issue for conflicted ones; a human reviews and merges. When merging by hand, push a branch and open a PR the same way.

## The touchpoints file

`.github/upstream-touchpoints.json` is the machine-readable list of fork-modified paths where upstream changes collide with the Unlock AI Workbench layer (Ringer server wiring, workbench UI components, desktop identity, launcher, contracts). Each entry carries a one-line `why`. Entries may be files or directory prefixes (git pathspec semantics).

Every entry was verified fork-modified via `git log --oneline a8cd2ad2..HEAD -- <path>` (a8cd2ad2 is the upstream commit this fork branched from). Keep the file honest: when a new fork feature modifies an upstream file, add it; when a fork change is upstreamed or reverted, remove it.

## Workflow 1: Upstream Sync (`.github/workflows/upstream-sync.yml`)

Runs weekly (Mondays) and on manual dispatch. It:

1. Checks out the fork with full history, adds the upstream remote in the runner (not locally), and fetches it.
2. Resolves the upstream default branch head. If that sha is already contained in the fork default branch, or a sync PR for that sha already exists (branch pattern `upstream-sync/*`, short sha in the PR title), it exits quietly.
3. If a sync PR is already open, it comments on that PR instead of stacking a duplicate.
4. Otherwise it creates `upstream-sync/<yyyy-mm-dd>` from the fork default branch and attempts `git merge --no-edit upstream/<default>`:
   - **Clean merge** → pushes the branch and opens a PR titled `chore: merge upstream T3 Code <short-sha>` with a diffstat summary and a callout of any touchpoint files the merge changed.
   - **Conflict** → aborts the merge and opens (or refreshes) an issue labeled `upstream-conflict` listing the conflicted files, flagging which are touchpoints, with the manual-merge steps below.

### CI on sync PRs

PRs created with the default `GITHUB_TOKEN` never trigger workflow runs, so a sync PR shows no checks until someone closes/reopens it or pushes an empty commit. To make CI run automatically, add a repo secret `UPSTREAM_SYNC_TOKEN` (fine-grained PAT with contents + pull-requests write on this repo); the workflow prefers it and falls back to `GITHUB_TOKEN`, and the PR body says which token opened it. Either way: **never merge a sync PR with zero checks.**

## Workflow 2: Upstream Watch (`.github/workflows/upstream-watch.yml`)

Runs daily and on manual dispatch. It fetches upstream without merging and diffs new upstream commits **restricted to the touchpoint paths**. State lives in an open issue labeled `upstream-watch-cursor` whose body carries the last-seen upstream sha — no repo variables, no workflow commits.

- First run: creates the cursor issue at the current upstream head and exits.
- Subsequent runs: if upstream touched any touchpoint path since the cursor, it opens or updates an issue labeled `upstream-breaking-watch` ("Upstream touched integration points") with a per-file diffstat and the commit subjects, then advances the cursor. If nothing relevant changed, it just advances the cursor.

Do not close or hand-edit the cursor issue. If upstream rewrites history and orphans the cursor sha, the workflow resets the cursor to the current head automatically.

## Adding the upstream remote locally

The docs used to claim an `upstream` remote is configured; it is not by default. Add it once per clone:

```sh
git remote add upstream https://github.com/pingdotgg/t3code.git
git fetch upstream
```

## Manual merge when the Action reports conflicts

When an `upstream-conflict` issue appears:

1. Make sure the upstream remote exists locally (above) and `git fetch upstream`.
2. Branch from the fork default branch:

   ```sh
   git checkout main
   git pull origin main
   git checkout -b upstream-sync/manual-$(date +%Y-%m-%d)
   ```

3. Merge and resolve:

   ```sh
   git merge upstream/main
   ```

   Resolve conflicts file by file. For any file flagged as a **fork touchpoint** in the issue, read its `why` in `.github/upstream-touchpoints.json` and preserve the workbench behavior while taking upstream's structural changes. When upstream rewrote a region the fork also changed, prefer re-applying the fork delta on top of upstream's new shape over keeping the stale fork version.

4. Verify with targeted checks only (per `AGENTS.md` — no repo-wide checks): `pnpm --filter <pkg> typecheck` for each package with resolved files, plus `pnpm exec vp test run <specific test files>` for tests near the conflicts.
5. Push the branch and open a PR against the default branch. Never push the merge directly.
