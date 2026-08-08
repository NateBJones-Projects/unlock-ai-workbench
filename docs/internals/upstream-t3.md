# Upstream T3 Code reference

This page preserves the upstream T3 Code install and contributor material that was removed from the subscriber-facing README. Everything below installs or references the **upstream product** — `t3` from npm, Homebrew, winget, or the AUR — **not** Unlock AI Workbench. Subscribers should never run these commands; maintainers merging from upstream will want them.

## Upstream project

T3 Code was built by T3 Tools as an open, performant, remote-ready agent interface: an "agent harness control surface" with a mobile app ([iOS](https://apps.apple.com/us/app/t3-code-remote-claude-more/id6787819824), [Android](https://play.google.com/store/apps/details?id=com.t3tools.t3code)), [web app](https://app.t3.codes), and [Electron-based desktop app](https://t3.codes). This fork keeps its MIT notice and upstream attribution; Unlock AI Workbench is a distinct customization and does not imply T3 Tools endorsement.

## Installing upstream T3 Code (not the Workbench)

Run the upstream server without installing (requires Node.js 22.16+, 23.11+, or 24.10+):

```bash
npx t3@latest
```

This launches the upstream T3 Code backend and local web app. `npx t3@latest --help` prints the full CLI reference.

Upstream desktop app installs, from [GitHub Releases](https://github.com/pingdotgg/t3code/releases) or a package registry:

```bash
winget install T3Tools.T3Code   # Windows
brew install --cask t3-code     # macOS
yay -S t3code-bin               # Arch Linux (AUR)
```

Upstream supports Codex, Claude, Cursor, Grok Build, and OpenCode; install and authenticate at least one provider CLI before use:

- Codex: install [Codex CLI](https://developers.openai.com/codex/cli) and run `codex login`
- Claude: install [Claude Code](https://claude.com/product/claude-code) and run `claude auth login`
- Cursor: install [Cursor CLI](https://cursor.com/cli) and run `agent login`
- Grok Build: install [Grok Build CLI](https://x.ai/cli) and run `grok login`
- OpenCode: install [OpenCode](https://opencode.ai) and run `opencode auth login`

## Contributor tooling

Upstream development uses Vite+, so the global `vp` command-line tool is required:

```bash
curl -fsSL https://vite.plus | bash   # macOS / Linux
irm https://vite.plus/ps1 | iex       # Windows
```

Getting started guide: https://viteplus.dev/guide/

Install dependencies with:

```bash
vp i
```

Fork-specific development starts at [overview.md](./overview.md); agent rules live in the root `AGENTS.md`.

## Upstream community

Upstream support and discussion happen in the T3 [Discord](https://discord.gg/jn4EGJjrvv). Issues with Unlock AI Workbench belong in this fork's channels, not upstream's.
