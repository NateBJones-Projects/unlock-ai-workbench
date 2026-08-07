# Unlock AI Workbench — local v1

Subscribers start at the [getting-started guide](./user/getting-started.md); this document is the product and architecture record.

## Product decision

Unlock AI Workbench is a transparent, Nate Jones–branded product layer built on T3 Code. It does
not conceal its foundation: the sidebar and About panel say “Powered by T3 Code,” the upstream
remote remains configured, and the original MIT license remains in the repository.

The product layer does four jobs:

1. Turns the Unlock AI library into a browsable catalog instead of a long reference page.
2. Launches a selected skill or workflow into a real provider-backed T3 thread.
3. Keeps provider support honest: a provider is detected by T3; each pack separately declares
   whether its delivery path is ready, planned, or unsupported.
4. Preserves human gates around publishing, sending, account changes, and sensitive-data
   transmission.

## V1 architecture

| Layer             | Responsibility                                                                                                                  | Update boundary                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| T3 Code core      | Threads, projects, terminals, diffs, provider processes, permissions, desktop shell                                             | Merge from the `upstream` remote                                               |
| Workbench shell   | Nate-branded Home, Workflows, Skills, Learn, navigation, desktop identity                                                       | Small isolated files under `apps/web/src/components/workbench` and route files |
| Unlock catalog    | Versioned skill manifests, workflow manifests, complete blueprint inventory, guide links, compatibility, verification contracts | `packages/unlock-catalog`                                                      |
| Provider delivery | Native skill-file setup for Codex and Claude Code; prompt launch for all detected T3 providers                                  | Adapter work; OpenCode/Cursor/Grok hardening follows v1                        |
| Ringer runtime    | Exact-run orchestration, ownership, verification, artifacts, cancellation, and thread-scoped Ringside state                     | Pinned reviewed snapshot; Workbench updater owns runtime changes               |
| Subscriber layer  | Entitlement fetch, signed catalog release, update channel                                                                       | Deliberately deferred; local v1 has no fake sign-in or paywall                 |

The catalog is intentionally separate from the interface. New library releases should change data
and tests, not the thread engine. Upstream T3 changes should usually merge without touching the
catalog.

## Included in this local v1

- Unlock AI Workbench desktop/web identity, cyan/cream editorial theme, Avenir typography, and
  Nate beanie icon.
- Persistent Home, Workflows, Skills, and Learn navigation in both T3 sidebar variants.
- A Home readiness view for workspace, provider, skill, workflow, and guide state.
- The complete local Unlock AI inventory: 41 skill blueprints, 10 runbooks, and 20 published
  guides.
- Ten hardened v1 skill packs with explicit requirements, setup fields, outputs, deny-by-default
  boundaries, provider compatibility, and verification contracts.
- Three runnable v1 workflows that prepare a new real T3 thread and stop at a human review gate.
- A native, thread-scoped **Ringside** panel that keeps multiple Ringer runs separate and shows
  provider-native agents alongside them without merging their lifecycles.
- Searchable, favoriteable Quick Actions for workflows, skills, project Actions, and reviewed
  Ringer templates. Each item names its real execution strategy before launch. Direct project
  Actions also receive only non-secret Workbench context: `T3CODE_ENVIRONMENT_ID`,
  `T3CODE_THREAD_ID`, `T3CODE_PROJECT_ID`, `T3CODE_ACTION_ID`, and
  `T3CODE_ACTION_SOURCE=workbench`.
- An allowlisted **Ringer Readiness Check** that exercises launch, state streaming, executed
  verification, proof/log retrieval, artifacts, and exact-run controls with zero provider/model
  calls.
- A pinned Ringer runtime snapshot with a content lock, Nate Jones Media authorization, required
  notices, a package-compiled trusted digest, runtime execution verification, nonce-bound HUD
  identity, and desktop packaging/update boundaries.
- Native skill setup prompts that preserve the exact generated `SKILL.md` and require the agent to
  validate and report its install path.
- Transparent attribution in the product UI and retained upstream license.

## Deliberate v1 limits

