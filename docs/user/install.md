# Install Unlock AI Workbench

Unlock AI Workbench is a desktop app you run from a cloned copy of this private repository. This guide takes you from a fresh Mac to a running Workbench.

## Before You Start

You need a GitHub account that has been granted access to the `NateBJones-Projects/unlock-ai-workbench` repository. If you can open that repository page in your browser while signed in, you have access.

Install the prerequisites by pasting each command into Terminal (Applications → Utilities → Terminal):

1. [Homebrew](https://brew.sh), if `brew --version` says "command not found" — copy the install command from brew.sh.
2. Node.js 24.13 or newer:

   ```bash
   brew install node
   ```

3. pnpm 11:

   ```bash
   brew install pnpm
   ```

4. One provider CLI, authenticated with your existing subscription:

   ```bash
   npm install -g @anthropic-ai/claude-code && claude auth login
   ```

   or

   ```bash
   npm install -g @openai/codex && codex login
   ```

5. Optional — Python 3.13, needed only for multi-agent Ringer runs:

   ```bash
   brew install python@3.13
   ```

The launcher re-checks all of this on every start and prints the exact fix for anything missing, so an incomplete setup fails with instructions, not mystery errors.

## Get the Code

There are two realistic paths. Both give you a real git clone that can receive updates.

### Path A: GitHub Desktop (no command line)

1. Download and open [GitHub Desktop](https://desktop.github.com).
2. Sign in with the GitHub account that has access to the repository.
3. Choose **File → Clone Repository**, select `NateBJones-Projects/unlock-ai-workbench`, pick a location you can find again (for example your home folder), and clone.

### Path B: gh CLI (command line)

```bash
brew install gh
gh auth login
gh repo clone NateBJones-Projects/unlock-ai-workbench
```

`gh auth login` walks you through browser sign-in; after that, cloning and later `git pull` updates work without password prompts.

### Do Not Use "Download ZIP"

GitHub's **Code → Download ZIP** button looks easier, but do not use it:

- macOS marks every extracted file with the quarantine attribute, so Gatekeeper can block scripts inside the app from running.
- A ZIP is a dead-end snapshot — it has no git history, so there is no update path. Every update would mean re-downloading and reconfiguring from scratch.

If you already installed from a ZIP, delete that folder and clone properly using Path A or B.

## First Launch

1. In Finder, open the cloned folder and double-click `START-WORKBENCH.command`.
2. **The first double-click may be blocked by Gatekeeper** ("cannot be opened because it is from an unidentified developer"). Right-click (or Control-click) `START-WORKBENCH.command` and choose **Open**, then confirm **Open** in the dialog. On newer macOS versions you may instead need **System Settings → Privacy & Security → Open Anyway**. This is a one-time approval.
3. A Terminal window opens and runs the launcher:
   - **Step 1/2** installs the locked dependencies. This happens on the first run and again only when an update changes them — expect a few minutes the first time.
   - **Step 2/2** starts the Workbench app.
4. Keep the Terminal window open while you use the app. Closing it stops the Workbench.

All Workbench state lives inside this folder's `.t3` directory, isolated from any other T3 Code installation on your machine.

## Providers

The Workbench drives provider CLIs; it does not ship them. A provider must be installed and authenticated before you start a session with it — but the Workbench itself opens fine first, and shows each provider's status in **Settings**.

If a provider works in Terminal but the app reports it missing, the app's `PATH` differs from your Terminal's. Open **Settings**, choose the provider instance, and set **Binary path** to the full path printed by `which claude` or `which codex`.

For multi-account setups, see [Codex](./providers-codex.md) and [Claude](./providers-claude.md).

## Next Steps

- [Getting started](./getting-started.md): your first ten minutes, step by step
- [Permission modes](./permission-modes.md): how much the Workbench asks before acting
- [Remote access](./remote-access.md): connect from a phone, tablet, or another desktop
- [Updating](./updating.md): pulling new versions
