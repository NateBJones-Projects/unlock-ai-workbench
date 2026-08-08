# Unlock AI Workbench

Run Nate's Unlock AI skills and workflows with the AI subscriptions you already have — and review everything at a human gate before anything leaves your machine.

Unlock AI Workbench is a Nate Jones Media desktop app for subscribers. It turns the Unlock AI library into a browsable catalog, launches skills and workflows into real provider-backed threads, and adds a native Ringside panel for watching multi-agent Ringer runs. Everything runs locally from this folder; the app deliberately ships no provider credentials and no cloud sign-in.

## What you need

Everything here is free except the AI subscription you already have. Paste each install command into the Terminal app (Applications → Utilities → Terminal). If `brew` is not found, install [Homebrew](https://brew.sh) first.

| What                   | Why                                                                 | How to get it                                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub access + git    | The Workbench is a private repository you clone and update with git | [GitHub Desktop](https://desktop.github.com) (easiest), or `xcode-select --install` for plain git                                             |
| Node.js 24.13 or newer | Runs the Workbench server and app                                   | `brew install node` or [nodejs.org](https://nodejs.org)                                                                                       |
| pnpm 11                | Installs the Workbench's locked dependencies                        | `brew install pnpm`                                                                                                                           |
| One provider CLI       | Does the actual AI work with your existing subscription             | Claude Code: `npm install -g @anthropic-ai/claude-code`, then `claude auth login` · Codex: `npm install -g @openai/codex`, then `codex login` |
| Python 3.13 (optional) | Only for multi-agent Ringer runs; everything else works without it  | `brew install python@3.13`                                                                                                                    |

The step-by-step version, including the GitHub Desktop path, is in [Install and first run](./docs/user/install.md).

## Launch it

1. Clone this repository with an authorized GitHub account ([how](./docs/user/install.md)):

   ```bash
   git clone https://github.com/NateBJones-Projects/unlock-ai-workbench.git
   ```

2. Double-click `START-WORKBENCH.command` in the cloned folder. The first launch installs dependencies (a few minutes); after that it starts in seconds. If macOS blocks the double-click, right-click the file and choose **Open**.
3. Keep the Terminal window open while you use the app. Closing it stops the Workbench.

The launcher checks Node, pnpm, and Python for you and prints the exact install command for anything missing. All app state stays inside this folder's `.t3` directory, isolated from any other T3 Code installation.

## Your first ten minutes

Start with [Getting started](./docs/user/getting-started.md): add a project folder, confirm a provider, run **The Research Engine** end to end, and watch the **Ringer Readiness Check** in Ringside — with what-you-should-see checkpoints at every step.

## Troubleshooting

- **"needs Node.js" / "needs pnpm" / "Python 3.12+ was not found"** — the launcher prints the exact command to paste into Terminal. Run it, then double-click the launcher again. Python is optional; only Ringer runs need it.
- **Provider works in Terminal but the app says it is not found** — the app inherits a different `PATH` than your Terminal. Open **Settings**, choose the provider instance, and set **Binary path** to the CLI's full path (find it with `which claude` or `which codex`).
- **First install failed and it keeps failing** — the launcher retries the install on every launch until it succeeds. To see the full error, run `pnpm install --frozen-lockfile` from Terminal in this folder.
- **Double-clicking the launcher is blocked by macOS** — right-click `START-WORKBENCH.command` and choose **Open**. Details in [Install and first run](./docs/user/install.md).

## Powered by T3 Code

Unlock AI Workbench is transparently powered by the open-source [T3 Code](https://github.com/pingdotgg/t3code) agent harness built by T3 Tools. T3 Code provides the threads, projects, terminals, provider processes, and permission system; the Workbench adds the Unlock catalog, Quick Actions, Ringside, and the pinned Ringer runtime on top. This fork keeps the upstream MIT notice and attribution; it is a distinct customization and does not imply T3 Tools endorsement.

The T3 Code foundation remains under its original [MIT license](./LICENSE). Ringer/Ringside ships with its PolyForm Shield terms, required copyright notice, and Nate Jones Media's separate product-specific authorization for Unlock AI Workbench. See [Third-party notices](./THIRD_PARTY_NOTICES.md) and [Ringer product authorization](./RINGER_PRODUCT_AUTHORIZATION.md).

## Nate, everywhere

The Workbench runs the skills; the thinking behind them is published on Nate's other surfaces.

- [Unlock AI guides](https://unlock-ai.natebjones.com) — the published field-guide library this Workbench's catalog links back to.
- [Nate's Newsletter on Substack](https://natesnewsletter.substack.com) — essays and analysis on AI strategy, the writing the guides grew out of.
- [YouTube](https://www.youtube.com/@NateBJones) — video breakdowns of AI news, models, and working methods.
- [AI News & Strategy Daily](https://podcasts.apple.com/us/podcast/ai-news-strategy-daily-with-nate-b-jones/id1877109372) — the daily podcast, for when you are away from a screen.
- [TikTok](https://www.tiktok.com/@nate.b.jones) — short-form takes on what just changed in AI.
- [natebjones.com](https://www.natebjones.com) — Nate's website, the front door to all of it.

## Documentation

Full docs live in [docs/](./docs).

- [Getting started — your first ten minutes](./docs/user/getting-started.md)
- [Install and first run](./docs/user/install.md)
- [Visual tour (screenshots of every surface)](./docs/user/visual-tour.md)
- [Unlock AI Workbench local v1](./docs/unlock-ai-workbench-v1.md)
- [Using Ringside](./docs/user/ringside.md)
- [Permission modes](./docs/user/permission-modes.md)
- [Keyboard shortcuts](./docs/user/keybindings.md)
- [Remote access from a phone or another machine](./docs/user/remote-access.md)
- [Updating the Workbench](./docs/user/updating.md)
- [Source control integrations](./docs/user/source-control.md)
- Multiple accounts: [Codex](./docs/user/providers-codex.md) · [Claude](./docs/user/providers-claude.md)
- Maintainers: [architecture overview](./docs/internals/overview.md), [Ringer integration](./docs/internals/ringer-integration.md), [Ringer runtime operations](./docs/operations/ringer-runtime.md), [upstream T3 Code reference](./docs/internals/upstream-t3.md)

This is a private alpha. Expect rough edges, and see [CONTRIBUTING.md](./CONTRIBUTING.md) for how to report problems.
