# Updating the Workbench

Unlock AI Workbench updates through git, because your installation _is_ a git clone. There is no auto-updater, no installer to download, and no `npx` command — those flows belong to the upstream T3 Code product, not this fork.

## Update in Three Steps

1. Quit the Workbench: close the app window and its Terminal window.
2. Pull the latest version:
   - **GitHub Desktop:** open the repository, click **Fetch origin**, then **Pull origin**.
   - **Terminal:**

     ```bash
     cd unlock-ai-workbench
     git pull
     ```

     (Use the actual path where you cloned the folder.)

3. Relaunch by double-clicking `START-WORKBENCH.command`.

That is the whole update. The launcher notices when an update changed the dependency lockfile and reinstalls dependencies automatically — you will see "Step 1/2: Installing dependencies" again on the next launch. When nothing changed, it skips straight to starting the app.

## If `git pull` Complains

- **"Your local changes would be overwritten"** — you (or an agent run) edited files inside the Workbench folder itself. Keep your own work in your project folder (for example `~/Documents/Unlock Workbench`), not inside the app's folder. To see what changed, run `git status`; to discard app-folder changes you do not want, run `git checkout -- <file>`.
- **Authentication errors** — sign in again: GitHub Desktop re-prompts on its own; for the command line, run `gh auth login`.

## Provider CLIs Update Separately

Updating the Workbench does not update Claude Code, Codex, or any other provider CLI — and updating those does not update the Workbench. Each provider has its own update mechanism (Claude Code updates itself; npm-installed CLIs update with `npm install -g <package>` again). If a provider starts misbehaving after months of use, updating that CLI is a separate, worthwhile step.