- This is a local alpha, not a notarized subscriber release.
- Codex and Claude Code native skill-file delivery are the verified path. T3 can control Cursor,
  Grok Build, and OpenCode, but Workbench-specific native adapters for those providers still need
  compatibility tests.
- Ten skills have hardened, installable manifests. The rest of the complete library is exposed as
  guided blueprints that ask the active agent to interview the user and build the provider-native
  version.
- Three workflows have formal permissions and verification contracts. The remaining runbooks are
  useful launch blueprints, not yet autonomous workflows.
- The three human-gated workflows remain prepared prompts; they are not falsely converted into
  parallel Ringer manifests. The diagnostic is the only executable Ringer template in this cut.
- Ringer requires a compatible Python 3.12+ installation. The launcher selects one when available
  and the UI reports an unavailable capability instead of attempting a partial launch.
- Exact-run cancellation is enabled on macOS in this cut. Other platforms can launch and monitor
  the diagnostic but do not display a cancellation control until process-birth validation is
  implemented there.
- Skills are installed through a provider-backed setup thread in v1. A later signed catalog service
  can write verified packs directly after an explicit user approval.
- Native-mobile Ringside presentation, subscriber authentication, telemetry, and release signing
  remain deferred. Remote web clients use the same typed, thread-scoped server stream today.

## Morning run

1. Double-click `START-WORKBENCH.command` in the repository root.
2. If macOS asks, allow Terminal to run it. Keep that Terminal window open while using Workbench.
3. Add a project folder from Home if none is configured.
4. Confirm at least one provider is ready. Existing Codex, Claude Code, Cursor, Grok Build, and
   OpenCode authentication is detected by the underlying T3 runtime.
5. Start with **The Research Engine**, or open **Skills** and choose a pack.
6. In a thread, open **Quick Actions → Ringer Readiness Check**. Ringside should open immediately,
   show one zero-spend run, and settle with proof plus `diagnostic.md`.

The launcher explicitly stores development state under this repository's ignored `.t3` directory,
isolated from a normal T3 Code installation. Closing the Workbench and its Terminal process stops
the local services.

## Focused verification

The release gate for this v1 is:

```text
pnpm --filter @t3tools/unlock-catalog typecheck
pnpm --filter @t3tools/unlock-catalog test
pnpm --filter @t3tools/unlock-catalog source:check
pnpm run check:ringer
RINGER_NO_SELF_UPDATE=1 python3.13 -m unittest tests.test_workbench_ringer tests.test_registry_process_locking
  # run from the canonical Ringer checkout
pnpm --filter @t3tools/contracts typecheck
pnpm --filter @t3tools/client-runtime typecheck
pnpm --filter t3 typecheck
pnpm --filter @t3tools/web typecheck
pnpm --filter @t3tools/web build
pnpm --filter @t3tools/desktop typecheck
focused branding and desktop identity tests
desktop build and smoke test
interactive Home → Skills/Workflows → prepared-thread check
```

## Licensing and attribution

T3 Code is MIT licensed. That license permits using, modifying, distributing, sublicensing, and
selling copies, provided its copyright and permission notice remain in copies or substantial
portions. This fork keeps the original `LICENSE` intact and visibly credits T3 Code. Product names,
logos, provider CLIs, hosted services, and user subscriptions can carry separate trademark or
service terms; the Workbench brand should remain distinct and should not imply T3 endorsement.

## After v1

1. Run real jobs with five to ten users and measure completion, correction, and abandonment by
   skill/workflow version.
2. Promote blueprints into hardened packs based on demand, starting with Media Transcription,
   Frontend Taste, Goal Prompt Generator, and Browser Automation QA.
3. Add signed catalog releases and an in-app update diff: new, changed, permission-expanded, and
   retired.
4. Add provider adapters and compatibility fixtures for OpenCode, Cursor, and Grok Build.
5. Promote high-demand workflows to reviewed Ringer templates only where their dependency graph and
   human gates are explicit.
6. Connect Unlock AI entitlements without putting subscriber logic into the T3 core.
7. Package a notarized macOS build only after the local product loop is stable.
