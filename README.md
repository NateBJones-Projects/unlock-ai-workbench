# Unlock AI Workbench

Unlock AI Workbench is a Nate Jones Media product surface for using the Unlock AI skill and workflow library with the AI providers people already have. It adds a guided catalog, reusable Quick Actions, and native Ringside monitoring for multi-agent Ringer runs.

It is transparently powered by the open-source [T3 Code](https://github.com/pingdotgg/t3code) harness and works with Claude Code, Codex, Cursor, Grok Build, and OpenCode. Provider support comes from T3 Code; Ringer adds verified multi-agent execution above those providers.

## Try the local alpha

Clone the private repository with an authorized GitHub account, then launch it:

```bash
git clone https://github.com/NateBJones-Projects/unlock-ai-workbench.git
cd unlock-ai-workbench
./START-WORKBENCH.command
```

On macOS you can also double-click `START-WORKBENCH.command`. The launcher installs the locked
JavaScript dependencies on first run, uses the Ringer snapshot committed under
`apps/desktop/resources/ringer`, and keeps local state inside this checkout. No separate Ringer
clone is required.

To launch from an existing terminal, run:

```bash
pnpm run workbench
```

Development state is isolated under this repository's `.t3` directory. See the [local v1 guide](./docs/unlock-ai-workbench-v1.md), [Ringside user guide](./docs/user/ringside.md), and [Ringer runtime operations](./docs/operations/ringer-runtime.md).

The repository contains the Workbench UI, Unlock catalog, custom Ringer runtime, legal notices,
and integrity lock. It deliberately does not contain provider credentials or provider CLI binaries.
Install pnpm 11, Python 3.12 or newer, and any AI provider CLI you intend to use; authenticate that
provider normally. The launcher finds a compatible Python interpreter automatically and reports an
unavailable Ringer capability instead of attempting a partial launch when none is installed.

## Powered by T3 Code

T3 Code is an "agent harness control surface". It enables control of the agents on your machine with a mobile app ([iOS](https://apps.apple.com/us/app/t3-code-remote-claude-more/id6787819824), [Android](https://play.google.com/store/apps/details?id=com.t3tools.t3code)), [web app](https://app.t3.codes), and [Electron-based desktop app](https://t3.codes).

## Upstream project

T3 Code was built by T3 Tools as an open, performant, remote-ready agent interface. This fork keeps its MIT notice and upstream attribution; Unlock AI Workbench is a distinct customization and does not imply T3 Tools endorsement.

We wanted something performant, remote-ready, and truly open. If we ever go the wrong direction, we want you to have everything you need to fork and build the editor that you want.

## Installation

> [!WARNING]
> T3 Code currently supports Codex, Claude, Cursor, Grok Build and OpenCode. Install and authenticate at least one provider before use:
>
> - Codex: install [Codex CLI](https://developers.openai.com/codex/cli) and run `codex login`
> - Claude: install [Claude Code](https://claude.com/product/claude-code) and run `claude auth login`
> - Cursor: install [Cursor CLI](https://cursor.com/cli) and run `agent login`
> - Grok Build: install [Grok Build CLI](https://x.ai/cli) and run `grok login`
> - OpenCode: install [OpenCode](https://opencode.ai) and run `opencode auth login`

### Try it out (install-free)

The easiest way to test T3 Code is to run the server in your terminal (requires Node.js 22.16+, 23.11+, or 24.10+):

```bash
npx t3@latest
```

This will launch T3 Code's backend on your machine as well as the local web app to control your agents.

Tip: Use `npx t3@latest --help` for the full CLI reference.

### Desktop app

Install the latest version of the desktop app from [GitHub Releases](https://github.com/pingdotgg/t3code/releases), or from your favorite package registry:

#### Windows (`winget`)

```bash
winget install T3Tools.T3Code
```

#### macOS (Homebrew)

```bash
brew install --cask t3-code
```

#### Arch Linux (AUR)

```bash
yay -S t3code-bin
```

## Some notes

We are very very early in this project. Expect bugs.

We are (mostly) not accepting contributions yet. Small fixes may be considered. Big features will not be.

## Documentation

Full docs live in [docs/](./docs). There's no docs site yet.

- [Unlock AI Workbench local v1](./docs/unlock-ai-workbench-v1.md)
- [Using Ringside](./docs/user/ringside.md)
- [Ringer integration architecture](./docs/internals/ringer-integration.md)
- [Ringer runtime operations](./docs/operations/ringer-runtime.md)
- [Install and first run](./docs/user/install.md)
- [Permission modes](./docs/user/permission-modes.md)
- [Keyboard shortcuts](./docs/user/keybindings.md)
- [Remote access from a phone or another machine](./docs/user/remote-access.md)
- [Keeping app and server in sync](./docs/user/updating.md)
- [Source control integrations](./docs/user/source-control.md)
- Multiple accounts: [Codex](./docs/user/providers-codex.md) · [Claude](./docs/user/providers-claude.md)
- Linux: [run T3 Code as a background service](./docs/user/background-service.md)

Building from source? Start at [docs/internals/overview.md](./docs/internals/overview.md).

## Licensing and attribution

The T3 Code foundation remains under its original MIT license. Ringer/Ringside ships with its PolyForm Shield terms, required copyright notice, and Nate Jones Media's separate product-specific authorization for Unlock AI Workbench. See [Third-party notices](./THIRD_PARTY_NOTICES.md) and [Ringer product authorization](./RINGER_PRODUCT_AUTHORIZATION.md).

## If you REALLY want to contribute still.... read this first

### Install `vp`

T3 Code uses Vite+ so you'll need to install the global `vp` command-line tool.

#### macOS / Linux

```bash
curl -fsSL https://vite.plus | bash
```

#### Windows

```bash
irm https://vite.plus/ps1 | iex
```

Checkout their getting started guide for more information: https://viteplus.dev/guide/

### Install dependencies

```bash
vp i
```

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening an issue or PR.

Need support? Join the [Discord](https://discord.gg/jn4EGJjrvv).
